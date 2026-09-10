"""Single-process entrypoint: serve the built frontend + the /api backend on one port.

Run:  uvicorn serve_gwr:app --host 0.0.0.0 --port 8080

Reuses every /api route from server.py and adds static hosting for the compiled
React build (frontend/build) with SPA fallback so client-side routes like
/cortex resolve to index.html.
"""
from pathlib import Path

from fastapi.staticfiles import StaticFiles
from starlette.responses import FileResponse

from server import app  # noqa: E402  (registers all /api routes on import)

BUILD_DIR = Path(__file__).resolve().parent.parent / "frontend" / "build"

app.mount(
    "/static",
    StaticFiles(directory=BUILD_DIR / "static"),
    name="static",
)


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    # /api routes are registered before this catch-all, so they take precedence.
    candidate = BUILD_DIR / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    return FileResponse(BUILD_DIR / "index.html")
