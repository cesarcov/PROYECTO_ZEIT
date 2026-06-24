"""
Scheduler de tareas periódicas del backend.
Jobs registrados:
  - cleanup_refresh_tokens  : diario 02:00 — elimina tokens expirados/revocados
  - cleanup_audit_logs      : semanal domingo 03:00 — retención 90 días
"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.core.database import db_connection

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="America/Lima")


def cleanup_refresh_tokens():
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM refresh_tokens
                    WHERE expires_at < NOW()
                       OR revoked = TRUE
                """)
                deleted = cur.rowcount
            conn.commit()
        logger.info("[scheduler] cleanup_refresh_tokens: %d tokens eliminados", deleted)
    except Exception as e:
        logger.error("[scheduler] cleanup_refresh_tokens falló: %s", e)


def cleanup_audit_logs():
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM audit_logs
                    WHERE created_at < NOW() - INTERVAL '90 days'
                """)
                deleted = cur.rowcount
            conn.commit()
        logger.info("[scheduler] cleanup_audit_logs: %d registros eliminados (>90 días)", deleted)
    except Exception as e:
        logger.error("[scheduler] cleanup_audit_logs falló: %s", e)


def start_scheduler():
    scheduler.add_job(
        cleanup_refresh_tokens,
        CronTrigger(hour=2, minute=0),
        id="cleanup_refresh_tokens",
        replace_existing=True,
    )
    scheduler.add_job(
        cleanup_audit_logs,
        CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="cleanup_audit_logs",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("[scheduler] iniciado — refresh_tokens (diario 02:00) + audit_logs (dom 03:00)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
