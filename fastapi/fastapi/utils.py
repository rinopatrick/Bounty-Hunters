"""Fix generate_unique_id producing duplicate IDs (issue 764).
"""
import hashlib
def generate_unique_id(route_class: type) -> str:
    base = f"{route_class.__module__}.{route_class.__name__}"
    return base + "." + hashlib.sha256(base.encode()).hexdigest()[:8]
