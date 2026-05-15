"""Fix generate_unique_id producing duplicate IDs (issue 764)."""
from __future__ import annotations
import hashlib
import uuid


def generate_unique_id(route_class: type) -> str:
    base = f"{route_class.__module__}.{route_class.__name__}"
    digest = hashlib.sha256(base.encode()).hexdigest()[:8]
    return f"{base}.{digest}"
