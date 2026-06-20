"""Preferencias del usuario (incluye el tema de la interfaz).

SQL aislado del router (Art. 1 de la constitución). El tema vive en
users.preferencias->>'tema'. Guarda defensiva ante NULL.
"""
import json
from app.core.database import db_connection

TEMAS_VALIDOS = {
    "system",
    "zeit-claro",
    "zeit-oscuro",
    "zeit-oscuro-energia",
    "zeit-turquesa",
    "zeit-grafito",
}


def get_user_preferences(user_id) -> dict:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT preferencias FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
    prefs = row[0] if row and row[0] else {}
    if not isinstance(prefs, dict):
        prefs = {}
    return prefs


def update_user_preferences(user_id, patch: dict) -> dict:
    """Merge (no reemplaza todo el blob). Valida el tema si viene."""
    patch = patch or {}
    if "tema" in patch and patch["tema"] not in TEMAS_VALIDOS:
        raise ValueError(f"tema inválido: {patch['tema']}")

    actuales = get_user_preferences(user_id)
    actuales.update(patch)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET preferencias = %s::jsonb WHERE id = %s",
                (json.dumps(actuales), user_id),
            )
        conn.commit()
    return actuales
