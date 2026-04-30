"""Voice integrations: OpenAI Whisper (STT) + OpenAI TTS, both via Emergent LLM Key."""
import io
import logging
import os
from typing import BinaryIO

from emergentintegrations.llm.openai import OpenAISpeechToText, OpenAITextToSpeech

logger = logging.getLogger(__name__)

CHAMBER_VOICES = {
    "senate": "onyx",
    "boardroom": "sage",
    "courtroom": "fable",
    "council": "echo",
    "forge": "nova",
}

DEFAULT_VOICE = "onyx"
TTS_MODEL = "tts-1"
STT_MODEL = "whisper-1"
MAX_TTS_CHARS = 4000  # OpenAI TTS limit is 4096; leave a small buffer.


def _api_key() -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured")
    return key


def voice_for_chamber(chamber_id: str | None) -> str:
    if not chamber_id:
        return DEFAULT_VOICE
    return CHAMBER_VOICES.get(chamber_id, DEFAULT_VOICE)


async def transcribe_audio(file: BinaryIO, filename: str) -> str:
    """Transcribe an uploaded audio blob to plain text via Whisper."""
    stt = OpenAISpeechToText(api_key=_api_key())
    # The library expects a file-like object; ensure the blob has a `.name`.
    if hasattr(file, "name") and file.name:
        named = file
    else:
        # Wrap raw bytes in a BytesIO that exposes .name (some SDKs use this for the mime hint).
        data = file.read() if hasattr(file, "read") else bytes(file)
        named = io.BytesIO(data)
        named.name = filename or "audio.webm"
    response = await stt.transcribe(
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
    tts = OpenAITextToSpeech(api_key=_api_key())
    return await tts.generate_speech(text=text, model=TTS_MODEL, voice=voice)
