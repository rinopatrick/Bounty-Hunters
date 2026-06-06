"""Concurrent task runner with semaphore (issue 803).
"""
import asyncio
from typing import Callable, Any
async def run_concurrent(tasks: list[Callable[[], Any]], limit: int = 5) -> list[Any]:
    sem = asyncio.Semaphore(limit)
    async def run(fn):
        async with sem:
            r = fn()
            if asyncio.iscoroutine(r): r = await r
            return r
    return await asyncio.gather(*(run(t) for t in tasks))
