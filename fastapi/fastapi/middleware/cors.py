"""
Dynamic CORS middleware for FastAPI / Starlette applications.

Unlike the built-in Starlette CORSMiddleware which uses a static allow_origins
list, DynamicCORSMiddleware calls a user-provided callback on every pre-flight
and actual request so that the decision to accept or reject a particular Origin
header can depend on runtime state (database look-up, token claims, etc.).
"""

from __future__ import annotations

import asyncio
import logging
import warnings
from typing import Callable, Optional, Sequence, Union

from starlette.middleware.cors import CORSMiddleware  # type: ignore[import-untyped]
from starlette.requests import Request  # type: ignore[import-untyped]
from starlette.responses import JSONResponse, Response  # type: ignore[import-untyped]

logger = logging.getLogger("fastapi.middleware.cors_dynamic")

__all__ = ["DynamicCORSMiddleware", "cors_max_age"]


def cors_max_age(value: int | str = 600) -> str:
    """Return a formatted CORS-Max-Age header string."""
    return str(int(value))


class DynamicCORSMiddleware(CORSMiddleware):
    """
    CORSMiddleware subclass that evaluates each request Origin via a callback.

    Parameters
    ----------
    allow_origin_func:
        ``Callable[[str], bool | Awaitable[bool]]`` – called for every
        actual request.  Returns True to accept, False to deny.
    allow_origins:
        Optional static fallback allow-list used when *allow_origin_func*
        is ``None``.
    allow_methods / allow_headers / expose_headers / allow_credentials / max_age:
        Passed through to the parent :class:`CORSMiddleware`.
    """

    def __init__(
        self,
        app,
        *,
        allow_origin_func: Optional[Callable[[str], Union[bool, "asyncio.Future[bool]"]]] = None,
        allow_origins: Optional[Sequence[str]] = None,
        allow_methods: Sequence[str] = ("GET",),
        allow_headers: Sequence[str] = ("*",),
        expose_headers: Sequence[str] = (),
        allow_credentials: bool = False,
        max_age: int | str = 600,
    ) -> None:
        if allow_origin_func is None and allow_origins is None:
            warnings.warn(
                "Neither allow_origin_func nor allow_origins was provided. "
                "The middleware will allow no origins.",
                stacklevel=2,
            )
        super().__init__(
            app,
            allow_origins=allow_origins or [],     # type: ignore[arg-type]
            allow_methods=allow_methods,
            allow_headers=allow_headers,
            expose_headers=expose_headers,
            allow_credentials=allow_credentials,
            max_age=max_age,
        )
        self._allow_origin_func = allow_origin_func

    # ---- helpers --------------------------------------------------------
    async def _call_func(self, origin: str) -> bool:
        """Call *allow_origin_func*, awaiting if it returns a coroutine."""
        result = self._allow_origin_func(origin)  # type: ignore[misc]
        if asyncio.iscoroutine(result):
            result = await result
        return bool(result)

    def _is_dynamic_mode(self) -> bool:
        return self._allow_origin_func is not None

    # ---- preflight response ---------------------------------------------
    async def _preflight_response(  # type: ignore[override]
        self, request_origin: Optional[str], request_method: Optional[str]
    ) -> Optional[Response]:
        if not self._is_dynamic_mode():
            return await super()._preflight_response(request_origin, request_method)

        if not request_origin:
            return None

        allowed = await self._call_func(request_origin)
        if not allowed:
            return None

        headers: dict[str, str] = dict(self.simple_headers)
        headers.update(self.preflight_headers)  # type: ignore[attr-defined]
        return Response(headers=headers, status_code=200)

    # ---- actual-request handler -----------------------------------------
    async def __call__(self, scope, receive, send):  # noqa: ANN001
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        origin = request.headers.get("origin")

        # ── Dynamic mode ─────────────────────────────────────────────────
        if self._is_dynamic_mode():
            if origin:
                allowed = await self._call_func(origin)
                if not allowed:
                    # Let the request through but without CORS headers;
                    # browsers will block the response front-end.
                    await self.app(scope, receive, send)
                    return

                # Build CORS response headers and re-call downstream.
                response_headers: dict[str, str] = dict(self.simple_headers)
                response_headers.update(self.allow_screen_headers)  # type: ignore[attr-defined]

                async def send_with_origin(message):
                    if message["type"] == "http.response.start":
                        message.setdefault("headers", [])
                        for k, v in response_headers.items():
                            message["headers"].append(
                                (k.lower().encode("latin-1"), v.encode("latin-1"))
                            )
                    await send(message)

                await self.app(scope, receive, send_with_origin)
                return

            await self.app(scope, receive, send)
            return

        # ── Static mode (parent behaviour) ───────────────────────────────
        await super().__call__(scope, receive, send)
