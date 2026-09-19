"""Rate limiter and fail-closed session helper — no network."""
import pytest
from fastapi import HTTPException
from starlette.requests import Request

from limits import (
    SlidingWindowLimiter,
    client_ip,
    require_archive_id,
)


def test_require_archive_id_rejects_missing_values():
    for value in (None, "", "   "):
        with pytest.raises(HTTPException) as exc:
            require_archive_id(value)
        assert exc.value.status_code == 401


def test_require_archive_id_strips():
    assert require_archive_id("  abc  ") == "abc"


def test_sliding_window_blocks_after_limit():
    lim = SlidingWindowLimiter()
    assert lim.allow("k", 2, 60) is True
    assert lim.allow("k", 2, 60) is True
    assert lim.allow("k", 2, 60) is False


def test_sliding_window_is_per_key():
    lim = SlidingWindowLimiter()
    assert lim.allow("a", 1, 60) is True
    assert lim.allow("b", 1, 60) is True
    assert lim.allow("a", 1, 60) is False


def _request(headers=None, host="203.0.113.9"):
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
        "client": (host, 12345),
        "server": ("test", 80),
    }
    return Request(scope)


def test_client_ip_prefers_first_forwarded_hop():
    req = _request(headers={"x-forwarded-for": "198.51.100.4, 10.0.0.1"})
    assert client_ip(req) == "198.51.100.4"


def test_client_ip_falls_back_to_socket():
    assert client_ip(_request()) == "203.0.113.9"
