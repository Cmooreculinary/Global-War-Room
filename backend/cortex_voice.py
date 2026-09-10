"""Voice integrations: OpenAI Whisper (STT) + OpenAI TTS via the OpenAI SDK."""
import io
import logging
import os
from typing import BinaryIO

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

CHAMBER_VOICES = {
    "senate": "onyx",
    "boardroom": "sage",
    "courtroom": "fable",
    "council": "echo",
    "warroom": "ash",
    "forge": "nova",
}

DEFAULT_VOICE = "onyx"
TTS_MODEL = "tts-1"
STT_MODEL = "whisper-1"
MAX_TTS_CHARS = 4000  # OpenAI TTS limit is 4096; leave a small buffer.


def _api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return key


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=_api_key())


def voice_for_chamber(chamber_id: str | None) -> str:
    if not chamber_id:
        return DEFAULT_VOICE
    return CHAMBER_VOICES.get(chamber_id, DEFAULT_VOICE)


async def transcribe_audio(file: BinaryIO, filename: str) -> str:
    """Transcribe an uploaded audio blob to plain text via Whisper."""
    # The SDK expects a file-like object with a `.name` for the mime hint.
    if hasattr(file, "name") and file.name:
        named = file
    else:
        data = file.read() if hasattr(file, "read") else bytes(file)
        named = io.BytesIO(data)
        named.name = filename or "audio.webm"
    response = await _client().audio.transcriptions.create(
        file=named,
        model=STT_MODEL,
        response_format="json",
    )
    return getattr(response, "text", "") or ""


async def synthesize_speech(text: str, voice: str | None = None) -> bytes:
    """Render text as MP3 audio bytes via OpenAI TTS."""
    voice = voice or DEFAULT_VOICE
    if voice not in {"alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"}:
        voice = DEFAULT_VOICE
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty text supplied for speech synthesis")
    if len(text) > MAX_TTS_CHARS:
        text = text[:MAX_TTS_CHARS].rsplit(" ", 1)[0] + "…"
    response = await _client().audio.speech.create(
        model=TTS_MODEL,
        voice=voice,
        input=text,
    )
    return response.content
