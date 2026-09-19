"""Safe resolution of SPA static files under the frontend build directory."""
from __future__ import annotations

from pathlib import Path
from typing import Optional


def resolved_spa_file(build_dir: Path, full_path: str) -> Optional[Path]:
    """Return a file under build_dir, or None if the path is empty, missing, or escapes."""
    if not full_path or "\x00" in full_path:
        return None
    root = build_dir.resolve()
    candidate = (build_dir / full_path).resolve()
    if not candidate.is_relative_to(root):
        return None
    if candidate.is_file():
        return candidate
    return None
