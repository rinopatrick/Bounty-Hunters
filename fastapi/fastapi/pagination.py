"""Pagination utilities for FastAPI: offset-based and cursor-based."""

from __future__ import annotations

import math
import time
import base64
import json
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standardized paginated response for any Pydantic model type."""

    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int = Field(alias="total_pages")
    has_next: bool
    has_previous: bool

    class Config:
        populate_by_name = True


class Paginator:
    """Offset + optional cursor paginator."""

    def __init__(self, total: int, page: int = 1, page_size: int = 20,
                 max_page_size: int = 100) -> None:
        self.total = total
        self.page = max(page, 1)
        self.page_size = min(max(page_size, 1), max_page_size)
        self.total_pages = max(math.ceil(total / self.page_size), 1)
        if self.page > self.total_pages:
            self.page = self.total_pages
        self.offset = (self.page - 1) * self.page_size
        self.has_next = self.page < self.total_pages
        self.has_previous = self.page > 1

    def slice(self, items: list[T]) -> list[T]:
        return items[self.offset:self.offset + self.page_size]

    def response(self, items: list[T]) -> PaginatedResponse[T]:
        return PaginatedResponse[T](
            items=items,
            total=self.total,
            page=self.page,
            page_size=self.page_size,
            total_pages=self.total_pages,
            has_next=self.has_next,
            has_previous=self.has_previous,
        )


class CursorEntry:
    """Encoded cursor for cursor-based pagination."""

    def __init__(self, cursor: str, item_id: Any) -> None:
        self.cursor = cursor
        self.item_id = item_id

    def encode(self) -> str:
        payload = {"cursor": self.cursor, "item_id": str(self.item_id)}
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


def decode_cursor(encoded: str) -> CursorEntry:
    try:
        payload = json.loads(base64.urlsafe_b64decode(encoded.encode()).decode())
        return CursorEntry(cursor=payload["cursor"], item_id=payload["item_id"])
    except Exception:
        raise ValueError("Invalid cursor")


def cursor_paginate(
    items: list[Any],
    cursor_key: callable,
    page_size: int = 20,
    after: str | None = None,
) -> tuple[list[Any], str | None]:
    sorted_items = sorted(items, key=cursor_key)
    start = 0
    if after:
        try:
            entry = decode_cursor(after)
        except ValueError:
            start = 0
        else:
            for i, item in enumerate(sorted_items):
                if cursor_key(item) == cursor_key(entry.item_id):
                    start = i + 1
                    break
    page = sorted_items[start:start + page_size]
    next_cursor: str | None = None
    if start + page_size < len(sorted_items):
        last = page[-1]
        next_cursor = CursorEntry(cursor=str(time.time()), item_id=cursor_key(last)).encode()
    return page, next_cursor
