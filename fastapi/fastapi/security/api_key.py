"""API key authentication with rate limiting and deprecated-key warnings.

Patched for issue 768:
- APIKeyWithRateLimit: extends APIKeyHeader with sliding-window per-key rate-limit
  and ``deprecated_keys`` warning header.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Annotated, Any, Self

from fastapi import HTTPException
from starlette.requests import Request

from fastapi.background import APIKeyHeader  # type: ignore[attr-defined]


class APIKeyWithRateLimit(APIKeyHeader):
    """Rate-limiting wrapper around :class:`APIKeyHeader`.

    Parameters
    ----------
    name : str
        Header name holding the API key.
    scheme_name : str | None
        Scheme name for OpenAPI docs.
    auto_error : bool
    allow_invalid_key : bool
        Return ``None`` rather than raising on invalid key.
    rate_limit : str
        e.g. ``"100/minute"`` or ``"1000/hour"``.
    deprecated_keys : list[str] | None
        Keys that still authenticate but trigger a `DeprecationWarning` header.
    """

    def __init__(
        self,
        *,
        name             : str              = "X-API-Key",
        scheme_name      : str | None       = None,
        auto_error       : bool             = True,
        allow_invalid_key: bool             = False,
        rate_limit       : str              = "100/minute",
        deprecated_keys  : list[str] | None = None,
    ) -> None:
        super().__init__(
            name=name,
            scheme_name=scheme_name,
            auto_error=auto_error,
            allow_invalid_key=allow_invalid_key,
        )
        self.deprecated_keys = deprecated_keys or []
        count_str, period = rate_limit.split("/", 1)
        self.max_per_period = int(count_str)
        self.period = period  # "second" | "minute" | "hour"
        self._locks: dict[str, deque[float]] = defaultdict(deque)

    def _period_seconds(self) -> int:
        return {"second": 1, "minute": 60, "hour": 3600}[self.period]

    def _prune(self, key: str, now: float) -> None:
        window    = self._locks[key]
        cutoff    = now - self._period_seconds()
        while window and window[0] <= cutoff:
            window.popleft()

    def _rate_ok(self, key: str, now: float) -> bool:
        self._prune(key, now)
        return len(self._locks[key]) < self.max_per_period

    def __call__(self, request: Request) -> str | None:
        key = super().__call__(request)
        if key is None:
            return key
        now = time.time()
        if not self._rate_ok(key, now):
            raise HTTPException(
                status_code=429,
                headers={"Retry-After": str(self._period_seconds())},
                detail="Too many API requests.",
            )
        self._locks[key].append(now)
        if key in self.deprecated_keys:
            request.state.deprecated_api_key = True
        return key
