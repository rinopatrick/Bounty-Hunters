"""Fix generate_unique_id duplicates — issue 764.
"""
import hashlib
import uuid

_seen: set[str] = set()

def generate_unique_id(route_class: type) -> str:
    base = f"{route_class.__module__}.{route_class.__name__}"
    base += "." + uuid.uuid4().hex[:8] if base in _seen else ""
    _seen.add(base)
    return base + "." + hashlib.sha256(base.encode()).hexdigest()[:8]
