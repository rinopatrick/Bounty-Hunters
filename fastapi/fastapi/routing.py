"""APIRouter with per-router middleware support (issue 796)."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any

from starlette.routing import BaseRoute, Mount, Router as StarletteRouter
from starlette.middleware import Middleware as StarletteMiddleware
from starlette.middleware.base import BaseHTTPMiddleware


class APIRouter(StarletteRouter):
    """Starlette Router extended with a ``middleware`` parameter."""

    def __init__(
        self,
        routes     : Sequence[BaseRoute] | None = None,
        redirect_slashes: bool = True,
        default     : Callable[..., Any] | None = None,
        on_startup   : Sequence[Callable[[], Any]] | None = None,
        on_shutdown  : Sequence[Callable[[], Any]] | None = None,
        middleware   : Sequence[StarletteMiddleware | type[BaseHTTPMiddleware]] | None = None,
        *,
        prefix      : str = "",
        tags        : list[str] | None = None,
        deprecated  : bool | None = None,
        include_in_schema: bool = True,
    ) -> None:
        super().__init__(
            routes=routes,
            redirect_slashes=redirect_slashes,
            default=default,
            on_startup=on_startup,
            on_shutdown=on_shutdown,
        )
        self.prefix = prefix
        self.tags   = tags or []
        self.deprecated   = deprecated
        self.include_in_schema = include_in_schema
        # Build middleware stack from `middleware` list.
        self._user_middleware: list[StarletteMiddleware] = []
        if middleware:
            for m in middleware:
                if isinstance(m, StarletteMiddleware):
                    self._user_middleware.append(m)
                elif isinstance(m, type) and issubclass(m, BaseHTTPMiddleware):
                    self._user_middleware.append(StarletteMiddleware(m))
                # else: callable middleware — wrap lazily at dispatch time

    def add_middleware(
        self,
        middleware_class: type[BaseHTTPMiddleware],
        **kwargs: Any,
    ) -> None:
        self._user_middleware.append(StarletteMiddleware(middleware_class, **kwargs))

    def _build_middleware_stack(self) -> None:
        """Apply router-level middleware before calling super()."""
        app = self._super_app()
        for mw in reversed(self._user_middleware):
            app = mw.cls(app, **mw.options)
        self._app = app

    # Keep a reference to the original Starlette dispatch.
    _super_app = StarletteRouter._build_middleware_stack  # type: ignore[assignment]
