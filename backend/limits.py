"""In-process rate limiting for expensive API routes.

This is a cost-control backstop, not an auth system. Identity for the paywall
is still the browser archive_id; the limiter stops a caller who rotates that
id (or omits it) from burning the Anthropic/OpenAI keys without bound.
"""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    """Per-key sliding window. Safe for a single uvicorn worker."""

    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str, limit: int, window_s: float) -> bool:
        now = time.monotonic()
        bucket = [t for t in self._hits.get(key, []) if now - t < window_s]
        if len(bucket) >= limit:
            self._hits[key] = bucket
            return False
        bucket.append(now)
        self._hits[key] = bucket
        return True

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()

# bucket, limit, window seconds
HEAVY = ("heavy", 8, 600)          # deliberate / convene / projection / scenario / court
BRIEF = ("brief", 12, 600)         # war-room sift
VOICE = ("voice", 20, 600)         # whisper + tts
ROUTE = ("route", 30, 600)         # chamber router


def client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def check_rate(request: Request, bucket: str, limit: int, window_s: float) -> None:
    ip = client_ip(request)
    if not limiter.allow(f"{bucket}:{ip}", limit, window_s):
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Wait a moment and try again.",
        )


def rate_limit(spec: tuple[str, int, int]):
    """FastAPI dependency factory: Depends(rate_limit(HEAVY))."""
    bucket, limit, window_s = spec

    async def _dep(request: Request) -> None:
        check_rate(request, bucket, limit, window_s)

    return _dep


def require_archive_id(archive_id: Optional[str]) -> str:
    """Fail closed: metered routes do not run without a session id."""
    if not archive_id or not str(archive_id).strip():
        raise HTTPException(
            status_code=401,
            detail="A browser session is required.",
        )
    return str(archive_id).strip()
