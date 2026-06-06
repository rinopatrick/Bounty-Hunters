"""
Tests for DynamicCORSMiddleware.
"""

from __future__ import annotations

import pytest
from starlette.applications import Starlette  # type: ignore[import-untyped]
from starlette.middleware import Middleware  # type: ignore[import-untyped]
from starlette.testclient import TestClient  # type: ignore[import-untyped]

from fastapi.fastapi.middleware.cors import DynamicCORSMiddleware, cors_max_age


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

_ALLOW_ALL: dict[str, bool] = {}
_DENY_ALL: dict[str, bool] = {}


def _allowed(origin: str) -> bool:
    return True


def _denied(origin: str) -> bool:
    return False


def _app(*, allow_origin_func=_allowed, **kwargs):
    app = Starlette(routes=[], middleware=[])
    app.add_middleware(
        DynamicCORSMiddleware,
        allow_origin_func=allow_origin_func,
        **kwargs,
    )
    return app


def _client(app: Starlette) -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


# ------------------------------------------------------------------
# cors_max_age
# ------------------------------------------------------------------

@pytest.mark.parametrize("value, expected", [
    (600, "600"),
    ("1200", "1200"),
])
def test_cors_max_age(value, expected):
    assert cors_max_age(value) == expected


# ------------------------------------------------------------------
# Dynamic mode
# ------------------------------------------------------------------

class TestDynamicAllowDeny:
    def test_allow_all_origins_sets_cors_headers(self):
        app = _app()
        client = _client(app)

        resp = client.get("/", headers={"Origin": "https://evil.com"})
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "https://evil.com"
        assert "access-control-allow-credentials" in resp.headers

    def test_deny_origin_omits_cors_headers(self):
        app = _app(allow_origin_func=_denied)
        client = _client(app)

        resp = client.get("/", headers={"Origin": "https://evil.com"})
        assert resp.status_code == 200
        assert "access-control-allow-origin" not in resp.headers


class TestAsyncCallback:
    @pytest.mark.asyncio
    async def test_async_allow_func_is_awaited(self):
        calls: list[str] = []

        async def async_allowed(origin: str) -> bool:
            calls.append(origin)
            return True

        app = _app(allow_origin_func=async_allowed)
        client = _client(app)

        resp = client.get("/", headers={"Origin": "https://example.com"})
        assert resp.status_code == 200
        assert "https://example.com" in calls


class TestStaticFallback:
    def test_fallback_to_static_origins_when_no_func(self):
        app = _app(allow_origins=["https://trusted.com"])
        client = _client(app)

        resp = client.get("/", headers={"Origin": "https://trusted.com"})
        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin") == "https://trusted.com"


class TestMaxAge:
    def test_cors_max_age_header_set(self):
        app = _app(max_age=900)
        client = _client(app)

        resp = client.options("/", headers={"Origin": "https://evil.com"})
        assert resp.headers.get("access-control-max-age") == "900"
