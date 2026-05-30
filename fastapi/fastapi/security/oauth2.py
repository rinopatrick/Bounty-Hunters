"""
OAuth2 helpers for FastAPI: Password Bearer with Refresh token support.

Extends the standard :class:`~fastapi.security.OAuth2PasswordBearer` to
support a ``refresh_url`` so that the OpenAPI schema exposes the token-refresh
endpoint alongside the standard Authorize button flow.
"""

from __future__ import annotations

import warnings
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi.exceptions import HTTPException
from starlette import status
from fastapi.security import OAuth2PasswordBearer  # type: ignore[attr-defined]
from fastapi.security.utils import (  # type: ignore[attr-defined]
    get_authorization_scheme_param,
)
from starlette.requests import Request  # type: ignore[import-untyped]

try:
    from pydantic import BaseModel  # type: ignore[import-untyped]
except ImportError:  # pragma: no cover
    BaseModel = None  # type: ignore[misc,assignment]


__all__ = [
    "OAuth2PasswordBearerWithRefresh",
    "OAuth2RefreshRequestForm",
]


# ---------------------------------------------------------------------------
# Refresh-request form
# ---------------------------------------------------------------------------

class OAuth2RefreshRequestForm:
    """Form data for the OAuth2 refresh-token flow.

    Expects ``grant_type=refresh_token`` and a ``refresh_token`` field.
    """

    def __init__(
        self,
        grant_type: str,
        refresh_token: Optional[str] = None,
        scope: Optional[str] = None,
    ) -> None:
        self.grant_type = grant_type
        self.refresh_token = refresh_token
        self.scopes: List[str] = scope.split() if scope else []

        if grant_type != "refresh_token":
            raise ValueError(
                f'Invalid grant_type: expected "refresh_token", got "{grant_type}".'
            )

    @classmethod
    def as_form(
        cls,
        grant_type: str = "password",   # type: ignore[assignment]
        refresh_token: Optional[str] = None,
        scope: Optional[str] = "",
    ) -> "OAuth2RefreshRequestForm":
        return cls(grant_type=grant_type, refresh_token=refresh_token, scope=scope)

    def __repr__(self) -> str:
        return (
            f"OAuth2RefreshRequestForm(grant_type={self.grant_type!r}, "
            f"refresh_token={'***' if self.refresh_token else None!r}, "
            f"scopes={self.scopes!r})"
        )


# ---------------------------------------------------------------------------
# OAuth2PasswordBearer with refresh_url
# ---------------------------------------------------------------------------

class OAuth2PasswordBearerWithRefresh(OAuth2PasswordBearer):
    """
    Drop-in replacement for :class:`~fastapi.security.OAuth2PasswordBearer`
    that also accepts a ``refresh_url`` parameter.

    The ``refresh_url`` is propagated into the OpenAPI security scheme so
    that the OAuth2 Authorize / Token buttons work as expected.
    """

    def __init__(
        self,
        tokenUrl: str,
        *,
        scheme_name: Optional[str] = None,
        scopes: Optional[Dict[str, str]] = None,
        auto_error: bool = True,
        refresh_url: Optional[str] = None,
    ) -> None:
        model, _ = OAuth2PasswordBearer.get_openapi_connect_security_scheme(
            tokenUrl=tokenUrl,
            scopes=scopes or {},
        )
        if refresh_url:
            model["flows"]["refreshToken"] = {  # type: ignore[index]
                "tokenUrl": refresh_url,
                "scopes": scopes or {},
            }
        super().__init__(
            tokenUrl=tokenUrl,
            scheme_name=scheme_name,
            scopes=scopes,
            auto_error=auto_error,
        )
        self.refresh_url = refresh_url

    @staticmethod
    def get_openapi_connect_security_scheme(
        tokenUrl: str,
        scopes: Optional[Dict[str, str]] = None,
        refresh_url: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """Build the OpenAPI security scheme entry, including the refresh flow."""
        scopes = scopes or {}
        flows: Dict[str, Any] = {
            "password": {
                "scopes": scopes,
                "tokenUrl": tokenUrl,
            },
        }
        if refresh_url:
            flows["refreshToken"] = {
                "scopes": scopes,
                "tokenUrl": refresh_url,
            }
        result: Dict[str, Any] = {
            "type": "oauth2",
            "flows": flows,
        }
        return result, scopes

    async def __call__(self, request: Request) -> Optional[str]:
        authorization = request.headers.get("Authorization")
        if not authorization:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        scheme, credentials = get_authorization_scheme_param(authorization)
        if not credentials or scheme.lower() != "bearer":
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            return None
        return credentials
