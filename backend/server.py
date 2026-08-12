"""Cerebral Cortex — FastAPI backend."""
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from cortex_service import deliberate_forge, deliberate_with_committee, route_question  # noqa: E402
from cortex_voice import synthesize_speech, transcribe_audio, voice_for_chamber  # noqa: E402
from court_service import (  # noqa: E402
    amend_verdict,
    make_share_path,
    public_session,
    route_and_panel,
    run_deliberation,
)
from billing import (  # noqa: E402
    FREE_VERDICT_LIMIT,
    PLANS,
    create_membership_checkout,
    get_plan,
    stripe_client,
)
from personas import CHAMBERS, RECONSTRUCTION_DISCLAIMER, team_ids, war_room_teams  # noqa: E402
from intel import LIVE_ENABLED, RSS_FEEDS, STATE_FEEDS  # noqa: E402
from scenario_service import (  # noqa: E402
    clamp_horizon,
    run_projections,
    run_scenario,
    sanitize_assignments,
)
from warroom_service import build_brief, run_war_room  # noqa: E402

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="Cerebral Cortex")
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Models                                                                      #
# --------------------------------------------------------------------------- #

class Source(BaseModel):
    model_config = ConfigDict(extra="ignore")
    type: str
    title: str
    author: Optional[str] = None
    year: Optional[str] = None


class Consul(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    dates: Optional[str] = None
    lineage: str
    glyph: str
    chosen_because: str
    voice_notes: str
    sources: Optional[List[Source]] = None


class CouncilMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    dates: Optional[str] = None
    lineage: str
    glyph: str
    voice_notes: str
    sources: Optional[List[Source]] = None
    # Only the War Room seats consuls; every other chamber leaves this empty.
    consuls: Optional[List[Consul]] = None


class ChamberInfo(BaseModel):
    id: str
    name: str
    domain: str
    biology: str
    tagline: str
    placeholder: str
    cta: str
    loading: str
    error: str
    council: List[CouncilMember]


class PersonasResponse(BaseModel):
    disclaimer: str
    chambers: List[ChamberInfo]


class DeliberateRequest(BaseModel):
    chamber_id: str
    question: str
    archive_id: Optional[str] = None  # browser session id for archive ownership


class DeliberationContribution(BaseModel):
    model_config = ConfigDict(extra="ignore")
    member: str
    contribution: str
    dissent: bool = False


class Verdict(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    chamber_id: str
    chamber: str
    question: str
    deliberation: List[DeliberationContribution]
    verdict: str
    committee: bool = False
    witnesses_called: Optional[List[str]] = None
    archive_id: Optional[str] = None
    saved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SaveRequest(BaseModel):
    archive_id: str


class RouteRequest(BaseModel):
    question: str


class RouteResponse(BaseModel):
    chamber_id: str
    witnesses: List[str] = Field(default_factory=list)
    reasoning: str = ""


class TranscribeResponse(BaseModel):
    text: str


class SpeakRequest(BaseModel):
    text: str
    chamber_id: Optional[str] = None
    voice: Optional[str] = None


# ---- Court session models ------------------------------------------------ #

class CourtCreateRequest(BaseModel):
    question: str
    host_name: Optional[str] = None
    archive_id: Optional[str] = None


class CourtJoinRequest(BaseModel):
    name: str


class CourtBeginRequest(BaseModel):
    attendee_id: str  # host marker — only the host can begin


class CourtObjectRequest(BaseModel):
    attendee_id: str
    name: str
    content: str


# ---- War Room models ----------------------------------------------------- #

class WarRoomBriefRequest(BaseModel):
    topic: str
    pasted: str = ""
    live: bool = True
    window_hours: int = Field(default=24, ge=1, le=168)
    include_state: bool = False


class WarRoomBriefResponse(BaseModel):
    id: str
    topic: str
    brief: Dict[str, Any]
    sources: Dict[str, Any]
    items: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


class WarRoomConveneRequest(BaseModel):
    """Either hand back a brief_id from /warroom/brief, or supply a topic and
    let the room gather and sift in one call."""
    brief_id: Optional[str] = None
    topic: Optional[str] = None
    question: str = ""
    pasted: str = ""
    live: bool = True
    window_hours: int = Field(default=24, ge=1, le=168)
    include_state: bool = False
    archive_id: Optional[str] = None


class TeamAssignment(BaseModel):
    """One actor and the teams advising it."""
    actor: str
    teams: List[str] = Field(default_factory=list)


class ProjectionRequest(BaseModel):
    brief_id: Optional[str] = None
    topic: Optional[str] = None
    pasted: str = ""
    live: bool = True
    horizon_years: int = Field(default=5, ge=1, le=10)
    teams: List[str] = Field(default_factory=list)  # empty = every team
    archive_id: Optional[str] = None


class ScenarioRequest(BaseModel):
    brief_id: Optional[str] = None
    topic: Optional[str] = None
    pasted: str = ""
    live: bool = True
    horizon_years: int = Field(default=5, ge=1, le=10)
    assignments: List[TeamAssignment] = Field(default_factory=list)
    archive_id: Optional[str] = None


class RunAccepted(BaseModel):
    run_id: str
    kind: str
    status: str


class RunResponse(BaseModel):
    id: str
    kind: str
    status: str
    topic: str = ""
    horizon: int = 5
    progress: Dict[str, Any] = Field(default_factory=dict)
    brief: Dict[str, Any] = Field(default_factory=dict)
    assignments: List[Dict[str, Any]] = Field(default_factory=list)
    projections: List[Dict[str, Any]] = Field(default_factory=list)
    comparison: Dict[str, Any] = Field(default_factory=dict)
    opening: List[Dict[str, Any]] = Field(default_factory=list)
    years: List[Dict[str, Any]] = Field(default_factory=list)
    debrief: Dict[str, Any] = Field(default_factory=dict)
    error: str = ""
    created_at: datetime
    updated_at: Optional[datetime] = None


class WarRoomEstimateResponse(BaseModel):
    id: str
    topic: str
    question: str = ""
    brief: Dict[str, Any]
    sources: Dict[str, Any] = Field(default_factory=dict)
    items: List[Dict[str, Any]] = Field(default_factory=list)
    board: List[Dict[str, Any]] = Field(default_factory=list)
    estimate: Dict[str, Any] = Field(default_factory=dict)
    verdict: str = ""
    chamber: str = "The War Room"
    chamber_id: str = "warroom"
    saved: bool = False
    created_at: datetime


# ---- Billing models ------------------------------------------------------ #

class CheckoutCreateRequest(BaseModel):
    plan_id: str
    archive_id: str
    origin_url: str


class EntitlementResponse(BaseModel):
    archive_id: str
    is_member: bool
    free_used: int
    free_limit: int
    free_remaining: int
    plan_id: Optional[str] = None


# --------------------------------------------------------------------------- #
# Routes                                                                      #
# --------------------------------------------------------------------------- #

@api_router.get("/")
async def root():
    return {"app": "Cerebral Cortex", "tagline": "Real wisdom is never one voice."}


@api_router.get("/chambers", response_model=List[ChamberInfo])
async def list_chambers():
    return [ChamberInfo(**CHAMBERS[cid]) for cid in CHAMBERS]


@api_router.get("/chambers/{chamber_id}", response_model=ChamberInfo)
async def get_chamber(chamber_id: str):
    if chamber_id not in CHAMBERS:
        raise HTTPException(status_code=404, detail="Chamber not found")
    return ChamberInfo(**CHAMBERS[chamber_id])


@api_router.get("/personas", response_model=PersonasResponse)
async def get_personas():
    """All chambers with full council + sources — for the Receipts page."""
    return PersonasResponse(
        disclaimer=RECONSTRUCTION_DISCLAIMER,
        chambers=[ChamberInfo(**CHAMBERS[cid]) for cid in CHAMBERS],
    )


@api_router.post("/route", response_model=RouteResponse)
async def route(req: RouteRequest):
    """Pre-deliberation routing: which chamber should chair this question?"""
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    result = await route_question(req.question.strip())
    return RouteResponse(**result)


@api_router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)):
    """Transcribe an uploaded audio file (webm/mp3/wav/m4a) to plain text via Whisper."""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    try:
        text = await transcribe_audio(audio.file, audio.filename)
        return TranscribeResponse(text=text or "")
    except Exception as e:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=502, detail="Transcription failed") from e


@api_router.post("/speak")
async def speak(req: SpeakRequest):
    """Render text as MP3 audio in the chamber's voice."""
    voice = req.voice or voice_for_chamber(req.chamber_id)
    try:
        audio_bytes = await synthesize_speech(req.text, voice=voice)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "private, max-age=3600",
                "X-Voice": voice,
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("Speech synthesis failed")
        raise HTTPException(status_code=502, detail="Speech synthesis failed") from e


@api_router.post("/deliberate", response_model=Verdict)
async def deliberate(req: DeliberateRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    if req.chamber_id not in CHAMBERS:
        raise HTTPException(status_code=404, detail="Chamber not found")

    await _enforce_paywall(req.archive_id)

    try:
        if req.chamber_id == "forge":
            payload = await deliberate_forge(req.question)
        elif req.chamber_id == "warroom":
            # The War Room needs source material, so the question doubles as the
            # topic here. The dedicated /warroom endpoints give the full flow.
            payload = await run_war_room(topic=req.question, question=req.question)
        else:
            payload = await deliberate_with_committee(req.chamber_id, req.question)
    except Exception as e:
        logger.exception("Deliberation failed")
        raise HTTPException(
            status_code=502,
            detail=CHAMBERS[req.chamber_id]["error"],
        ) from e

    verdict = Verdict(
        chamber_id=req.chamber_id,
        chamber=payload.get("chamber", CHAMBERS[req.chamber_id]["name"]),
        question=req.question,
        deliberation=[
            DeliberationContribution(**d) for d in payload.get("deliberation", [])
        ],
        verdict=payload.get("verdict", ""),
        committee=bool(payload.get("committee", False)),
        witnesses_called=payload.get("witnesses_called"),
        archive_id=req.archive_id,
        saved=False,
    )

    doc = verdict.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    # Keep the War Room's richer product (brief, board, estimate) on the record
    # even though the shared Verdict shape cannot carry it.
    for key in ("topic", "brief", "sources", "items", "board", "estimate"):
        if key in payload:
            doc[key] = payload[key]
    await db.verdicts.insert_one(doc)
    return verdict


@api_router.get("/verdicts/{verdict_id}", response_model=Verdict)
async def get_verdict(verdict_id: str):
    doc = await db.verdicts.find_one({"id": verdict_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Verdict not found")
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return Verdict(**doc)


@api_router.post("/verdicts/{verdict_id}/save", response_model=Verdict)
async def save_verdict(verdict_id: str, req: SaveRequest):
    doc = await db.verdicts.find_one({"id": verdict_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Verdict not found")
    await db.verdicts.update_one(
        {"id": verdict_id},
        {"$set": {"saved": True, "archive_id": req.archive_id}},
    )
    doc["saved"] = True
    doc["archive_id"] = req.archive_id
    if isinstance(doc.get("created_at"), str):
        doc["created_at"] = datetime.fromisoformat(doc["created_at"])
    return Verdict(**doc)


@api_router.delete("/verdicts/{verdict_id}")
async def delete_verdict(verdict_id: str, archive_id: str = Query(...)):
    result = await db.verdicts.update_one(
        {"id": verdict_id, "archive_id": archive_id},
        {"$set": {"saved": False}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Verdict not found in archive")
    return {"ok": True}


@api_router.get("/verdicts", response_model=List[Verdict])
async def list_archive(archive_id: str = Query(...)):
    cursor = db.verdicts.find(
        {"archive_id": archive_id, "saved": True},
        {"_id": 0},
    ).sort("created_at", -1)
    docs = await cursor.to_list(500)
    out: List[Verdict] = []
    for doc in docs:
        if isinstance(doc.get("created_at"), str):
            doc["created_at"] = datetime.fromisoformat(doc["created_at"])
        out.append(Verdict(**doc))
    return out


# --------------------------------------------------------------------------- #
# Billing — Stripe membership ($10/month, 5 free verdicts before paywall)     #
# --------------------------------------------------------------------------- #

async def _is_active_member(archive_id: Optional[str]) -> tuple[bool, Optional[str]]:
    """Return (is_member, plan_id) for the given archive_id."""
    if not archive_id:
        return False, None
    sub = await db.subscriptions.find_one(
        {"archive_id": archive_id, "status": "active"}, {"_id": 0}
    )
    if not sub:
        return False, None
    return True, sub.get("plan_id")


async def _free_verdicts_used(archive_id: Optional[str]) -> int:
    if not archive_id:
        return 0
    return await db.verdicts.count_documents({"archive_id": archive_id})


async def _enforce_paywall(archive_id: Optional[str]) -> None:
    """Raise 402 once a non-member browser session is out of free verdicts.

    Only enforced when an archive_id is present — anonymous API callers with no
    browser session are not metered.
    """
    if not archive_id:
        return
    is_member, _ = await _is_active_member(archive_id)
    if is_member:
        return
    if await _free_verdicts_used(archive_id) >= FREE_VERDICT_LIMIT:
        raise HTTPException(
            status_code=402,
            detail=(
                "You've used your 5 free verdicts. "
                "Become a member at /pricing to keep convening."
            ),
        )


async def _entitlement(archive_id: Optional[str]) -> EntitlementResponse:
    is_member, plan_id = await _is_active_member(archive_id)
    used = await _free_verdicts_used(archive_id)
    remaining = max(0, FREE_VERDICT_LIMIT - used) if not is_member else 9999
    return EntitlementResponse(
        archive_id=archive_id or "",
        is_member=is_member,
        free_used=used,
        free_limit=FREE_VERDICT_LIMIT,
        free_remaining=remaining,
        plan_id=plan_id,
    )


@api_router.get("/billing/plans")
async def list_plans():
    return {"plans": list(PLANS.values()), "free_limit": FREE_VERDICT_LIMIT}


@api_router.get("/billing/me", response_model=EntitlementResponse)
async def billing_me(archive_id: str = Query(...)):
    return await _entitlement(archive_id)


@api_router.post("/billing/checkout")
async def billing_checkout(req: CheckoutCreateRequest, http_request: Request):
    if get_plan(req.plan_id) is None:
        raise HTTPException(status_code=400, detail="Unknown plan")
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    try:
        session = await create_membership_checkout(
            plan_id=req.plan_id,
            archive_id=req.archive_id,
            origin_url=req.origin_url.rstrip("/"),
            webhook_url=webhook_url,
        )
    except Exception as e:
        logger.exception("Stripe checkout creation failed")
        raise HTTPException(status_code=502, detail="Could not start checkout") from e

    plan = get_plan(req.plan_id)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "archive_id": req.archive_id,
        "plan_id": req.plan_id,
        "amount": plan["price_usd"],
        "currency": plan["currency"],
        "payment_status": "initiated",
        "status": "open",
        "metadata": {"plan_id": req.plan_id, "archive_id": req.archive_id},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/billing/status/{session_id}")
async def billing_status(session_id: str, http_request: Request):
    """Poll Stripe for session status; on first paid hit, activate the membership."""
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Unknown checkout session")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = stripe_client(webhook_url)
    try:
        status = await sc.get_checkout_status(session_id)
    except Exception as e:
        logger.exception("Stripe status check failed")
        raise HTTPException(status_code=502, detail="Could not check checkout status") from e

    # Update payment_transactions row exactly once on terminal paid state.
    new_payment_status = status.payment_status
    new_status = status.status
    already_paid = txn.get("payment_status") == "paid"
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": new_payment_status,
            "status": new_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )

    # Activate membership idempotently.
    if new_payment_status == "paid" and not already_paid:
        archive_id = txn.get("archive_id") or status.metadata.get("archive_id")
        plan_id = txn.get("plan_id") or status.metadata.get("plan_id")
        if archive_id and plan_id:
            await db.subscriptions.update_one(
                {"archive_id": archive_id},
                {"$set": {
                    "archive_id": archive_id,
                    "plan_id": plan_id,
                    "status": "active",
                    "stripe_session_id": session_id,
                    "activated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

    return {
        "session_id": session_id,
        "status": new_status,
        "payment_status": new_payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    sc = stripe_client(webhook_url)
    try:
        event = await sc.handle_webhook(body, sig)
    except Exception as e:
        logger.exception("Stripe webhook verification failed")
        raise HTTPException(status_code=400, detail="Invalid webhook") from e

    session_id = event.session_id
    if not session_id:
        return {"ok": True}

    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    already_paid = bool(txn and txn.get("payment_status") == "paid")
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": event.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "last_event": event.event_type,
        }},
    )
    if event.payment_status == "paid" and not already_paid:
        archive_id = (event.metadata or {}).get("archive_id") or (txn or {}).get("archive_id")
        plan_id = (event.metadata or {}).get("plan_id") or (txn or {}).get("plan_id")
        if archive_id and plan_id:
            await db.subscriptions.update_one(
                {"archive_id": archive_id},
                {"$set": {
                    "archive_id": archive_id,
                    "plan_id": plan_id,
                    "status": "active",
                    "stripe_session_id": session_id,
                    "activated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
    return {"ok": True}


# --------------------------------------------------------------------------- #
# The War Room — sift the day's coverage, then let the board read it          #
# --------------------------------------------------------------------------- #

@api_router.get("/warroom/sources")
async def warroom_sources():
    """What the room can pull from, so the source list is auditable up front."""
    return {
        "live_enabled": LIVE_ENABLED,
        "search": [{
            "outlet": "GDELT",
            "lean": "aggregator",
            "note": "Topic search across worldwide coverage; each result is labelled by its own outlet.",
        }],
        "feeds": [
            {"outlet": o, "lean": lean, "country": country}
            for o, _url, lean, country in RSS_FEEDS
        ],
        "state_feeds": [
            {"outlet": o, "lean": lean, "country": country}
            for o, _url, lean, country in STATE_FEEDS
        ],
        "note": (
            "State outlets are excluded unless you ask for them. They are useful "
            "for reading what a government wants believed, and are never counted "
            "as corroboration."
        ),
    }


@api_router.post("/warroom/brief", response_model=WarRoomBriefResponse)
async def warroom_brief(req: WarRoomBriefRequest):
    """Pass one: gather today's coverage and sift it into a neutral fact sheet.

    Returned before the board sees it, so the facts can be reviewed — and
    argued with — before anyone reasons from them.
    """
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="A topic is required")

    try:
        gathered = await build_brief(
            topic,
            pasted=req.pasted,
            live=req.live,
            window_hours=req.window_hours,
            include_state=req.include_state,
        )
    except Exception as e:
        logger.exception("War Room briefing failed")
        raise HTTPException(status_code=502, detail=CHAMBERS["warroom"]["error"]) from e

    doc = {
        "id": str(uuid.uuid4()),
        "topic": topic,
        "brief": gathered["brief"],
        "sources": gathered["sources"],
        "items": gathered["items"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.warroom_briefs.insert_one(dict(doc))
    return WarRoomBriefResponse(**{**doc, "created_at": datetime.fromisoformat(doc["created_at"])})


@api_router.post("/warroom/convene", response_model=WarRoomEstimateResponse)
async def warroom_convene(req: WarRoomConveneRequest):
    """Pass two and three: the board reads the brief, then the estimate is drawn.

    Pass a brief_id to reuse a fact sheet the user has already seen; pass a
    topic to gather, sift and convene in one shot.
    """
    await _enforce_paywall(req.archive_id)

    prebuilt = None
    topic = (req.topic or "").strip()
    if req.brief_id:
        stored = await db.warroom_briefs.find_one({"id": req.brief_id}, {"_id": 0})
        if not stored:
            raise HTTPException(status_code=404, detail="Brief not found")
        prebuilt = {
            "brief": stored["brief"],
            "sources": stored.get("sources", {}),
            "items": stored.get("items", []),
        }
        topic = topic or stored.get("topic", "")
    if not topic:
        raise HTTPException(status_code=400, detail="A topic or a brief_id is required")

    try:
        result = await run_war_room(
            topic=topic,
            question=req.question.strip(),
            pasted=req.pasted,
            live=req.live,
            window_hours=req.window_hours,
            include_state=req.include_state,
            prebuilt=prebuilt,
        )
    except Exception as e:
        logger.exception("War Room deliberation failed")
        raise HTTPException(status_code=502, detail=CHAMBERS["warroom"]["error"]) from e

    now = datetime.now(timezone.utc)
    record_id = str(uuid.uuid4())
    doc = {
        "id": record_id,
        "chamber_id": "warroom",
        "chamber": result["chamber"],
        # The Archive and the shared verdict page key on `question`; the topic is
        # the honest thing to show there when no explicit question was asked.
        "question": req.question.strip() or topic,
        "topic": topic,
        "brief": result["brief"],
        "sources": result["sources"],
        "items": result["items"],
        "board": result["board"],
        "estimate": result["estimate"],
        "deliberation": result["deliberation"],
        "verdict": result["verdict"],
        "committee": False,
        "witnesses_called": None,
        "archive_id": req.archive_id,
        "saved": False,
        "created_at": now.isoformat(),
    }
    await db.verdicts.insert_one(dict(doc))

    return WarRoomEstimateResponse(
        id=record_id,
        topic=topic,
        question=req.question.strip(),
        brief=result["brief"],
        sources=result["sources"],
        items=result["items"],
        board=result["board"],
        estimate=result["estimate"],
        verdict=result["verdict"],
        created_at=now,
    )


# ---- Team modes: projections and played-out scenarios -------------------- #

async def _resolve_brief(
    brief_id: Optional[str], topic: Optional[str], pasted: str, live: bool
) -> dict:
    """Reuse a brief the user has already reviewed, or build one now."""
    if brief_id:
        stored = await db.warroom_briefs.find_one({"id": brief_id}, {"_id": 0})
        if not stored:
            raise HTTPException(status_code=404, detail="Brief not found")
        return {
            "topic": stored.get("topic", ""),
            "brief": stored["brief"],
            "sources": stored.get("sources", {}),
            "items": stored.get("items", []),
        }
    if not (topic or "").strip():
        raise HTTPException(status_code=400, detail="A topic or a brief_id is required")
    return await build_brief(topic.strip(), pasted=pasted, live=live)


async def _create_run(kind: str, topic: str, horizon: int, brief_doc: dict, **extra) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    run = {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "status": "running",
        "topic": topic,
        "horizon": horizon,
        "progress": {"stage": "queued"},
        "brief": brief_doc["brief"],
        "sources": brief_doc.get("sources", {}),
        "assignments": [],
        "projections": [],
        "comparison": {},
        "opening": [],
        "years": [],
        "debrief": {},
        "error": "",
        "created_at": now,
        "updated_at": now,
        **extra,
    }
    await db.warroom_runs.insert_one(dict(run))
    return run


async def _patch_run(run_id: str, **fields) -> None:
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.warroom_runs.update_one({"id": run_id}, {"$set": fields})


def _progress_writer(run_id: str):
    """Stream stage-by-stage progress into the run document.

    Results are written the moment they land — a year at a time — so a client
    polling a five-year scenario watches it play rather than staring at a
    spinner for several minutes.
    """
    async def on_progress(**kw):
        stage = kw.get("stage", "")
        patch: dict = {"progress": {k: v for k, v in kw.items() if k not in ("opening", "played")}}
        if stage == "opening_done" and kw.get("opening") is not None:
            patch["opening"] = kw["opening"]
        if stage == "year_done" and kw.get("played") is not None:
            run = await db.warroom_runs.find_one({"id": run_id}, {"_id": 0, "years": 1})
            patch["years"] = (run or {}).get("years", []) + [kw["played"]]
        await _patch_run(run_id, **patch)

    return on_progress


async def _run_projections_task(run_id: str, brief: dict, horizon: int, teams: list):
    try:
        result = await run_projections(
            brief, horizon=horizon, teams=teams, on_progress=_progress_writer(run_id)
        )
        await _patch_run(
            run_id,
            status="complete",
            progress={"stage": "complete"},
            projections=result["projections"],
            comparison=result["comparison"],
        )
    except Exception as e:
        logger.exception("Projection run %s failed", run_id)
        await _patch_run(run_id, status="error", progress={"stage": "error"}, error=str(e)[:300])


async def _run_scenario_task(run_id: str, brief: dict, assignments: list, horizon: int):
    try:
        result = await run_scenario(
            brief, assignments, horizon=horizon, on_progress=_progress_writer(run_id)
        )
        await _patch_run(
            run_id,
            status="complete",
            progress={"stage": "complete"},
            assignments=result["assignments"],
            mode=result["mode"],
            opening=result["opening"],
            years=result["years"],
            debrief=result["debrief"],
        )
    except Exception as e:
        logger.exception("Scenario run %s failed", run_id)
        await _patch_run(run_id, status="error", progress={"stage": "error"}, error=str(e)[:300])


@api_router.get("/warroom/teams")
async def warroom_teams():
    """Each commander with the two consuls he would actually seat."""
    return {"teams": war_room_teams()}


@api_router.post("/warroom/projection", status_code=202, response_model=RunAccepted)
async def warroom_projection(req: ProjectionRequest, background_tasks: BackgroundTasks):
    """Every team forecasts the horizon; the forecasts are then read against
    each other. Runs in the background — poll /warroom/run/{id}."""
    await _enforce_paywall(req.archive_id)
    brief_doc = await _resolve_brief(req.brief_id, req.topic, req.pasted, req.live)
    horizon = clamp_horizon(req.horizon_years)

    run = await _create_run(
        "projection", brief_doc.get("topic", req.topic or ""), horizon, brief_doc,
        teams=req.teams or team_ids(),
    )
    background_tasks.add_task(
        _run_projections_task, run["id"], brief_doc["brief"], horizon, req.teams
    )
    return RunAccepted(run_id=run["id"], kind="projection", status="running")


@api_router.post("/warroom/scenario", status_code=202, response_model=RunAccepted)
async def warroom_scenario(req: ScenarioRequest, background_tasks: BackgroundTasks):
    """Play the horizon out year by year.

    One actor with every team advising it, or several actors with the teams
    split between them — the same engine either way.
    """
    await _enforce_paywall(req.archive_id)

    assignments = sanitize_assignments([a.model_dump() for a in req.assignments])
    if not assignments:
        raise HTTPException(
            status_code=400,
            detail="Each actor needs a name and at least one team, and a team can only play one side.",
        )

    brief_doc = await _resolve_brief(req.brief_id, req.topic, req.pasted, req.live)
    horizon = clamp_horizon(req.horizon_years)

    run = await _create_run(
        "scenario", brief_doc.get("topic", req.topic or ""), horizon, brief_doc,
        assignments=assignments,
        mode="confrontation" if len(assignments) > 1 else "single_actor",
    )
    background_tasks.add_task(
        _run_scenario_task, run["id"], brief_doc["brief"], assignments, horizon
    )
    return RunAccepted(run_id=run["id"], kind="scenario", status="running")


@api_router.get("/warroom/run/{run_id}", response_model=RunResponse)
async def warroom_run(run_id: str):
    """Poll a projection or scenario run. Partial results are returned as they land."""
    doc = await db.warroom_runs.find_one({"id": run_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Run not found")

    def when(value):
        return datetime.fromisoformat(value) if isinstance(value, str) else value

    return RunResponse(
        id=doc["id"],
        kind=doc.get("kind", ""),
        status=doc.get("status", "running"),
        topic=doc.get("topic", ""),
        horizon=doc.get("horizon", 5),
        progress=doc.get("progress") or {},
        brief=doc.get("brief") or {},
        assignments=doc.get("assignments") or [],
        projections=doc.get("projections") or [],
        comparison=doc.get("comparison") or {},
        opening=doc.get("opening") or [],
        years=doc.get("years") or [],
        debrief=doc.get("debrief") or {},
        error=doc.get("error", ""),
        created_at=when(doc.get("created_at")) or datetime.now(timezone.utc),
        updated_at=when(doc.get("updated_at")),
    )


@api_router.get("/warroom/estimate/{record_id}", response_model=WarRoomEstimateResponse)
async def warroom_estimate(record_id: str):
    """Re-read a War Room session in full — brief, board and estimate."""
    doc = await db.verdicts.find_one(
        {"id": record_id, "chamber_id": "warroom"}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="War Room session not found")
    created = doc.get("created_at")
    return WarRoomEstimateResponse(
        id=doc["id"],
        topic=doc.get("topic") or doc.get("question", ""),
        question=doc.get("question", ""),
        brief=doc.get("brief") or {},
        sources=doc.get("sources") or {},
        items=doc.get("items") or [],
        board=doc.get("board") or [],
        estimate=doc.get("estimate") or {},
        verdict=doc.get("verdict", ""),
        saved=bool(doc.get("saved", False)),
        created_at=(
            datetime.fromisoformat(created) if isinstance(created, str)
            else created or datetime.now(timezone.utc)
        ),
    )


# --------------------------------------------------------------------------- #
# Court Sessions — invite-witness courtroom flow                              #
# --------------------------------------------------------------------------- #

async def _run_court_deliberation(session_id: str):
    """Background task: route + deliberate + write verdict to the session."""
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return
    try:
        payload = await run_deliberation(session["chamber_id"], session["question"])
        await db.court_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "objection_window",
                "deliberation": payload.get("deliberation", []),
                "verdict": payload.get("verdict", ""),
                "committee": bool(payload.get("committee", False)),
                "witnesses_called": payload.get("witnesses_called") or session.get("witnesses_called", []),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    except Exception:
        logger.exception("Court deliberation failed for %s", session_id)
        await db.court_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )


async def _run_court_amendment(session_id: str, objector_name: str, content: str):
    """Background task: re-deliberate after an objection."""
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        return
    try:
        result = await amend_verdict(
            chamber_id=session["chamber_id"],
            question=session["question"],
            original_verdict=session.get("verdict", ""),
            objector_name=objector_name,
            objection_content=content,
        )
        await db.court_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "amended",
                "amended_verdict": result.get("amended_verdict", ""),
                "amendment_ruling": result.get("ruling", "amend"),
                "amendment_concession": result.get("concession", ""),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
    except Exception:
        logger.exception("Court amendment failed for %s", session_id)
        await db.court_sessions.update_one(
            {"id": session_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc).isoformat()}},
        )


@api_router.post("/court/create")
async def court_create(req: CourtCreateRequest):
    """Create a new court session. Routes the question, freezes the panel, returns share link."""
    q = req.question.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Question is required")

    # Paywall gate (court convening counts the same as solo deliberation)
    await _enforce_paywall(req.archive_id)

    routing = await route_and_panel(q)

    host_attendee_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    host_name = (req.host_name or "Host").strip()[:40] or "Host"

    session = {
        "id": session_id,
        "host_archive_id": req.archive_id,
        "question": q,
        "chamber_id": routing["chamber_id"],
        "witnesses_called": routing["witnesses_called"],
        "panel": routing["panel"],
        "reasoning": routing.get("reasoning", ""),
        "attendees": [{
            "id": host_attendee_id,
            "name": host_name,
            "is_host": True,
            "joined_at": now,
        }],
        "status": "open",  # open -> deliberating -> objection_window -> closed/amended
        "deliberation": [],
        "verdict": None,
        "amended_verdict": None,
        "amendment_ruling": None,
        "amendment_concession": None,
        "objection": None,
        "committee": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.court_sessions.insert_one(session)
    return {
        "session_id": session_id,
        "share_path": make_share_path(session_id),
        "host_attendee_id": host_attendee_id,
        "session": public_session(session),
    }


@api_router.get("/court/{session_id}")
async def court_get(session_id: str):
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Court session not found")
    return public_session(session)


@api_router.post("/court/{session_id}/join")
async def court_join(session_id: str, req: CourtJoinRequest):
    name = req.name.strip()[:40]
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Court session not found")
    if session["status"] not in ("open", "deliberating", "objection_window"):
        # closed sessions still let people view but not join
        raise HTTPException(status_code=409, detail="This court is no longer accepting witnesses")

    attendee_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    attendee = {"id": attendee_id, "name": name, "is_host": False, "joined_at": now}
    await db.court_sessions.update_one(
        {"id": session_id},
        {"$push": {"attendees": attendee}, "$set": {"updated_at": now}},
    )
    return {"attendee_id": attendee_id}


@api_router.post("/court/{session_id}/begin", status_code=202)
async def court_begin(session_id: str, req: CourtBeginRequest, background_tasks: BackgroundTasks):
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Court session not found")
    host = next((a for a in session["attendees"] if a.get("is_host")), None)
    if not host or host["id"] != req.attendee_id:
        raise HTTPException(status_code=403, detail="Only the host may convene the court")
    if session["status"] != "open":
        raise HTTPException(status_code=409, detail="Court has already convened")
    await db.court_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "deliberating",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    background_tasks.add_task(_run_court_deliberation, session_id)
    return {"ok": True}


@api_router.post("/court/{session_id}/object", status_code=202)
async def court_object(session_id: str, req: CourtObjectRequest, background_tasks: BackgroundTasks):
    content = req.content.strip()
    name = req.name.strip()[:40]
    if not content:
        raise HTTPException(status_code=400, detail="Objection content is required")
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Court session not found")
    if session["status"] != "objection_window":
        raise HTTPException(status_code=409, detail="The court is not accepting objections")
    attendee = next((a for a in session["attendees"] if a["id"] == req.attendee_id), None)
    if not attendee:
        raise HTTPException(status_code=403, detail="You are not seated in this court")

    now = datetime.now(timezone.utc).isoformat()
    await db.court_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "objection",
            "objection": {
                "by_attendee_id": req.attendee_id,
                "by_name": name or attendee.get("name") or "A witness",
                "content": content,
                "created_at": now,
            },
            "updated_at": now,
        }},
    )
    background_tasks.add_task(_run_court_amendment, session_id, name or attendee.get("name", "A witness"), content)
    return {"ok": True}


@api_router.post("/court/{session_id}/close")
async def court_close(session_id: str, req: CourtBeginRequest):
    session = await db.court_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Court session not found")
    host = next((a for a in session["attendees"] if a.get("is_host")), None)
    if not host or host["id"] != req.attendee_id:
        raise HTTPException(status_code=403, detail="Only the host may close the court")
    if session["status"] not in ("objection_window", "amended"):
        raise HTTPException(status_code=409, detail="This court cannot be closed yet")
    await db.court_sessions.update_one(
        {"id": session_id},
        {"$set": {
            "status": "closed",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True}


# --------------------------------------------------------------------------- #
# App wiring                                                                  #
# --------------------------------------------------------------------------- #

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
