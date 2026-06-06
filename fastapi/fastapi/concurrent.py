"""Concurrent task runner with semaphore — issue 803.
"""
import asyncio
from typing import Any, Callable

async def run_concurrent(tasks: list[Callable[[], Any]], limit: int = 5) -> list[Any]:
    sem = asyncio.Semaphore(limit)
    async def run(fn):
        async with sem:
            r = fn(); return await r if asyncio.iscoroutine(r) else r
    return await asyncio.gather(*(run(t) for t in tasks))
