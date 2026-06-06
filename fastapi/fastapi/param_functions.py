"""Request-scoped dependency caching — issue 795.
"""
import hashlib
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])
_caches: dict[str, Any] = {}

def cache_key(fn: Callable[..., Any]) -> str:
    return hashlib.sha256(fn.__name__.encode()).hexdigest()[:16]

def cached_dep(fn: Callable[..., Any]) -> Callable[..., Any]:
    k = cache_key(fn)
    return _caches[k] if k in _caches else (_caches.setdefault(k, fn()), _caches[k])[1]
