// Per-browser archive id, stored in localStorage.
// Lets MongoDB persistence work without auth: we tag verdicts with this id.
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
