"""Cerebral Cortex backend tests — chambers, deliberation, archive."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
# Use localhost for backend-only tests (faster, avoids ingress timeouts)
LOCAL_URL = "http://localhost:8001"
API = f"{LOCAL_URL}/api"

ARCHIVE_ID = f"test-archive-cortex-{uuid.uuid4().hex[:8]}"
WRONG_ARCHIVE_ID = f"wrong-archive-{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Metadata ----------------------------------------------------------- #
def test_root_metadata(http):
    r = http.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert "app" in data and "tagline" in data
    assert data["app"] == "Cerebral Cortex"


# ---- Chambers ----------------------------------------------------------- #
def test_list_chambers(http):
    r = http.get(f"{API}/chambers", timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    ids = {c["id"] for c in data}
    assert ids == {"senate", "boardroom", "courtroom", "council", "forge"}
    required = {"id", "name", "domain", "biology", "tagline",
                "placeholder", "cta", "loading", "error", "council"}
    for c in data:
        assert required.issubset(c.keys()), f"missing keys in {c['id']}"
        assert "_id" not in c


def test_chamber_senate_council(http):
    r = http.get(f"{API}/chambers/senate", timeout=10)
    assert r.status_code == 200
    data = r.json()
    council = data["council"]
    assert len(council) >= 3, f"senate should have >=3 members, got {len(council)}"
    # real-figure personas: Lincoln, Churchill, Aurelius, Burke etc.
    ids = {m["id"] for m in council}
    assert ids, "council ids empty"
    for m in council:
        for k in ("id", "name", "lineage", "glyph", "voice_notes"):
            assert k in m and m[k]


def test_chamber_forge_council(http):
    r = http.get(f"{API}/chambers/forge", timeout=10)
    assert r.status_code == 200
    council = r.json()["council"]
    assert len(council) == 1
    assert council[0]["id"] == "integrator"


def test_chamber_unknown_404(http):
    r = http.get(f"{API}/chambers/unknown", timeout=10)
    assert r.status_code == 404


# ---- Deliberation: validation ------------------------------------------ #
def test_deliberate_empty_question_400(http):
    r = http.post(f"{API}/deliberate", json={
        "chamber_id": "senate", "question": "   ", "archive_id": ARCHIVE_ID
    }, timeout=15)
    assert r.status_code == 400


def test_deliberate_unknown_chamber_404(http):
    r = http.post(f"{API}/deliberate", json={
        "chamber_id": "nope", "question": "x", "archive_id": ARCHIVE_ID
    }, timeout=15)
    assert r.status_code == 404


# ---- Deliberation: real LLM (Senate) ----------------------------------- #
@pytest.fixture(scope="module")
def senate_verdict(http):
    payload = {
        "chamber_id": "senate",
        "question": "Should I let go of my co-founder who is no longer growing?",
        "archive_id": ARCHIVE_ID,
    }
    t0 = time.time()
    r = http.post(f"{API}/deliberate", json=payload, timeout=180)
    print(f"\nSenate deliberation: {time.time()-t0:.1f}s, status={r.status_code}")
    if r.status_code != 200:
        pytest.fail(f"Senate deliberate failed: {r.status_code} {r.text[:500]}")
    return r.json()


def test_senate_chamber_metadata(senate_verdict):
    v = senate_verdict
    assert v["chamber"] == "The Senate"
    assert v["chamber_id"] == "senate"
    assert "_id" not in v


def test_senate_verdict_has_id(senate_verdict):
    v = senate_verdict
    assert isinstance(v["id"], str) and len(v["id"]) > 0


def test_senate_verdict_text(senate_verdict):
    assert isinstance(senate_verdict["verdict"], str)
    assert len(senate_verdict["verdict"]) > 20


def test_senate_deliberation_shape(senate_verdict):
    delib = senate_verdict["deliberation"]
    # New real-figure architecture: may be 3 senators (single chamber) OR
    # committee witnesses (one entry per chamber). Both are valid shapes.
    assert len(delib) >= 1
    for d in delib:
        assert d.get("member")
        assert d.get("contribution")
        assert "dissent" in d


# ---- Verdict retrieval / save / archive ------------------------------- #
def test_get_verdict_by_id(http, senate_verdict):
    vid = senate_verdict["id"]
    r = http.get(f"{API}/verdicts/{vid}", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == vid
    assert "_id" not in data


def test_get_verdict_404(http):
    r = http.get(f"{API}/verdicts/nonexistent-id", timeout=10)
    assert r.status_code == 404


def test_save_verdict(http, senate_verdict):
    vid = senate_verdict["id"]
    r = http.post(f"{API}/verdicts/{vid}/save",
                  json={"archive_id": ARCHIVE_ID}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["saved"] is True
    assert data["archive_id"] == ARCHIVE_ID


def test_archive_lists_saved_verdict(http, senate_verdict):
    r = http.get(f"{API}/verdicts", params={"archive_id": ARCHIVE_ID}, timeout=15)
    assert r.status_code == 200
    items = r.json()
    ids = [v["id"] for v in items]
    assert senate_verdict["id"] in ids
    for v in items:
        assert v["saved"] is True
        assert "_id" not in v


def test_delete_wrong_archive_404(http, senate_verdict):
    vid = senate_verdict["id"]
    r = http.delete(f"{API}/verdicts/{vid}",
                    params={"archive_id": WRONG_ARCHIVE_ID}, timeout=10)
    assert r.status_code == 404


def test_delete_unsaves(http, senate_verdict):
    vid = senate_verdict["id"]
    r = http.delete(f"{API}/verdicts/{vid}",
                    params={"archive_id": ARCHIVE_ID}, timeout=10)
    assert r.status_code == 200
    # Should no longer be in archive list
    r2 = http.get(f"{API}/verdicts", params={"archive_id": ARCHIVE_ID}, timeout=10)
    assert r2.status_code == 200
    ids = [v["id"] for v in r2.json()]
    assert vid not in ids


# ---- Forge multi-call deliberation (real LLM, slow) ------------------ #
@pytest.fixture(scope="module")
def forge_verdict(http):
    payload = {
        "chamber_id": "forge",
        "question": ("My business is succeeding but my marriage is suffering, "
                     "and I keep telling myself God called me to build this. "
                     "Am I lying to myself?"),
        "archive_id": ARCHIVE_ID,
    }
    t0 = time.time()
    r = http.post(f"{API}/deliberate", json=payload, timeout=240)
    print(f"\nForge deliberation: {time.time()-t0:.1f}s, status={r.status_code}")
    if r.status_code != 200:
        pytest.fail(f"Forge deliberate failed: {r.status_code} {r.text[:500]}")
    return r.json()


def test_forge_chamber_metadata(forge_verdict):
    assert forge_verdict["chamber"] == "The Forge"
    assert forge_verdict["chamber_id"] == "forge"
    assert "_id" not in forge_verdict


def test_forge_verdict_text(forge_verdict):
    assert isinstance(forge_verdict["verdict"], str)
    assert len(forge_verdict["verdict"]) > 20


def test_forge_witnesses_called(forge_verdict):
    wc = forge_verdict.get("witnesses_called") or []
    assert isinstance(wc, list) and len(wc) >= 1
    assert set(wc).issubset({"senate", "boardroom", "courtroom", "council"})


def test_forge_deliberation_aligned_with_witnesses(forge_verdict):
    wc = forge_verdict.get("witnesses_called") or []
    delib = forge_verdict["deliberation"]
    assert len(delib) == len(wc), "deliberation should have one entry per witness"


# ---- /api/route (routing) --------------------------------------------- #
def test_route_empty_question_400(http):
    r = http.post(f"{API}/route", json={"question": "   "}, timeout=15)
    assert r.status_code == 400


def test_route_returns_valid_chamber(http):
    r = http.post(
        f"{API}/route",
        json={"question": "Should I let go of my co-founder who is no longer growing?"},
        timeout=60,
    )
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert "chamber_id" in data
    assert data["chamber_id"] in {"senate", "boardroom", "courtroom", "council", "forge"}
    assert isinstance(data.get("witnesses", []), list)
    assert isinstance(data.get("reasoning", ""), str)


# ---- /api/transcribe (Whisper STT) ------------------------------------ #
def _make_silent_wav_bytes(seconds: float = 1.0, rate: int = 16000) -> bytes:
    """Generate a short silent WAV in-memory (no external deps)."""
    import io
    import struct
    import wave

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        n = int(rate * seconds)
        # write near-silence (tiny sine to avoid pure-zero rejection)
        frames = b"".join(struct.pack("<h", (i % 7) - 3) for i in range(n))
        w.writeframes(frames)
    return buf.getvalue()


def test_transcribe_returns_text_field(http):
    wav = _make_silent_wav_bytes(seconds=1.0)
    # requests with multipart needs no Content-Type header override
    r = requests.post(
        f"{API}/transcribe",
        files={"audio": ("sample.wav", wav, "audio/wav")},
        timeout=60,
    )
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    data = r.json()
    assert "text" in data
    assert isinstance(data["text"], str)  # may be empty for silence


def test_transcribe_missing_file_422(http):
    r = requests.post(f"{API}/transcribe", timeout=15)
    # FastAPI returns 422 when required file field is missing
    assert r.status_code in (400, 422)


# ---- /api/speak (OpenAI TTS) ------------------------------------------ #
def test_speak_returns_mp3_audio(http):
    payload = {"text": "The cortex has convened.", "chamber_id": "senate"}
    r = requests.post(f"{API}/speak", json=payload, timeout=60)
    assert r.status_code == 200, f"status={r.status_code} body={r.text[:400]}"
    ctype = r.headers.get("content-type", "").lower()
    assert "audio/mpeg" in ctype, f"unexpected content-type: {ctype}"
    assert len(r.content) > 500, f"audio body too small: {len(r.content)} bytes"
    # chamber voice propagated via response header
    assert r.headers.get("X-Voice", "").lower() in {
        "onyx", "sage", "fable", "echo", "nova", "alloy", "ash", "coral", "shimmer"
    }


def test_speak_per_chamber_voice_mapping(http):
    r = requests.post(
        f"{API}/speak",
        json={"text": "Committee convened.", "chamber_id": "forge"},
        timeout=60,
    )
    assert r.status_code == 200
    assert r.headers.get("X-Voice") == "nova"


def test_speak_empty_text_400(http):
    r = requests.post(f"{API}/speak", json={"text": "   "}, timeout=15)
    assert r.status_code == 400

