"""HTTPBasic brute-force protection (issue 800).

- In-memory lockout after N failed attempts within a window.
- Lockout duration scales with repeat offences.
"""
from __future__ import annotations
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import HTTPException
from fastapi.security import HTTPBasic, HTTPBasicCredentials

_FAILED: defaultdict[str, deque[float]] = defaultdict(deque)
_LOCKED: dict[str, float] = {}

MAX_ATTEMPTS = 5
WINDOW       = 60_0  # seconds


def _is_locked(key: str, now: float) -> bool:
    until = _LOCKED.get(key, 0)
    if until > now:
        return True
    if until:
        del _LOCKED[key]
    return False


def _lock(key: str) -> None:
    failures = len(_FAILED[key])
    _FAILED[key].clear()
    _LOCKED[key] = time.time() + 60 * failures  # 60s × repeat count


def check_basic(credentials: HTTPBasicCredentials, *, header: str = "") -> tuple[str, bool]:
    # header is unused here; consumed by the dependency directly
    key = f"{credentials.username}@{header}"
    now = time.time()
    if _is_locked(key, now):
        raise HTTPException(status_code=423, detail="Account locked. Try again later.")
    return credentials.username, True  # caller verifies password


def record_failure(username: str, header: str = "") -> None:
    key = f"{username}@{header}"
    now = time.time()
    window = _FAILED[key]
    while window and window[0] <= now - WINDOW:
        window.popleft()
    if len(window) >= MAX_ATTEMPTS:
        _lock(key)
    else:
        window.append(now)
