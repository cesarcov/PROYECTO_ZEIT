"""Configuración tipada del backend.

F-000 / T-02 — RN-03: el sistema **no arranca** si falta una variable de entorno
crítica. Toda variable que el backend consume está declarada aquí y validada al
importar el módulo; nadie debe llamar a `os.getenv()` fuera de este archivo.

Si falta algo, el proceso muere con un mensaje que dice exactamente qué falta y
qué hacer, en vez de un traceback de pydantic o un fallo silencioso en runtime.
"""
import sys
from typing import Literal

from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Entorno ───────────────────────────────────────────────────────────────
    ENV: Literal["development", "staging", "production"] = "development"

    # ── Seguridad / JWT ───────────────────────────────────────────────────────
    # OBLIGATORIA: sin ella el sistema no arranca (RN-03). Su LONGITUD, en
    # cambio, sólo se avisa — ver `_avisar_si_la_clave_es_debil` más abajo.
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # ── Base de datos del tenant ──────────────────────────────────────────────
    DATABASE_URL: str

    # ── Master DB (registro de tenants) ───────────────────────────────────────
    MASTER_DATABASE_URL: str = ""

    # ── Superadmin (credenciales en env, nunca en la BD de un tenant) ─────────
    SUPERADMIN_USERNAME: str = ""
    SUPERADMIN_PASSWORD_HASH: str = ""

    # ── Pool de conexiones ────────────────────────────────────────────────────
    DB_POOL_MIN: int = 1
    DB_POOL_MAX: int = 5

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Lista separada por comas de orígenes EXACTOS permitidos en producción.
    CORS_ORIGINS: str = ""

    # ── Observabilidad (T-04) ─────────────────────────────────────────────────
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    # Hash corto del commit desplegado; lo inyecta Render/CI. Cae a "dev".
    GIT_COMMIT: str = "dev"

    # ── Rate limiting de login (T-14) ─────────────────────────────────────────
    LOGIN_RATE_LIMIT: str = "5/minute"
    LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_BASE_SECONDS: int = 60

    # ── Almacenamiento de archivos (T-11) ─────────────────────────────────────
    # Vacío ⇒ se usa el disco local (efímero en Render). Con valor ⇒ Supabase Storage.
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""
    SUPABASE_BUCKET_BRANDING: str = "branding"
    SUPABASE_BUCKET_AVATARS: str = "avatars"

    # ── SharePoint (integración opcional de reportes) ─────────────────────────
    SHAREPOINT_TENANT_ID: str = ""
    SHAREPOINT_CLIENT_ID: str = ""
    SHAREPOINT_CLIENT_SECRET: str = ""
    SHAREPOINT_SITE_NAME: str = ""
    SHAREPOINT_FOLDER_PATH: str = "Documentos compartidos/ERP_Reportes"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ── Validaciones de negocio ───────────────────────────────────────────────

    @field_validator("GIT_COMMIT")
    @classmethod
    def _commit_desde_la_plataforma(cls, v: str) -> str:
        """Render inyecta RENDER_GIT_COMMIT automáticamente; se usa si no hay valor propio."""
        if v and v != "dev":
            return v[:12]
        import os

        automatico = os.getenv("RENDER_GIT_COMMIT") or os.getenv("GITHUB_SHA") or ""
        return automatico[:12] if automatico else "dev"

    @field_validator("DB_POOL_MAX")
    @classmethod
    def _pool_max_mayor_que_min(cls, v: int, info) -> int:
        minimo = info.data.get("DB_POOL_MIN", 1)
        if v < minimo:
            raise ValueError(f"DB_POOL_MAX ({v}) no puede ser menor que DB_POOL_MIN ({minimo})")
        return v

    # ── Derivados ─────────────────────────────────────────────────────────────

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def is_dev(self) -> bool:
        return self.ENV == "development"

    @property
    def cors_origins_list(self) -> list[str]:
        """Orígenes CORS exactos. En desarrollo añade los puertos locales de Vite."""
        origins = [o.strip().rstrip("/") for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if not self.is_production:
            origins += [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:5174",
            ]
        # dict.fromkeys preserva el orden y elimina duplicados.
        return list(dict.fromkeys(origins))


LONGITUD_MINIMA_SECRET_KEY = 32


def _avisar_si_la_clave_es_debil(s: Settings) -> None:
    """Avisa de una SECRET_KEY débil SIN impedir el arranque.

    Por qué es un aviso y no un error: esta comprobación se añadió cuando el
    sistema ya llevaba meses en producción. Negarse a arrancar por una clave
    corta no la hace más fuerte — sólo tira el servicio, y encima en mitad de
    un despliegue, que es el peor momento posible.

    Es el mismo trinquete que el linter y la deuda RBAC: primero se avisa,
    se comprueba que todos los entornos están limpios, y entonces se sube a
    error. Cuando producción y staging tengan claves fuertes, esto pasa a ser
    un fallo de arranque (y se añade su test).
    """
    problemas = []
    if len(s.SECRET_KEY) < LONGITUD_MINIMA_SECRET_KEY:
        problemas.append(
            f"tiene {len(s.SECRET_KEY)} caracteres; el minimo recomendado es "
            f"{LONGITUD_MINIMA_SECRET_KEY}"
        )
    if "cambia-esto" in s.SECRET_KEY.lower() or s.SECRET_KEY.lower().startswith("changeme"):
        problemas.append("sigue siendo el valor de ejemplo de .env.example")

    if not problemas:
        return

    print("\n" + "!" * 72, file=sys.stderr)
    print(f"  AVISO DE SEGURIDAD - entorno '{s.ENV}'", file=sys.stderr)
    print("  La SECRET_KEY que firma los tokens de sesion es DEBIL:", file=sys.stderr)
    for problema in problemas:
        print(f"    - {problema}", file=sys.stderr)
    print("  Quien la adivine puede falsificar la sesion de cualquier usuario.", file=sys.stderr)
    print("  Genera una fuerte:", file=sys.stderr)
    print('    python -c "import secrets; print(secrets.token_urlsafe(48))"', file=sys.stderr)
    print("  Al cambiarla, todas las sesiones abiertas se cierran (es lo esperado).", file=sys.stderr)
    print("!" * 72 + "\n", file=sys.stderr)


def _load() -> Settings:
    try:
        s = Settings()
        _avisar_si_la_clave_es_debil(s)
        return s
    except ValidationError as exc:
        # Mensaje deliberadamente en ASCII: se lee en consolas Windows y en los
        # logs de Render sin depender de la codificación del terminal.
        print("\n" + "=" * 72, file=sys.stderr)
        print("  ARRANQUE ABORTADO - configuracion de entorno invalida", file=sys.stderr)
        print("=" * 72, file=sys.stderr)
        for err in exc.errors():
            campo = ".".join(str(p) for p in err["loc"]) or "(raiz)"
            print(f"  - {campo}: {err['msg']}", file=sys.stderr)
        print("=" * 72, file=sys.stderr)
        print("  Revisa tu archivo .env - usa .env.example como plantilla.", file=sys.stderr)
        print("  En Render/Vercel: revisa las variables de entorno del servicio.\n", file=sys.stderr)
        raise SystemExit(1)


settings = _load()
