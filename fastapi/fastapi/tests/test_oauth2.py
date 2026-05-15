"""
Tests for OAuth2PasswordBearerWithRefresh and OAuth2RefreshRequestForm.
"""

from __future__ import annotations

import pytest
from fastapi import FastAPI, Depends, Security  # type: ignore[import-untyped]
from fastapi.testclient import TestClient  # type: ignore[import-untyped]

from fastapi.fastapi.security.oauth2 import (
    OAuth2PasswordBearerWithRefresh,
    OAuth2RefreshRequestForm,
)


# ------------------------------------------------------------------
# OAuth2RefreshRequestForm
# ------------------------------------------------------------------

def test_parse_valid_refresh_token():
    form = OAuth2RefreshRequestForm(
        grant_type="refresh_token",
        refresh_token="my-token",
        scope="read write",
    )
    assert form.grant_type == "refresh_token"
    assert form.refresh_token == "my-token"
    assert form.scopes == ["read", "write"]


def test_rejects_invalid_grant_type():
    with pytest.raises(ValueError, match="Invalid grant_type"):
        OAuth2RefreshRequestForm(
            grant_type="password",
            refresh_token="my-token",
        )


def test_as_form_valid():
    form = OAuth2RefreshRequestForm.as_form(
        grant_type="refresh_token",
        refresh_token="tok123",
    )
    assert form.refresh_token == "tok123"


# ------------------------------------------------------------------
# OAuth2PasswordBearerWithRefresh
# ------------------------------------------------------------------

TEST_TOKEN_URL = "/auth/token"
TEST_REFRESH_URL = "/auth/refresh"

oauth2_scheme = OAuth2PasswordBearerWithRefresh(
    tokenUrl=TEST_TOKEN_URL,
    scopes={"read": "Read access", "write": "Write access"},
    refresh_url=TEST_REFRESH_URL,
)


class TestOAuth2PasswordBearerWithRefresh:
    def setup_method(self):
        self.app = FastAPI()

        @self.app.get("/me")
        async def read_me(token: str = Depends(oauth2_scheme)):
            return {"token": token}

        self.client = TestClient(self.app, raise_server_exceptions=False)

    def test_drop_in_replaces_standard_bearer(self):
        resp = self.client.get(
            "/me",
            headers={"Authorization": "Bearer my-secret-token"},
        )
        assert resp.status_code == 200
        assert resp.json()["token"] == "my-secret-token"

    def test_missing_token_returns_401_when_auto_error(self):
        resp = self.client.get("/me")
        assert resp.status_code == 401

    def test_returns_none_when_auto_error_disabled(self):
        loose = OAuth2PasswordBearerWithRefresh(
            tokenUrl=TEST_TOKEN_URL, auto_error=False,
        )
        app2 = FastAPI()

        @app2.get("/me")
        async def read_me(token: str | None = Depends(loose)):
            return {"token": token}

        client2 = TestClient(app2)
        resp = client2.get("/me")
        assert resp.status_code == 200
        assert resp.json()["token"] is None

    def test_refresh_url_appears_in_openapi_schema(self):
        @self.app.get("/openapi.json")
        def _openapi():
            return self.app.openapi()

        resp = self.client.get("/openapi.json")
        assert resp.status_code == 200
        schema = resp.json()
        flows = schema.get("components", {}).get("securitySchemes", {}).get(
            "oauth2", {}
        ).get("flows", {})
        assert "refreshToken" in flows
        assert flows["refreshToken"]["tokenUrl"] == TEST_REFRESH_URL
