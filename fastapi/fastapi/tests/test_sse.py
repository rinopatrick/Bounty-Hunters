"""Tests for SSE disconnect + filtering."""

from __future__ import annotations

import asyncio

import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import StreamingResponse
from starlette.testclient import TestClient  # type: ignore[import-untyped]

from fastapi.fastapi.sse import (
    SSEEvent,
    ConnectionManager,
    format_sse,
    event_generator,
)

import queue as _q


def test_format_sse_basic() -> None:
    ev = SSEEvent(id="1", event="msg", data="hello", retry_ms=1000)
    out = format_sse(ev)
    assert "id: 1" in out
    assert "event: msg" in out
    assert "data: hello" in out
    assert "retry: 1000" in out
    assert out.endswith("\n\n")


def test_format_sse_comment() -> None:
    ev = SSEEvent(comment="heartbeat")
    out = format_sse(ev)
    assert out.startswith(": heartbeat")


@pytest.mark.asyncio
async def test_event_generator_filter() -> None:
    q: asyncio.Queue[SSEEvent] = asyncio.Queue()
    await q.put(SSEEvent(id="1", event="a", data="data-a"))
    await q.put(SSEEvent(id="2", event="b", data="data-b"))

    results: list[str] = []
    async for chunk in event_generator(q, event_filter="b", retry_ms=500):
        results.append(chunk)
        if len(results) >= 1:
            break

    assert any("data-b" in c for c in results)
    assert not any("data-a" in c for c in results)


@pytest.mark.asyncio
async def test_connection_manager_broadcast() -> None:
    mgr = ConnectionManager()
    q: asyncio.Queue[SSEEvent] = asyncio.Queue(maxsize=2)
    mgr.register(q, event_filter="news")
    await mgr.broadcast(SSEEvent(event="news", data="hi"), target_type="news")
    ev = q.get_nowait()
    assert ev.data == "hi"
