"""BackgroundTasks — error handling with retry."""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from collections.abc import Awaitable, Callable
from typing import Any, Optional

logger = logging.getLogger("fastapi.background")

_TaskResult = tuple[bool, Optional[str], Optional[BaseException]]


class BackgroundTasks:
    """Background task runner with error handling and optional retries."""

    def __init__(self, error_callback: Optional[Callable[[Exception, str], None]] = None) -> None:
        self._tasks: list[tuple[Callable[..., Any], tuple[Any, ...], dict[str, Any], int]] = []
        self._results: list[_TaskResult] = []
        self.error_callback = error_callback

    def add_task(
        self,
        func: Callable[..., Any],
        *args: Any,
        max_retries: int = 0,
        **kwargs: Any,
    ) -> None:
        self._tasks.append((func, args, kwargs, max_retries))

    def __call__(self) -> None:
        for func, args, kwargs, max_retries in self._tasks:
            self._run_task(func, args, kwargs, max_retries)

    def _run_task(self, func: Callable[..., Any], args: tuple, kwargs: dict, max_retries: int) -> None:
        last_exc: Optional[BaseException] = None
        for attempt in range(max_retries + 1):
            try:
                if asyncio.iscoroutinefunction(func):
                    asyncio.get_event_loop().run_until_complete(func(*args, **kwargs))
                else:
                    func(*args, **kwargs)
                self._results.append((True, func.__name__, None))
                return
            except Exception as exc:
                last_exc = exc
                logger.error(
                    "Background task %s failed (attempt %d/%d): %s",
                    func.__name__, attempt + 1, max_retries + 1, traceback.format_exc(),
                )
                if self.error_callback:
                    try:
                        self.error_callback(exc, func.__name__)
                    except Exception:
                        pass
        self._results.append((False, func.__name__, last_exc))

    @property
    def task_results(self) -> list[_TaskResult]:
        return list(self._results)
