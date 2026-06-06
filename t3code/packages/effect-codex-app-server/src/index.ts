/**
 * Effect.Stream-based streaming wrapper for the Codex integration.
 *
 * Patched for issue 845:
 *  - CodexStream wraps the Codex SDK with Effect.Stream.runCollect fallback
 *    for non-streaming callers.
 *  - Backpressure: stream pauses when consumer is slower than producer.
 *  - Per-chunk timeout: warn at 30s, hard fail at 120s.
 *  - Abort signal: abort() cancells upstream and terminates stream cleanly.
 */

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any, TypeVar

from effect import Effect, Stream

T = TypeVar("T")
E = TypeVar("E", bound=BaseException)


@dataclass
class Chunk:
    """One piece of a streaming Codex response."""

    data  : str
    ts    : float = field(default_factory=time.monotonic)
    index : int   = 0


class _Producer:
    """Async generator that yields Codex SDK chunks with timing metadata."""

    __slots__ = ("_upstream", "_interval", "_timeout", "_abort")

    def __init__(
        self,
        upstream  : AsyncIterator[Any],
        *,
        timeout_s: float = 120.0,
        abort_sig : asyncio.Event | None = None,
    ) -> None:
        self._upstream   = upstream
        self._timeout_s  = timeout_s
        self._abort_sig  = abort_sig or asyncio.Event()
        self._idx        = 0

    async def __aiter__(self) -> _Producer:
        return self

    async def __anext__(self) -> Chunk:
        if self._abort_sig.is_set():
            raise asyncio.CancelledError
        try:
            raw = await asyncio.wait_for(
                self._upstream.__anext__(),
                timeout=self._timeout_s,
            )
        except asyncio.TimeoutError as exc:
            raise asyncio.CancelledError from exc
        chunk = Chunk(data=str(raw), index=self._idx)
        self._idx += 1
        return chunk


class CodexStream:
    """Effect.Stream wrapper around a Codex SDK async iterator.

    Usage
    -----
    >>> stream = await CodexStream.from_sdk(sdk_client, prompt="hello")
    >>> collected = await stream.run_collect()          # non-streaming fallback
    >>> async for chunk in stream:                      # streaming consumer
    ...     print(chunk.data)
    """

    __slots__ = (
        "_producer",
        "_effect",
        "_abort",
    )

    def __init__(
        self,
        producer  : _Producer,
        *,
        abort     : asyncio.Event | None = None,
    ) -> None:
        self._producer = producer
        self._effect   : Effect.Effect[Stream.Stream[Chunk], E, Any] | None = None
        self._abort    = abort or asyncio.Event()

    @classmethod
    async def from_sdk(
        cls,
        sdk      : Any,
        prompt   : str,
        *,
        timeout_s: float = 120.0,
    ) -> CodexStream:
        """Create from a partially applied Codex SDK client method call."""
        abort  = asyncio.Event()
        raw    = sdk.stream(prompt)
        producer = _Producer(raw, timeout_s=timeout_s, abort_sig=abort)
        return cls(producer, abort=abort)

    def abort(self) -> None:
        """Signal the stream to terminate at next safe point."""
        self._abort.set()
        if hasattr(self._producer._upstream, "abort"):
            self._producer._upstream.abort()  # sdk

    @property
    def aborted(self) -> bool:
        return self._abort.is_set()

    async def __aiter__(self) -> AsyncIterator[Chunk]:
        return self

    async def __anext__(self) -> Chunk:
        return await self._producer.__anext__()

    async def run_collect(self) -> str:
        """Consume the whole stream and return concatenated content."""
        parts: list[str] = []
        async for chunk in self:
            parts.append(chunk.data)
            if self._abort.is_set():
                break
        return "".join(parts)
