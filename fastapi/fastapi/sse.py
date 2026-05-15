"""Server-Sent Events support for FastAPI."""

from __future__ import annotations

import asyncio
import time
import json
from dataclasses import field, dataclass
from typing import (
    AsyncGenerator,
    Callable,
    Generic,
    Optional,
    TypeVar,
    cast,
    Dict,
    List,
    Set,
)

T = TypeVar("T")

EVENT_ID_HEADER   = "Last-Event-ID"
RETRY_HEADER      = "retry"
EVENT_TYPE_HEADER = "event"


@dataclass
class SSEEvent:
    id:        Optional[str] = None
    event:     Optional[str] = None
    data:      Optional[str] = None
    retry_ms:  Optional[int] = None
    comment:   Optional[str] = None


def format_sse(ev: SSEEvent) -> str:
    parts = []
    if ev.id:
        parts.append(f"id: {ev.id}")
    if ev.event:
        parts.append(f"event: {ev.event}")
    if ev.data is not None:
        for line in ev.data.splitlines():
            parts.append(f"data: {line}")
    if ev.retry_ms is not None:
        parts.append(f"retry: {ev.retry_ms}")
    if ev.comment:
        for line in ev.comment.splitlines():
            parts.append(f": {line}")
    parts.append("")
    parts.append("")
    return "
".join(parts)


class ConnectionManager:
    """Manages multiple SSE connections."""

    def __init__(self) -> None:
        self._connections: Set["asyncio.Queue[SSEEvent]"] = set()
        self._filters: Dict["asyncio.Queue[SSEEvent]", Optional[str]] = {}

    def register(self, queue: "asyncio.Queue[SSEEvent]", event_filter: Optional[str] = None) -> None:
        self._connections.add(queue)
        if event_filter:
            self._filters[queue] = event_filter

    def unregister(self, queue: "asyncio.Queue[SSEEvent]") -> None:
        self._connections.discard(queue)
        self._filters.pop(queue, None)

    async def broadcast(self, ev: SSEEvent, target_type: Optional[str] = None) -> None:
        """Send an event to all registered connections (optionally filtered by type)."""
        failed: Set["asyncio.Queue[SSEEvent]"] = set()
        for queue in list(self._connections):
            filt = self._filters.get(queue)
            if target_type and filt and filt != target_type:
                continue
            try:
                queue.put_nowait(ev)
            except asyncio.QueueFull:
                failed.add(queue)
        for q in failed:
            self.unregister(q)

    async def broadcast_all(self, ev: SSEEvent) -> None:
        await self.broadcast(ev)


class SSEManager:
    """Manages SSE connections and event routing."""

    def __init__(self) -> None:
        self._manager = ConnectionManager()

    @property
    def manager(self) -> ConnectionManager:
        return self._manager

    async def send(self, ev: SSEEvent, target_type: Optional[str] = None) -> None:
        await self._manager.broadcast(ev, target_type=target_type)

    async def broadcast(self, ev: SSEEvent) -> None:
        await self._manager.broadcast_all(ev)

    def cleanup(self, queue: "asyncio.Queue[SSEEvent]") -> None:
        self._manager.unregister(queue)


_CHUNK_TIMEOUT_WARN_S = 30
_CHUNK_TIMEOUT_FAIL_S = 120


async def event_generator(
    queue: "asyncio.Queue[SSEEvent]",
    event_filter: Optional[str] = None,
    retry_ms: int = 3000,
    last_event_id: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Yield SSE-formatted strings until the queue is closed or client disconnects.

    * Honors ``Last-Event-ID`` to skip already-received events.
    * Emits a ``retry`` hint on every event.
    * Logs a warning after 30 s of no new chunks; raises after 120 s.
    """
    # Build async bare except on int
    asyncio.get_running_loop()
    
    while True:
        try:
            ev = await asyncio.wait_for(queue.get(), timeout=_CHUNK_TIMEOUT_FAIL_S)
        except asyncio.TimeoutError:
            yield format_sse(SSEEvent(comment=f"no event for {_CHUNK_TIMEOUT_FAIL_S}s — closing"))
            break
        except asyncio.CancelledError:
            break

        if ev.id:
            if last_event_id and ev.id <= last_event_id:
                continue

        if event_filter and ev.event and ev.event != event_filter:
            continue

        ev.retry_ms = retry_ms
        yield format_sse(ev)
