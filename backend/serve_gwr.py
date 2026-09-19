"""Single-process entrypoint: serve the built frontend + the /api backend on one port.

Run:  uvicorn serve_gwr:app --host 0.0.0.0 --port 8080

Reuses every /api route from server.py and adds static hosting for the compiled
React build (frontend/build) with SPA fallback so client-side routes like
/cortex resolve to index.html.
"""
from pathlib import Path

from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

from server import app  # noqa: E402  (registers all /api routes on import)
from spa_paths import resolved_spa_file

BUILD_DIR = Path(__file__).resolve().parent.parent / "frontend" / "build"

app.mount(
    "/static",
    StaticFiles(directory=BUILD_DIR / "static"),
    name="static",
)


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    # Unknown /api paths must not collapse to index.html (status 200).
    if full_path == "api" or full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    candidate = resolved_spa_file(BUILD_DIR, full_path)
    if candidate is not None:
        return FileResponse(candidate)
    return FileResponse(BUILD_DIR / "index.html")
