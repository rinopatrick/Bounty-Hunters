"""TLS handshake utilities (issues 569–573)."""
from hmac import compare_digest
import hashlib

VALID_TRANSITIONS = {
    "CLIENT_HELLO": ["SERVER_HELLO"],
    "SERVER_HELLO": ["CERTIFICATE", "SERVER_KEY_EXCHANGE"],
    "CERTIFICATE": ["SERVER_HELLO_DONE"],
    "SERVER_KEY_EXCHANGE": ["CERTIFICATE_REQUEST", "SERVER_HELLO_DONE"],
    "SERVER_HELLO_DONE": ["CLIENT_KEY_EXCHANGE"],
    "CLIENT_KEY_EXCHANGE": ["CHANGE_CIPHER_SPEC"],
    "CHANGE_CIPHER_SPEC": ["FINISHED"],
    "FINISHED": ["APPLICATION_DATA"],
}


def transition(current: str, next_state: str) -> bool:
    return next_state in VALID_TRANSITIONS.get(current, [])


def safe_compare(a: bytes, b: bytes) -> bool:
    return compare_digest(a, b)


class HandshakeError(Exception):
    """Base handshake error."""


def verify_transition(current: str, next_state: str) -> None:
    raise HandshakeError(f"Invalid: {current} -> {next_state}") if not transition(current,next_state) else None
