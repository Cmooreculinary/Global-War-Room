"""Test bootstrap.

The backend modules import each other flat (`from personas import …`), so the
backend directory has to be importable. Unit tests exercise gathering, sifting
and normalisation; they stub `_ask_json` and must never need a live model.
"""
import os
import socket
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Files named *_backend.py drive a running server; everything else is a unit
# test that must pass with no server and no model.
INTEGRATION_SUFFIX = "_backend.py"
BACKEND_HOST, BACKEND_PORT = "localhost", 8001


def _backend_is_up() -> bool:
    try:
        with socket.create_connection((BACKEND_HOST, BACKEND_PORT), timeout=1.5):
            return True
    except OSError:
        return False


def pytest_configure(config):
    config.addinivalue_line("markers", "integration: needs a live backend on :8001")


def pytest_collection_modifyitems(config, items):
    """Mark the integration files, and skip them when nothing is listening.

    Without this, plain `pytest` gives a developer thirty connection errors
    that say nothing about their change. Set WARROOM_REQUIRE_BACKEND=1 in CI to
    make an unreachable backend a failure instead of a skip.
    """
    integration = [i for i in items if i.fspath.basename.endswith(INTEGRATION_SUFFIX)]
    for item in integration:
        item.add_marker(pytest.mark.integration)

    if not integration or os.environ.get("WARROOM_REQUIRE_BACKEND") == "1":
        return
    if _backend_is_up():
        return

    skip = pytest.mark.skip(
        reason=f"no backend on {BACKEND_HOST}:{BACKEND_PORT} — start it to run the integration suite"
    )
    for item in integration:
        item.add_marker(skip)
