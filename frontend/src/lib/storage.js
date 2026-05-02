// Per-browser archive id, stored in localStorage.
//
// NOTE: This is **not** a security token. It is an opaque, randomly-generated
// UUID whose only purpose is to scope which saved verdicts belong to *this*
// browser. There is no authentication in this application — losing this id
// simply means the user can no longer see their own archive (the verdicts
// remain in the database, unreachable). XSS reading this id has no security
// impact: there is nothing to exfiltrate or impersonate.
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
