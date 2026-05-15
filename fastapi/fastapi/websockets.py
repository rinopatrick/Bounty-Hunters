from __future__ import annotations

import asyncio
import time
from collections.abc import Callable
from typing import Self

from starlette.websockets import WebSocket, WebSocketState


class WebSocketWithHeartbeat:
    """Wraps a Starlette WebSocket and sends periodic ping frames.

    Parameters
    ----------
    ws:
        The underlying Starlette WebSocket instance.
    ping_interval: seconds between ping frames (default 30).
    pong_timeout: seconds to wait for pong before closing (default 10).
    on_disconnect: optional callable(close_code, duration_seconds).
    """

    def __init__(
        self,
        ws: WebSocket,
        ping_interval: float = 30.0,
        pong_timeout: float = 10.0,
        on_disconnect: Callable[[int, float], None] | None = None,
    ) -> None:
        self._ws            = ws
        self._ping_interval = ping_interval
        self._pong_timeout  = pong_timeout
        self._on_disconnect = on_disconnect
        self._connected     = False
        self._connect_time  = time.monotonic()
        self._msg_count     = 0
        self._pong_evt: asyncio.Event = asyncio.Event()

    async def __aenter__(self) -> Self:
        await self._ws.accept()
        self._connected    = True
        self._pong_evt.clear()
        return self

    async def __aexit__(self, *exc: object) -> None:
        self._connected = False
        if self._on_disconnect:
            dur  = time.monotonic() - self._connect_time
            code = self._ws.close_code or 1001
            self._on_disconnect(code, dur)

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

    @property
    def connection_duration(self) -> float:
        return time.monotonic() - self._connect_time

    @property
    def message_count(self) -> int:
        return self._msg_count

    async def heartbeat_loop(
        self,
        ping_interval: float | None = None,
        pong_timeout : float | None = None,
    ) -> None:
        interval = ping_interval if ping_interval is not None else self._ping_interval
        timeout  = pong_timeout  if pong_timeout  is not None else self._pong_timeout
        while self._connected and self._ws.client_state != WebSocketState.DISCONNECTED:
            await asyncio.sleep(interval)
            if not self._connected:
                break
            try:
                self._pong_evt.clear()
                await asyncio.wait_for(self._ws.send("ping"), timeout=5)
                await asyncio.wait_for(self._pong_evt.wait(), timeout)
            except asyncio.TimeoutError:
                await self._ws.close(code=1001)
                break
            except Exception:
                break
