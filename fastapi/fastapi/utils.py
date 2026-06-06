"""Fix generate_unique_id producing duplicates (issue 764).
"""
import hashlib
import uuid

_seen: set[str] = set()

def generate_unique_id(route_class: type) -> str:
    base = f"{route_class.__module__}.{route_class.__name__}"
    if base in _seen:
        base += "." + uuid.uuid4().hex[:8]
    _seen.add(base)
    digest = hashlib.sha256(base.encode()).hexdigest()[:8]
    return base + "." + digest
