from pydantic import ConfigDict
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # 🔐 Seguridad
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ALGORITHM: str = "HS256"

    # 🗄️ Base de datos tenant (fallback dev)
    DATABASE_URL: str

    # 🗄️ Master DB (registro de tenants)
    MASTER_DATABASE_URL: str = ""

    # 👑 Superadmin (credenciales en env, no en DB)
    SUPERADMIN_USERNAME: str = ""
    SUPERADMIN_PASSWORD_HASH: str = ""

    # ⚡ Pool de conexiones de base de datos
    DB_POOL_MIN: int = 1
    DB_POOL_MAX: int = 5

    model_config = ConfigDict(
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
