"""Request-scoped dependency caching (issue 795)."""
from __future__ import annotations
import hashlib
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

_caches: dict[str, Any] = {}


def cache_key(fn: Callable[..., Any]) -> str:
    return hashlib.sha256(fn.__name__.encode()).hexdigest()[:16]


def cached_dep(fn: Callable[..., Any]) -> Callable[..., Any]:
    k = cache_key(fn)
    if k not in _caches:
        _caches[k] = fn()
    return _caches[k]
