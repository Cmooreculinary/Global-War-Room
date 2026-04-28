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

export function getArchiveId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      `arch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
