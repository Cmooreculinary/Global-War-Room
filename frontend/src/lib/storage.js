// Per-browser archive id, stored in localStorage.
//
// NOTE: This is an opaque, randomly-generated UUID. The server now requires it
// on metered routes and uses it to count free verdicts and membership. It is
// still not a signed credential — rotating it mints a new free quota — so
// expensive routes are also rate-limited by IP. Losing the id means this
// browser can no longer see its archive (the verdicts remain in the database).
//
// localStorage is the correct storage for this use-case: it persists across
// tabs and sessions, which is the desired behaviour. sessionStorage would
// throw away the archive every time the user closes the tab.
const KEY = "cortex.archive_id";
const COURT_KEY = "cortex.court_seats";

export function getArchiveId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      `arch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

// Court session seat persistence — keyed by session_id so a witness can
// refresh and stay seated. Stored as { [sessionId]: { attendeeId, name } }.
export function getCourtSeat(sessionId) {
  try {
    const raw = localStorage.getItem(COURT_KEY);
    if (!raw) return null;
    const seats = JSON.parse(raw);
    return seats[sessionId] || null;
  } catch {
    return null;
  }
}

export function saveCourtSeat(sessionId, seat) {
  try {
    const raw = localStorage.getItem(COURT_KEY);
    const seats = raw ? JSON.parse(raw) : {};
    seats[sessionId] = seat;
    localStorage.setItem(COURT_KEY, JSON.stringify(seats));
  } catch {
    // ignore
  }
}
