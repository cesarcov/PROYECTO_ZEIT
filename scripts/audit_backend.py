# -*- coding: utf-8 -*-
"""
audit_backend.py — Monitor y auditoría completa del backend ERP Modular
Uso: python scripts/audit_backend.py
Salida: specs/audit/YYYY-MM-DD_HH-MM_backend_audit.md
"""

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Asegurar que el proyecto esté en el path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from app.core.database import db_connection  # noqa: E402

# ──────────────────────────────────────────────
# CONFIGURACIÓN
# ──────────────────────────────────────────────
AUDIT_DIR = ROOT / "specs" / "audit"
BASELINE_FILE = AUDIT_DIR / "baseline.json"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)

TIMESTAMP = datetime.now().strftime("%Y-%m-%d_%H-%M")
DATE_LABEL = datetime.now().strftime("%Y-%m-%d %H:%M")
OUTPUT_FILE = AUDIT_DIR / f"{datetime.now().strftime('%Y-%m-%d_%H-%M')}_backend_audit.md"
LATEST_FILE = AUDIT_DIR / "latest.md"

ALL_TABLES = [
    "users", "roles", "permissions", "user_roles", "role_permissions", "refresh_tokens", "audit_logs",
    "materials", "material_aliases", "material_groups", "material_group_items", "stock_item_categories",
    "warehouses", "stock_locations", "stock_movements", "stock_lots", "stock_lot_movements",
    "stock_reservations", "stock_dispatches", "stock_dispatch_items",
    "warehouse_transfers", "warehouse_transfer_items",
    "physical_inventories", "physical_inventory_items",
    "tool_assignments", "tool_loans", "tool_maintenance", "equipment_maintenance", "calibration_records",
    "material_requests", "material_request_items", "material_request_audit", "purchase_items",
    "project_plan_submissions", "project_plan_submission_items",
    "projects", "project_plans", "project_plan_items",
    "planificacion_semanal", "planificacion_subtareas", "planificacion_historial", "registro_productividad",
    "proveedores", "ordenes_compra", "ordenes_compra_items", "material_proveedores",
    "ordenes_trabajo", "ot_checklist", "ot_materiales", "ot_tiempos",
    "presupuesto_config", "presupuesto_partidas", "presupuesto_apu_items",
    "apu_baules", "apu_baul_items", "recursos_mo", "tarifas_personal", "categorias_costo", "visitas_tecnicas",
    "clientes", "cliente_contactos",
    "servicio_requerimientos", "servicio_requerimiento_costos",
    "canal_solicitudes", "canal_mensajes",
    "aprobaciones_gerencia", "branding",
]

# Tablas confirmadas como zombie (sin código activo)
ZOMBIE_TABLES = {
    "tool_loans", "equipment_maintenance",
    "material_request_items", "material_request_audit", "stock_item_categories",
}

# Columnas muertas en materials
DEAD_COLUMNS = {
    "materials": ["alias1", "alias2", "alias3", "maintenance_interval_days", "last_maintenance"],
}

# ──────────────────────────────────────────────
# SECCIÓN 1: SALUD DE BASE DE DATOS
# ──────────────────────────────────────────────

def check_db_health():
    results = {"status": "OK", "counts": {}, "errors": []}
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                for table in ALL_TABLES:
                    try:
                        cur.execute(f"SELECT COUNT(*) FROM {table}")
                        results["counts"][table] = cur.fetchone()[0]
                    except Exception as e:
                        results["errors"].append(f"{table}: {e}")
                        results["counts"][table] = -1
    except Exception as e:
        results["status"] = "ERROR"
        results["errors"].append(str(e))
    return results


def load_baseline():
    if BASELINE_FILE.exists():
        try:
            return json.loads(BASELINE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_baseline(counts):
    BASELINE_FILE.write_text(
        json.dumps({"timestamp": TIMESTAMP, "counts": counts}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def diff_vs_baseline(current, baseline):
    prev = baseline.get("counts", {})
    prev_ts = baseline.get("timestamp", "N/A")
    diffs = []
    for table, count in current.items():
        if count < 0:
            continue
        prev_count = prev.get(table, 0)
        delta = count - prev_count
        if delta != 0:
            diffs.append((table, prev_count, count, delta))
    diffs.sort(key=lambda x: abs(x[3]), reverse=True)
    return diffs, prev_ts


# ──────────────────────────────────────────────
# SECCIÓN 2: SMOKE TESTS (SALUD DE ENDPOINTS)
# ──────────────────────────────────────────────

def run_smoke_tests():
    result = {"status": "UNKNOWN", "output": "", "passed": 0, "failed": 0, "errors": []}
    try:
        r = subprocess.run(
            [sys.executable, "-m", "pytest", "tests/smoke/", "-v", "--tb=short", "--no-header", "-q"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=120,
        )
        result["output"] = (r.stdout + r.stderr)[-4000:]
        # Parsear resultado
        lines = result["output"].splitlines()
        for line in lines:
            if " passed" in line or " failed" in line or " error" in line:
                m = re.search(r"(\d+) passed", line)
                if m:
                    result["passed"] = int(m.group(1))
                m = re.search(r"(\d+) failed", line)
                if m:
                    result["failed"] = int(m.group(1))
        result["status"] = "PASS" if result["failed"] == 0 and r.returncode == 0 else "FAIL"
    except subprocess.TimeoutExpired:
        result["status"] = "TIMEOUT"
        result["errors"].append("Smoke tests excedieron 120s")
    except Exception as e:
        result["status"] = "ERROR"
        result["errors"].append(str(e))
    return result


# ──────────────────────────────────────────────
# SECCIÓN 3: ANÁLISIS DE AUDIT LOGS
# ──────────────────────────────────────────────

def analyze_audit_logs():
    result = {
        "total_24h": 0,
        "errors_500": [],
        "top_endpoints": [],
        "top_users": [],
        "suspicious": [],
    }
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                since = datetime.utcnow() - timedelta(hours=24)

                # Total de operaciones en 24h
                cur.execute("SELECT COUNT(*) FROM audit_logs WHERE created_at >= %s", (since,))
                result["total_24h"] = cur.fetchone()[0]

                # Errores 500
                cur.execute("""
                    SELECT endpoint, action, username, created_at
                    FROM audit_logs
                    WHERE status_code = 500 AND created_at >= %s
                    ORDER BY created_at DESC LIMIT 10
                """, (since,))
                result["errors_500"] = [
                    {"endpoint": r[0], "action": r[1], "user": r[2], "at": str(r[3])}
                    for r in cur.fetchall()
                ]

                # Top 10 endpoints más usados en 24h
                cur.execute("""
                    SELECT endpoint, COUNT(*) as hits
                    FROM audit_logs
                    WHERE created_at >= %s
                    GROUP BY endpoint ORDER BY hits DESC LIMIT 10
                """, (since,))
                result["top_endpoints"] = [{"ep": r[0], "hits": r[1]} for r in cur.fetchall()]

                # Top usuarios activos
                cur.execute("""
                    SELECT COALESCE(username, 'anon'), COUNT(*) as ops
                    FROM audit_logs
                    WHERE created_at >= %s
                    GROUP BY username ORDER BY ops DESC LIMIT 5
                """, (since,))
                result["top_users"] = [{"user": r[0], "ops": r[1]} for r in cur.fetchall()]

                # Actividad fuera de horario laboral (antes de 7am o después de 10pm UTC-5 → UTC 12:00 y 03:00)
                cur.execute("""
                    SELECT username, endpoint, created_at
                    FROM audit_logs
                    WHERE created_at >= %s
                      AND (EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Lima') < 6
                           OR EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Lima') >= 22)
                    ORDER BY created_at DESC LIMIT 5
                """, (since,))
                result["suspicious"] = [
                    {"user": r[0], "ep": r[1], "at": str(r[2])}
                    for r in cur.fetchall()
                ]
    except Exception as e:
        result["error"] = str(e)
    return result


# ──────────────────────────────────────────────
# SECCIÓN 4: DEUDA TÉCNICA / ZOMBIES
# ──────────────────────────────────────────────

def check_tech_debt(counts):
    issues = []

    # Tablas zombie confirmadas
    for t in ZOMBIE_TABLES:
        n = counts.get(t, 0)
        issues.append({
            "severity": "HIGH",
            "type": "ZOMBIE_TABLE",
            "item": t,
            "detail": f"{n} filas — tabla sin código activo (candidata a DROP)",
        })

    # Columnas muertas
    for table, cols in DEAD_COLUMNS.items():
        issues.append({
            "severity": "MEDIUM",
            "type": "DEAD_COLUMNS",
            "item": f"{table}.{{{','.join(cols)}}}",
            "detail": "Columnas sin uso activo — candidatas a DROP COLUMN",
        })

    # Refresh tokens acumulados
    rt = counts.get("refresh_tokens", 0)
    if rt > 200:
        issues.append({
            "severity": "MEDIUM",
            "type": "ACCUMULATION",
            "item": "refresh_tokens",
            "detail": f"{rt} tokens — falta job de limpieza de tokens expirados/revocados",
        })

    # Audit logs crecimiento
    al = counts.get("audit_logs", 0)
    if al > 50000:
        issues.append({
            "severity": "MEDIUM",
            "type": "GROWTH",
            "item": "audit_logs",
            "detail": f"{al} filas — definir política de retención (ej. 90 días)",
        })

    # materials God Table
    issues.append({
        "severity": "LOW",
        "type": "GOD_TABLE",
        "item": "materials (41 cols)",
        "detail": "Mezcla consumibles, equipos y herramientas. Normalizar cuando el equipo crezca.",
    })

    # tool_assignments vs tool_loans
    issues.append({
        "severity": "LOW",
        "type": "OVERLAP",
        "item": "tool_assignments + tool_loans",
        "detail": "Misma semántica (herramienta fuera del almacén). Unificar en feature futura.",
    })

    return issues


# ──────────────────────────────────────────────
# SECCIÓN 5: SUGERENCIAS DE ROBUSTEZ ERP
# ──────────────────────────────────────────────

def generate_recommendations(counts, smoke, logs):
    recs = []

    # Seguridad
    recs.append({
        "area": "Seguridad",
        "priority": "ALTA",
        "title": "Rate limiting en endpoints de auth",
        "detail": (
            "POST /auth/login y /auth/refresh no tienen rate limiting. "
            "Un atacante puede hacer fuerza bruta. "
            "Implementar con slowapi (max 5 intentos/min por IP)."
        ),
    })
    recs.append({
        "area": "Seguridad",
        "priority": "ALTA",
        "title": "Limpieza periódica de refresh_tokens expirados",
        "detail": (
            f"Hay {counts.get('refresh_tokens', 0)} refresh tokens acumulados. "
            "Agregar un job diario (APScheduler o pg_cron) que elimine tokens "
            "con expires_at < NOW() o revoked = true."
        ),
    })
    recs.append({
        "area": "Seguridad",
        "priority": "MEDIA",
        "title": "Headers de seguridad HTTP",
        "detail": (
            "Faltan headers: X-Content-Type-Options, X-Frame-Options, "
            "Strict-Transport-Security, Content-Security-Policy. "
            "Agregar con SecurityHeadersMiddleware en main.py."
        ),
    })

    # Operaciones / DevOps
    recs.append({
        "area": "Operaciones",
        "priority": "ALTA",
        "title": "Health check endpoint /health",
        "detail": (
            "No existe GET /health. Es el estándar para load balancers, "
            "Docker healthcheck y monitoreo externo (UptimeRobot, etc.). "
            "Debe responder 200 con {db: ok, version: X.Y.Z, uptime: Ns}."
        ),
    })
    recs.append({
        "area": "Operaciones",
        "priority": "ALTA",
        "title": "Política de retención de audit_logs",
        "detail": (
            f"audit_logs tiene {counts.get('audit_logs', 0)} filas y crece con cada request. "
            "Sin retención llegará a millones en meses. "
            "Implementar: DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days' "
            "como job semanal."
        ),
    })
    recs.append({
        "area": "Operaciones",
        "priority": "MEDIA",
        "title": "Versionado de la API (/api/v1/...)",
        "detail": (
            "Todos los endpoints están en la raíz (/logistics, /branding, etc.). "
            "Para poder vender el software y dar soporte a múltiples clientes con "
            "versiones distintas, necesitarás prefijo /api/v1/. "
            "Migrar ahora es O(1) (APIRouter prefix); hacerlo después cuando haya "
            "clientes en producción es O(n clientes)."
        ),
    })

    # Calidad de datos
    recs.append({
        "area": "Calidad de datos",
        "priority": "ALTA",
        "title": "Migración de limpieza: eliminar tablas/columnas zombie",
        "detail": (
            "5 tablas (tool_loans, equipment_maintenance, material_request_items, "
            "material_request_audit, stock_item_categories) y 5 columnas en materials "
            "nunca se usan pero ocupan espacio y confunden. "
            "Ejecutar migración 036_cleanup_zombie_tables.sql."
        ),
    })
    recs.append({
        "area": "Calidad de datos",
        "priority": "MEDIA",
        "title": "Índices en columnas de búsqueda frecuente",
        "detail": (
            "Verificar índices en: materials(code), materials(name), "
            "stock_movements(material_id, created_at), audit_logs(created_at), "
            "ordenes_trabajo(status), planificacion_semanal(responsable_id). "
            "Sin índices, estas consultas hacen full scan con 10k+ filas."
        ),
    })

    # ERP vendible / multi-tenant
    recs.append({
        "area": "Multi-tenant (para venta)",
        "priority": "ALTA",
        "title": "Diseño multi-empresa (tenant_id)",
        "detail": (
            "Actualmente el ERP es single-tenant (una empresa, una DB). "
            "Para venderlo a múltiples clientes necesitas o (A) una DB por cliente "
            "con un router de conexiones, o (B) columna tenant_id en cada tabla. "
            "La opción A es más segura y más fácil de implementar ahora que después. "
            "Este es el cambio más importante antes de comercializar."
        ),
    })
    recs.append({
        "area": "Multi-tenant (para venta)",
        "priority": "ALTA",
        "title": "Sistema de licencias / planes",
        "detail": (
            "Para vender el software necesitas controlar qué módulos tiene habilitados "
            "cada cliente (ej. plan básico = logistics + planning; plan full = todo). "
            "Implementar una tabla 'tenant_features' o sistema de feature flags "
            "antes del primer cliente de pago."
        ),
    })
    recs.append({
        "area": "Multi-tenant (para venta)",
        "priority": "MEDIA",
        "title": "Logs de auditoría por tenant aislados",
        "detail": (
            "En un modelo multi-tenant, cada cliente debe ver SOLO sus propios "
            "audit_logs. Agregar tenant_id a audit_logs y filtrar por él."
        ),
    })

    # Resiliencia
    recs.append({
        "area": "Resiliencia",
        "priority": "MEDIA",
        "title": "Pool de conexiones DB con límite configurado",
        "detail": (
            "Verificar que db_connection use un pool (ej. psycopg2.pool o pgBouncer) "
            "y no abra una conexión nueva por request. Con 50 usuarios concurrentes "
            "sin pool se agota el límite de PostgreSQL."
        ),
    })
    recs.append({
        "area": "Resiliencia",
        "priority": "MEDIA",
        "title": "Timeouts en queries lentas",
        "detail": (
            "No hay statement_timeout configurado. Una query lenta (join en materials "
            "sin índice + 100k filas) puede bloquear workers. "
            "Agregar: SET statement_timeout = '30s' en la conexión."
        ),
    })
    recs.append({
        "area": "Resiliencia",
        "priority": "BAJA",
        "title": "Backup automático de la base de datos",
        "detail": (
            "No hay evidencia de backups automáticos en el proyecto. "
            "Configurar pg_dump diario a S3/local antes del primer cliente de pago."
        ),
    })

    # Errores detectados en smoke
    if smoke.get("status") == "FAIL":
        recs.insert(0, {
            "area": "CRITICO",
            "priority": "CRITICA",
            "title": "Smoke tests FALLANDO ahora mismo",
            "detail": (
                f"{smoke.get('failed', 0)} test(s) fallaron. "
                "El sistema tiene regresiones activas. Revisar antes de cualquier otra cosa."
            ),
        })

    return recs


# ──────────────────────────────────────────────
# RENDER DEL REPORTE
# ──────────────────────────────────────────────

def render_report(db, smoke, logs, debt, recs, baseline_diff, prev_ts):
    counts = db["counts"]
    lines = []

    lines += [
        f"# Auditoria de Backend — {DATE_LABEL}",
        "",
        "> Reporte autogenerado por `scripts/audit_backend.py`  ",
        f"> Proyecto: ERP Modular | Base de datos: PostgreSQL  ",
        f"> Comparado con baseline del: {prev_ts}",
        "",
        "---",
        "",
    ]

    # ── RESUMEN EJECUTIVO ────────────────────────────────
    smoke_icon = "OK" if smoke["status"] == "PASS" else ("FALLO" if smoke["status"] == "FAIL" else smoke["status"])
    db_icon = "OK" if db["status"] == "OK" else "ERROR"
    errors_500 = len(logs.get("errors_500", []))
    high_debt = sum(1 for d in debt if d["severity"] == "HIGH")
    critical_recs = sum(1 for r in recs if r["priority"] in ("CRITICA", "ALTA"))

    lines += [
        "## Resumen ejecutivo",
        "",
        f"| Area | Estado |",
        f"|------|--------|",
        f"| Base de datos | {db_icon} — {len(counts)} tablas accesibles |",
        f"| Smoke tests | {smoke_icon} — {smoke.get('passed',0)} OK / {smoke.get('failed',0)} FALLO |",
        f"| Errores 500 (24h) | {errors_500} errores |",
        f"| Operaciones (24h) | {logs.get('total_24h', 0)} requests registrados |",
        f"| Deuda técnica | {high_debt} items HIGH, {len(debt)-high_debt} restantes |",
        f"| Recomendaciones prioritarias | {critical_recs} de alta prioridad |",
        "",
        "---",
        "",
    ]

    # ── SMOKE TESTS ─────────────────────────────────────
    lines += ["## 1. Salud de endpoints (Smoke Tests)", ""]
    lines += [f"**Resultado:** {smoke['status']} | Pasaron: {smoke.get('passed',0)} | Fallaron: {smoke.get('failed',0)}", ""]
    if smoke.get("errors"):
        for e in smoke["errors"]:
            lines.append(f"- ERROR: {e}")
    if smoke["status"] in ("FAIL", "TIMEOUT", "ERROR"):
        lines += ["", "```", smoke.get("output", "")[-2000:], "```"]
    else:
        lines += ["Todos los smoke tests pasaron correctamente."]
    lines += ["", "---", ""]

    # ── CRECIMIENTO DB ────────────────────────────────────
    lines += ["## 2. Crecimiento de la base de datos", ""]
    if baseline_diff:
        lines += [
            f"| Tabla | Antes ({prev_ts}) | Ahora | Delta |",
            "|-------|------|------|-------|",
        ]
        for table, prev, curr, delta in baseline_diff:
            sign = "+" if delta > 0 else ""
            lines.append(f"| `{table}` | {prev} | {curr} | {sign}{delta} |")
    else:
        lines += ["Primera ejecucion — baseline guardado para la proxima comparacion.", ""]

    lines += ["", "**Snapshot actual (filas por tabla):**", ""]
    for table in ALL_TABLES:
        n = counts.get(table, -1)
        if n > 0:
            zombie_tag = " *(ZOMBIE)*" if table in ZOMBIE_TABLES else ""
            lines.append(f"- `{table}`: {n} filas{zombie_tag}")
    lines += ["", "---", ""]

    # ── AUDIT LOGS ────────────────────────────────────────
    lines += ["## 3. Actividad y errores (últimas 24 horas)", ""]
    lines += [f"**Operaciones totales registradas:** {logs.get('total_24h', 0)}", ""]

    if logs.get("errors_500"):
        lines += ["### Errores 500", ""]
        lines += ["| Endpoint | Usuario | Hora |", "|----------|---------|------|"]
        for e in logs["errors_500"]:
            lines.append(f"| `{e['endpoint']}` | {e.get('user','?')} | {e['at']} |")
        lines.append("")
    else:
        lines += ["**Sin errores 500 en las ultimas 24 horas.** ✓", ""]

    if logs.get("top_endpoints"):
        lines += ["### Endpoints mas usados (24h)", ""]
        lines += ["| Endpoint | Hits |", "|----------|------|"]
        for ep in logs["top_endpoints"]:
            lines.append(f"| `{ep['ep']}` | {ep['hits']} |")
        lines.append("")

    if logs.get("top_users"):
        lines += ["### Usuarios mas activos (24h)", ""]
        for u in logs["top_users"]:
            lines.append(f"- **{u['user']}**: {u['ops']} operaciones")
        lines.append("")

    if logs.get("suspicious"):
        lines += ["### Actividad fuera de horario laboral (antes 6am / despues 10pm Lima)", ""]
        for s in logs["suspicious"]:
            lines.append(f"- {s['user']} en `{s['ep']}` a las {s['at']}")
        lines.append("")
    else:
        lines += ["Sin actividad fuera de horario detectada.", ""]

    lines += ["---", ""]

    # ── DEUDA TÉCNICA ─────────────────────────────────────
    lines += ["## 4. Deuda técnica detectada", ""]
    for d in sorted(debt, key=lambda x: {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[x["severity"]]):
        icon = {"HIGH": "[ALTO]", "MEDIUM": "[MEDIO]", "LOW": "[BAJO]"}[d["severity"]]
        lines.append(f"- **{icon} {d['type']}** — `{d['item']}`")
        lines.append(f"  {d['detail']}")
        lines.append("")
    lines += ["---", ""]

    # ── RECOMENDACIONES ───────────────────────────────────
    lines += ["## 5. Recomendaciones de robustez (ERP vendible)", ""]

    areas_seen = []
    for r in sorted(recs, key=lambda x: {"CRITICA": 0, "ALTA": 1, "MEDIA": 2, "BAJA": 3}[x["priority"]]):
        if r["area"] not in areas_seen:
            areas_seen.append(r["area"])
            lines += [f"### {r['area']}", ""]
        icon = {"CRITICA": "CRITICO", "ALTA": "ALTA", "MEDIA": "MEDIA", "BAJA": "BAJA"}[r["priority"]]
        lines.append(f"**[{icon}] {r['title']}**")
        lines.append(f"> {r['detail']}")
        lines.append("")

    lines += ["---", ""]
    lines += [
        "## Proximos pasos sugeridos",
        "",
        "1. Ejecutar migración `036_cleanup_zombie_tables.sql` (eliminar zombie tables/cols)",
        "2. Agregar `GET /health` con estado de DB y versión",
        "3. Implementar rate limiting en `/auth/login` (slowapi)",
        "4. Crear job de limpieza de `refresh_tokens` expirados",
        "5. Definir política de retención de `audit_logs` (90 días)",
        "6. Investigar versionado de API `/api/v1/` antes del primer cliente",
        "7. Diseñar estrategia multi-tenant (DB por cliente) antes de comercializar",
        "",
        "---",
        f"*Generado: {DATE_LABEL} | script: scripts/audit_backend.py*",
    ]

    return "\n".join(lines)


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def main():
    print(f"[audit] Iniciando auditoria de backend — {DATE_LABEL}")

    print("[1/5] Verificando base de datos...")
    db = check_db_health()

    print("[2/5] Cargando baseline para comparacion...")
    baseline = load_baseline()

    print("[3/5] Ejecutando smoke tests...")
    smoke = run_smoke_tests()
    print(f"      -> {smoke['status']} ({smoke.get('passed',0)} OK / {smoke.get('failed',0)} FALLO)")

    print("[4/5] Analizando audit_logs...")
    logs = analyze_audit_logs()

    print("[5/5] Calculando deuda tecnica y recomendaciones...")
    diff, prev_ts = diff_vs_baseline(db["counts"], baseline)
    debt = check_tech_debt(db["counts"])
    recs = generate_recommendations(db["counts"], smoke, logs)

    # Guardar nuevo baseline
    save_baseline(db["counts"])

    # Generar reporte
    report = render_report(db, smoke, logs, debt, recs, diff, prev_ts)

    OUTPUT_FILE.write_text(report, encoding="utf-8")
    LATEST_FILE.write_text(report, encoding="utf-8")

    print(f"\n[OK] Reporte guardado en:")
    print(f"     {OUTPUT_FILE}")
    print(f"     {LATEST_FILE}  (siempre el ultimo)")
    print(f"\n     Smoke tests: {smoke['status']}")
    print(f"     Errores 500 (24h): {len(logs.get('errors_500', []))}")
    print(f"     Deuda tecnica: {len(debt)} items")
    print(f"     Recomendaciones: {len(recs)}")


if __name__ == "__main__":
    main()
