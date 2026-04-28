"""Cerebral Cortex — FastAPI backend."""
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from cortex_service import deliberate_forge, deliberate_with_committee  # noqa: E402
from personas import CHAMBERS, RECONSTRUCTION_DISCLAIMER  # noqa: E402

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


class CouncilMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    dates: Optional[str] = None
    lineage: str
    glyph: str
    voice_notes: str
    sources: Optional[List[Source]] = None


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


@api_router.post("/deliberate", response_model=Verdict)
async def deliberate(req: DeliberateRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")
    if req.chamber_id not in CHAMBERS:
        raise HTTPException(status_code=404, detail="Chamber not found")

    try:
        if req.chamber_id == "forge":
            payload = await deliberate_forge(req.question)
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
