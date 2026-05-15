"""TLS handshake utilities — patched for issues 569–573."""
from __future__ import annotations

from hmac import compare_digest
import hashlib

# Valid state machine transitions (issue 569).
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


# Safe comparison for MAC verification (issue 571).
def safe_compare(a: bytes, b: bytes) -> bool:
    return compare_digest(a, b)


class HandshakeError(Exception):
    """Base handshake error — fixes bare except (issue 572)."""


def verify_transition(current: str, next_state: str) -> None:
    if not transition(current, next_state):
        raise HandshakeError(f"Invalid transition: {current} -> {next_state}")
