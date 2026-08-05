"""Bloqueo incremental de login por usuario.

F-000 / T-14 — el límite de slowapi es POR IP y frena la fuerza bruta ruidosa.
Este módulo añade la otra mitad: un contador POR USUARIO que sobrevive al
cambio de IP, así que un ataque distribuido contra una cuenta concreta también
se frena.

Tras `LOGIN_MAX_FAILED_ATTEMPTS` fallos, cada intento adicional duplica la
espera (60 s → 120 s → 240 s...), con un techo de 15 minutos para que un
atacante no pueda dejar a un usuario legítimo bloqueado indefinidamente.
Un login correcto borra el contador.

LIMITACIÓN CONOCIDA: el estado vive en memoria del proceso. En el plan gratuito
de Render hay una sola instancia y esto funciona; al escalar a varias habrá que
mover el contador a la base de datos o a Redis. El límite por IP de slowapi
tiene exactamente la misma limitación.
"""
import threading
import time

from app.core.config import settings

TECHO_SEGUNDOS = 15 * 60

# usuario -> (nº de fallos, momento en que expira el bloqueo)
_intentos: dict[str, tuple[int, float]] = {}
_lock = threading.Lock()

# Se purga cada tanto para que el diccionario no crezca sin límite con
# usuarios inventados por un atacante.
_INTERVALO_PURGA = 600
_ultima_purga = time.monotonic()


def _normalizar(username: str) -> str:
    return (username or "").strip().lower()


def _purgar(ahora: float) -> None:
    """Elimina las entradas cuyo bloqueo ya venció hace rato. Requiere el lock."""
    global _ultima_purga
    if ahora - _ultima_purga < _INTERVALO_PURGA:
        return
    caducadas = [u for u, (_, hasta) in _intentos.items() if hasta + TECHO_SEGUNDOS < ahora]
    for usuario in caducadas:
        del _intentos[usuario]
    _ultima_purga = ahora


def segundos_de_bloqueo(username: str) -> int:
    """Segundos que faltan para poder reintentar. 0 = no está bloqueado."""
    usuario = _normalizar(username)
    if not usuario:
        return 0
    ahora = time.monotonic()
    with _lock:
        registro = _intentos.get(usuario)
        if not registro:
            return 0
        _fallos, hasta = registro
        restante = hasta - ahora
    return int(restante) + 1 if restante > 0 else 0


def registrar_fallo(username: str) -> int:
    """Suma un fallo. Devuelve los segundos de bloqueo resultantes (0 si aún no bloquea)."""
    usuario = _normalizar(username)
    if not usuario:
        return 0

    ahora = time.monotonic()
    with _lock:
        _purgar(ahora)
        fallos, _hasta = _intentos.get(usuario, (0, 0.0))
        fallos += 1

        excedente = fallos - settings.LOGIN_MAX_FAILED_ATTEMPTS
        if excedente < 0:
            _intentos[usuario] = (fallos, 0.0)
            return 0

        espera = min(settings.LOGIN_LOCKOUT_BASE_SECONDS * (2 ** excedente), TECHO_SEGUNDOS)
        _intentos[usuario] = (fallos, ahora + espera)
        return int(espera)


def registrar_exito(username: str) -> None:
    """Un login correcto limpia el historial de fallos del usuario."""
    usuario = _normalizar(username)
    if not usuario:
        return
    with _lock:
        _intentos.pop(usuario, None)


def reiniciar() -> None:
    """Vacía el estado. Sólo para los tests."""
    with _lock:
        _intentos.clear()
