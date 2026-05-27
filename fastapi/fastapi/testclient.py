"""FastAPITestClient: convenience test client with auth helpers.

Patched for issue 804:
- auth_as(user): sets Authorization header from user.token
- auth_as_service(service_account): same, for service accounts
- auth_as_none(): clears auth headers
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient as _TestClient
from httpx import ASGITransport

from fastapi.security.http import HTTPBasic, HTTPBasicCredentials  # type: ignore


class FastAPITestClient(_TestClient):
    """TestClient extended with auth helpers."""

    def __init__(self, app: FastAPI, **kw: Any) -> None:
        super().__init__(app, transport=ASGITransport(app=app), **kw)

    def auth_as(self, token: str, scheme: str = "Bearer") -> None:
        self.headers["Authorization"] = f"{scheme} {token}"

    def auth_as_service(self, service_token: str) -> None:
        self.auth_as(service_token, "Service")

    def auth_as_none(self) -> None:
        self.headers.pop("Authorization", None)
