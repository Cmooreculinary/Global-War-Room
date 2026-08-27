"""Test bootstrap.

The backend modules import each other flat (`from personas import …`), so the
backend directory has to be importable. `emergentintegrations` is the hosted LLM
client and is not installable in a bare test environment, so it is stubbed here
— the unit tests exercise gathering, sifting and normalisation, none of which
should ever need a live model.
"""
import os
import socket
import sys
import types
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Files named *_backend.py drive a running server; everything else is a unit
# test that must pass with no server and no model.
INTEGRATION_SUFFIX = "_backend.py"
BACKEND_HOST, BACKEND_PORT = "localhost", 8001


def _install_llm_stub():
    if "emergentintegrations" in sys.modules:
        return

    class _StubChat:
        """Mirrors the fluent surface cortex_service builds against."""

        def __init__(self, **kwargs):
            self.kwargs = kwargs
            self.params = {}

        def with_model(self, *_args, **_kwargs):
            return self

        def with_params(self, **params):
            self.params.update(params)
            return self

        async def send_message(self, _message):
            raise AssertionError(
                "A unit test reached the live model. Stub the call under test instead."
            )

    class _StubUserMessage:
        def __init__(self, text=""):
            self.text = text

    root = types.ModuleType("emergentintegrations")
    llm = types.ModuleType("emergentintegrations.llm")
    chat = types.ModuleType("emergentintegrations.llm.chat")
    chat.LlmChat = _StubChat
    chat.UserMessage = _StubUserMessage
    llm.chat = chat
    root.llm = llm

    sys.modules["emergentintegrations"] = root
    sys.modules["emergentintegrations.llm"] = llm
    sys.modules["emergentintegrations.llm.chat"] = chat


_install_llm_stub()


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
