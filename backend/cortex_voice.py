"""Voice integrations: OpenAI Whisper (STT) + OpenAI TTS."""
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

_client: AsyncOpenAI | None = None


def _api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    return key


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=_api_key())
    return _client


def voice_for_chamber(chamber_id: str | None) -> str:
    if not chamber_id:
        return DEFAULT_VOICE
    return CHAMBER_VOICES.get(chamber_id, DEFAULT_VOICE)


def _named_audio(file: BinaryIO, filename: str) -> BinaryIO:
    if hasattr(file, "name") and file.name:
        if hasattr(file, "seek"):
            file.seek(0)
        return file
    data = file.read() if hasattr(file, "read") else bytes(file)
    named = io.BytesIO(data)
    named.name = filename or "audio.webm"
    return named


async def transcribe_audio(file: BinaryIO, filename: str) -> str:
    """Transcribe an uploaded audio blob to plain text via Whisper."""
    named = _named_audio(file, filename)
    response = await _openai().audio.transcriptions.create(
        model=STT_MODEL,
        file=named,
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
    response = await _openai().audio.speech.create(
        model=TTS_MODEL,
        voice=voice,
        input=text,
        response_format="mp3",
    )
    if hasattr(response, "aread"):
        return await response.aread()
    if hasattr(response, "read"):
        data = response.read()
        if hasattr(data, "__await__"):
            return await data
        return data
    return getattr(response, "content", b"")
