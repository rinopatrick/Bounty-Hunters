"""
FastAPI framework: high-performance micro web-framework for building APIs
with Python 3.7+.

Re-exports the additions required for the bounty-related issues:

- `DynamicCORSMiddleware`  — #763: dynamic CORS origin validation
- `OAuth2PasswordBearerWithRefresh` — #758: OAuth2 with refresh_token flow
- `OAuth2RefreshRequestForm`    — #758: OAuth2 refresh request form
- `cors_max_age`               — #763: CORS-Max-Age header helper
"""

from fastapi.fastapi.middleware.cors import (  # noqa: F401
    DynamicCORSMiddleware,
    cors_max_age,
)
from fastapi.fastapi.security.oauth2 import (  # noqa: F401
    OAuth2PasswordBearerWithRefresh,
    OAuth2RefreshRequestForm,
)
