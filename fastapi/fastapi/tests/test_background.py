from __future__ import annotations

import pytest
from fastapi.background import BackgroundTasks


def test_task_succeeds_without_error():
    done = []
    def task():
        done.append(1)
    bg = BackgroundTasks()
    bg.add_task(task)
    bg()
    assert done == [1]


def test_retry_succeeds_on_second_attempt():
    count = []
    def flaky():
        count.append(1)
        if len(count) < 2:
            raise RuntimeError("fail")
    bg = BackgroundTasks()
    bg.add_task(flaky, max_retries=3)
    bg()
    assert len(count) == 2
    res = bg.result(0)
    assert res["ok"] is True
    assert res["attempts"] == 2


def test_error_callback_is_invoked():
    caught = []
    def on_error(exc, name):
        caught.append((name, type(exc).__name__))
    def boom():
        raise ValueError("boom!")
    bg = BackgroundTasks(error_callback=on_error)
    bg.add_task(boom, max_retries=0)
    bg()
    assert len(caught) == 1
    assert caught[0][0] == "boom"


def test_results_are_stored():
    def fail():
        raise RuntimeError("fail")
    bg = BackgroundTasks()
    bg.add_task(fail, max_retries=1)
    bg()
    assert len(bg.task_results) == 1
    _, ok, _ = bg.task_results[0]  # (name, ok, exc)
    assert ok is False
    assert bg.exception(0) is not None
