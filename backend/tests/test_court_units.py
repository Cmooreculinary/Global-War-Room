"""Court public-session redaction — the share-link contract."""
from court_service import public_session


def test_public_session_drops_host_archive_and_attendee_ids():
    raw = {
        "_id": "mongo-internal",
        "id": "sess-1",
        "question": "Should we hold?",
        "chamber_id": "senate",
        "host_archive_id": "arch-secret",
        "status": "open",
        "attendees": [
            {"id": "host-secret", "name": "Host", "is_host": True, "joined_at": "now"},
            {"id": "guest-secret", "name": "Ada", "is_host": False, "joined_at": "now"},
        ],
        "objection": {
            "by_attendee_id": "guest-secret",
            "by_name": "Ada",
            "content": "I dissent.",
            "created_at": "now",
        },
        "verdict": None,
    }
    public = public_session(raw)
    assert "_id" not in public
    assert "host_archive_id" not in public
    assert public["id"] == "sess-1"
    assert public["attendees"] == [
        {"name": "Host", "is_host": True},
        {"name": "Ada", "is_host": False},
    ]
    assert public["objection"] == {
        "by_name": "Ada",
        "content": "I dissent.",
        "created_at": "now",
    }
    dumped = str(public)
    assert "host-secret" not in dumped
    assert "guest-secret" not in dumped
    assert "arch-secret" not in dumped


def test_public_session_empty():
    assert public_session({}) == {
        "attendees": [],
        "objection": None,
    }
    assert public_session(None) is None
