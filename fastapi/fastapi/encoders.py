"""Fix jsonable_encoder TypeError on bytes (issue 759).
"""
import base64
from typing import Any

def safe_encoder(obj: Any) -> Any:
    if isinstance(obj, bytes):  return base64.b64encode(obj).decode()
    if isinstance(obj, dict):   return {k: safe_encoder(v) for k, v in obj.items()}
    if isinstance(obj, list):   return [safe_encoder(v) for v in obj]
    return obj
