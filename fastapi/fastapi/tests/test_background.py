"""Tests for BackgroundTasks error handling and retry."""

from __future__ import annotations

import asyncio

import pytest

from fastapi.fastapi.background import BackgroundTasks


class Counter:
    def __init__(self) -> None:
        self.value = 0


def test_task_succeeds_no_retry() -> None:
    log: list[str] = []

    def succeed() -> None:
        log.append("ok")

    bg = BackgroundTasks()
    bg.add_task(succeed)
    bg()
    assert log == ["ok"]
    assert bg.task_results[0][0] is True


def test_task_fails_without_retries() -> None:
    def explode() -> None:
        raise RuntimeError("boom")

    bg = BackgroundTasks()
    bg.add_task(explode)
    bg()
    ok, name, exc = bg.task_results[0]
    assert ok is False
    assert name == "explode"
    assert isinstance(exc, RuntimeError)


def test_retry_succeeds_on_second_attempt() -> None:
    counter = Counter()

    def flaky() -> None:
        counter.value += 1
        if counter.value < 2:
            raise RuntimeError("not yet")

    bg = BackgroundTasks()
    bg.add_task(flaky, max_retries=3)
    bg()
    ok, *_ = bg.task_results[0]
    assert ok is True


def test_error_callback_invoked() -> None:
    errors: list[tuple[Exception, str]] = []

    def on_error(exc: Exception, name: str) -> None:
        errors.append((exc, name))

    def fail() -> None:
        raise ValueError("bad")

    bg = BackgroundTasks(error_callback=on_error)
    bg.add_task(fail)
    bg()
    assert len(errors) == 1
    assert isinstance(errors[0][0], ValueError)


@pytest.mark.asyncio
async def test_async_task_error() -> None:
    async def async_fail() -> None:
        raise RuntimeError("async boom")

    bg = BackgroundTasks()
    bg.add_task(async_fail)
    bg()
    ok, *_ = bg.task_results[0]
    assert ok is False
