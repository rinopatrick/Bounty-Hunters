from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger("fastapi.background")


class BackgroundTasks:
    """Background task runner with error handling.

    Patched for issue 760: add_task(max_retries=N), error_callback,
    task_results stored for later retrieval.
    """

    def __init__(
        self,
        *,
        max_retries  : int = 0,
        error_callback: Callable[[BaseException, str], None] | None = None,
    ) -> None:
        self.tasks: list[tuple[Callable[..., Any], tuple[Any, ...], dict[str, Any], int]] = []
        self.results: list[dict[str, Any]] = []
        self.max_retries  = max_retries
        self.error_callback = error_callback

    def add_task(
        self, func: Callable[..., Any], *args: Any, max_retries: int | None = None, **kwargs: Any,
    ) -> None:
        self.tasks.append((func, args, kwargs, max_retries if max_retries is not None else self.max_retries))

    def __call__(self) -> None:
        for func, args, kwargs, mrt in self.tasks:
            last: BaseException | None = None
            attempts = 0
            ok = False
            while attempts <= mrt:
                attempts += 1
                try:
                    if asyncio.iscoroutinefunction(func):
                        loop = asyncio.new_event_loop()
                        loop.run_until_complete(func(*args, **kwargs))
                        loop.close()
                    else:
                        func(*args, **kwargs)
                    ok = True
                    break
                except BaseException as exc:
                    last = exc
                    if self.error_callback:
                        try:
                            self.error_callback(exc, func.__name__)
                        except Exception:
                            pass
            self.results.append({
                "name": func.__name__,
                "ok": ok,
                "attempts": attempts,
                "exception": last,
            })

    @property
    def task_results(self):
        return list(self.results)

    def result(self, idx: int) -> dict | None:
        return self.results[idx] if 0 <= idx < len(self.results) else None

    def ok(self, idx: int) -> bool:
        r = self.result(idx)
        return bool(r and r.get("ok"))

    def exception(self, idx: int) -> BaseException | None:
        r = self.result(idx)
        return r.get("exception") if r else None
