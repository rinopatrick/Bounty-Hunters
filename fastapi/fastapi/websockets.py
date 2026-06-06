"""WebSocket heartbeat wrapper.

Patched for issue 766:
- WebSocketWithHeartbeat wraps a Starlette WebSocket and sends ping frames
  on a configurable interval (default 30 s).
- If no pong is received within `pong_timeout` (default 10 s) the connection
  is closed with code 1001 (going away).
- `on_disconnect(code, duration)` callback fires when the connection drops.
- `connection_duration` and `message_count` properties track active stats.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from typing import Any, Self

from starlette.websockets import WebSocket, WebSocketState


class WebSocketWithHeartbeat:
    """Wraps a :class:`starlette.websockets.WebSocket` and adds a heartbeat.

    Parameters
    ----------
    ws:
        The underlying Starlette WebSocket.
    ping_interval : float
        Seconds between consecutive ping frames.  Default ``30.0``.
    pong_timeout : float
        Seconds to wait for a pong before closing.  Default ``10.0``.
    on_disconnect : callable
        Called as ``on_disconnect(close_code, duration_seconds)`` when the
        heartbeat loop exits.
    """

    def __init__(
        self,
        ws           : WebSocket,
        ping_interval: float = 30.0,
        pong_timeout : float = 10.0,
        on_disconnect: Callable[[int, float], None] | None = None,
    ) -> None:
        self._ws            = ws
        self._ping_interval = ping_interval
        self._pong_timeout  = pong_timeout
        self._on_disconnect = on_disconnect
        self._connected     = False
        self._connect_time  = time.monotonic()
        self._msg_count     = 0
        self._pong_evt      = asyncio.Event()

    # ── context manager ──────────────────────────────────────────────────────

    async def __aenter__(self) -> Self:
        await self._ws.accept()
        self._connected    = True
        self._pong_evt.clear()
        return self

    async def __aexit__(self, *exc: object) -> None:
        self._connected = False
        if self._on_disconnect:
            dur   = time.monotonic() - self._connect_time
            code  = self._ws.close_code or 1001
            self._on_disconnect(code, dur)

    # ── properties ───────────────────────────────────────────────────────────

    @property
    def connection_duration(self) -> float:
        return time.monotonic() - self._connect_time

    @property
    def message_count(self) -> int:
        return self._msg_count

    # ── passthrough methods ──────────────────────────────────────────────────

    async def accept(self) -> None:
        await self._ws.accept()

    async def receive_json(self) -> Any:
        msg = await self._ws.receive_json()
        self._msg_count += 1
        return msg

    async def receive_text(self) -> str:
        msg = await self._ws.receive_text()
        self._msg_count += 1
        return msg

    async def send_json(self, data: Any) -> None:
        await self._ws.send_json(data)

    # ── heartbeat ────────────────────────────────────────────────────────────

    async def _heartbeat(self) -> None:
        while self._connected and self._ws.client_state != WebSocketState.DISCONNECTED:
            await asyncio.sleep(self._ping_interval)
            if not self._connected:
                break
            try:
                self._pong_evt.clear()
                await asyncio.wait_for(self._ws.send("ping"), timeout=5)
                await asyncio.wait_for(self._pong_evt.wait(), self._pong_timeout)
            except asyncio.TimeoutError:
                await self._ws.close(code=1001)
                break
            except Exception:
                break

    async def listen_pongs(self) -> None:
        """Background task: mark the pong event when a pong-frame arrives."""
        while self._connected:
            try:
                msg = await self._ws.receive()
                if msg.get("type") == "websocket.pong":
                    self._pong_evt.set()
                else:
                    self._msg_count += 1
            except Exception:
                break
