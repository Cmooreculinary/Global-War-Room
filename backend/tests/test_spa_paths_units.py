"""SPA path containment — no FastAPI import, no Mongo."""
from pathlib import Path

from spa_paths import resolved_spa_file


def test_serves_a_file_inside_the_build(tmp_path: Path):
    asset = tmp_path / "favicon.ico"
    asset.write_bytes(b"ico")
    assert resolved_spa_file(tmp_path, "favicon.ico") == asset.resolve()


def test_rejects_parent_traversal(tmp_path: Path):
    secret = tmp_path.parent / "secret.env"
    secret.write_text("ANTHROPIC_API_KEY=leak")
    assert resolved_spa_file(tmp_path, "../secret.env") is None
    assert resolved_spa_file(tmp_path, "..\\secret.env") is None


def test_rejects_encoded_style_escape(tmp_path: Path):
    # The ASGI server decodes %2e%2e before the route sees the path.
    outside = tmp_path.parent / "outside.txt"
    outside.write_text("nope")
    assert resolved_spa_file(tmp_path, "../outside.txt") is None


def test_missing_and_empty_paths_are_none(tmp_path: Path):
    assert resolved_spa_file(tmp_path, "") is None
    assert resolved_spa_file(tmp_path, "no-such-file.js") is None


def test_nested_asset_stays_inside(tmp_path: Path):
    nested = tmp_path / "assets" / "app.js"
    nested.parent.mkdir()
    nested.write_text("ok")
    assert resolved_spa_file(tmp_path, "assets/app.js") == nested.resolve()
