"""Test bootstrap.

The backend modules import each other flat (`from personas import …`), so the
backend directory has to be importable. `emergentintegrations` is the hosted LLM
client and is not installable in a bare test environment, so it is stubbed here
— the unit tests exercise gathering, sifting and normalisation, none of which
should ever need a live model.
"""
import sys
import types
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


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
