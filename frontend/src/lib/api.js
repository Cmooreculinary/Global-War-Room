import axios from "axios";
import { getArchiveId } from "./storage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, timeout: 90000 });

export async function fetchChamber(chamberId) {
  const { data } = await http.get(`/chambers/${chamberId}`);
  return data;
}

export async function fetchPersonas() {
  const { data } = await http.get(`/personas`);
  return data;
}

export async function routeQuestion(question) {
  const { data } = await http.post(`/route`, { question });
  return data;
}

export async function transcribeAudio(blob, filename = "recording.webm") {
  const form = new FormData();
  form.append("audio", blob, filename);
  const { data } = await http.post(`/transcribe`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data; // { text }
}

export async function speakAudioUrl(text, chamberId) {
  // Returns a blob URL for an MP3 the caller can assign to <audio src=…>.
  const response = await fetch(`${API}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, chamber_id: chamberId }),
  });
  if (!response.ok) {
    throw new Error(`Speech failed: ${response.status}`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function deliberate(chamberId, question) {
  const { data } = await http.post(`/deliberate`, {
    chamber_id: chamberId,
    question,
    archive_id: getArchiveId(),
  });
  return data;
}

export async function fetchVerdict(verdictId) {
  const { data } = await http.get(`/verdicts/${verdictId}`);
  return data;
}

export async function saveVerdict(verdictId) {
  const { data } = await http.post(`/verdicts/${verdictId}/save`, {
    archive_id: getArchiveId(),
  });
  return data;
}

export async function deleteFromArchive(verdictId) {
  const { data } = await http.delete(`/verdicts/${verdictId}`, {
    params: { archive_id: getArchiveId() },
  });
  return data;
}

export async function fetchArchive() {
  const { data } = await http.get(`/verdicts`, {
    params: { archive_id: getArchiveId() },
  });
  return data;
}

// ---- Court session API ---------------------------------------------------- //

export async function createCourtSession({ question, hostName }) {
  const { data } = await http.post(`/court/create`, {
    question,
    host_name: hostName,
    archive_id: getArchiveId(),
  });
  return data; // { session_id, share_path, host_attendee_id, session }
}

export async function fetchCourtSession(sessionId) {
  const { data } = await http.get(`/court/${sessionId}`);
  return data;
}

export async function joinCourtSession(sessionId, name) {
  const { data } = await http.post(`/court/${sessionId}/join`, { name });
  return data; // { attendee_id }
}

export async function beginCourt(sessionId, attendeeId) {
  const { data } = await http.post(`/court/${sessionId}/begin`, { attendee_id: attendeeId });
  return data;
}

export async function objectInCourt(sessionId, { attendeeId, name, content }) {
  const { data } = await http.post(`/court/${sessionId}/object`, {
    attendee_id: attendeeId,
    name,
    content,
  });
  return data;
}

export async function closeCourt(sessionId, attendeeId) {
  const { data } = await http.post(`/court/${sessionId}/close`, { attendee_id: attendeeId });
  return data;
}

// ---- War Room API -------------------------------------------------------- //

export async function fetchWarRoomSources() {
  const { data } = await http.get(`/warroom/sources`);
  return data; // { live_enabled, search, feeds, state_feeds, note }
}

export async function buildWarRoomBrief({ topic, pasted = "", live = true, windowHours = 24, includeState = false }) {
  const { data } = await http.post(
    `/warroom/brief`,
    { topic, pasted, live, window_hours: windowHours, include_state: includeState },
    { timeout: 180000 }
  );
  return data; // { id, topic, brief, sources, items }
}

export async function conveneWarRoom({ briefId, topic, question = "" }) {
  const { data } = await http.post(
    `/warroom/convene`,
    { brief_id: briefId, topic, question, archive_id: getArchiveId() },
    { timeout: 300000 }
  );
  return data; // { id, brief, board, estimate, … }
}

export async function fetchWarRoomEstimate(recordId) {
  const { data } = await http.get(`/warroom/estimate/${recordId}`);
  return data;
}

// ---- Team modes: projections and played-out scenarios --------------------- //

export async function fetchWarRoomTeams() {
  const { data } = await http.get(`/warroom/teams`);
  return data; // { teams: [{ id, leader, consuls }] }
}

export async function startProjection({ briefId, topic, horizonYears = 5, teams = [] }) {
  const { data } = await http.post(`/warroom/projection`, {
    brief_id: briefId,
    topic,
    horizon_years: horizonYears,
    teams,
    archive_id: getArchiveId(),
  });
  return data; // { run_id, kind, status }
}

export async function startScenario({ briefId, topic, horizonYears = 5, assignments }) {
  const { data } = await http.post(`/warroom/scenario`, {
    brief_id: briefId,
    topic,
    horizon_years: horizonYears,
    assignments,
    archive_id: getArchiveId(),
  });
  return data; // { run_id, kind, status }
}

export async function fetchRun(runId) {
  const { data } = await http.get(`/warroom/run/${runId}`);
  return data;
}

/**
 * Poll a run until it finishes. Partial results arrive on every tick — a
 * scenario writes each year as it is played — so `onUpdate` is how the caller
 * shows the exercise unfolding rather than a spinner. Returns a cancel fn.
 */
export function pollRun(runId, onUpdate, { intervalMs = 4000, onDone, onError } = {}) {
  let cancelled = false;
  let timer = null;

  const tick = async () => {
    if (cancelled) return;
    try {
      const run = await fetchRun(runId);
      if (cancelled) return;
      onUpdate?.(run);
      if (run.status === "complete" || run.status === "error") {
        if (run.status === "error") onError?.(new Error(run.error || "The run failed."));
        else onDone?.(run);
        return;
      }
    } catch (e) {
      if (cancelled) return;
      // A dropped poll is not fatal — the run continues server-side. Keep trying.
    }
    timer = setTimeout(tick, intervalMs);
  };

  tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

// ---- Billing API --------------------------------------------------------- //

export async function fetchPlans() {
  const { data } = await http.get(`/billing/plans`);
  return data; // { plans, free_limit }
}

export async function fetchEntitlement() {
  const { data } = await http.get(`/billing/me`, {
    params: { archive_id: getArchiveId() },
  });
  return data;
}

export async function startCheckout(planId) {
  const { data } = await http.post(`/billing/checkout`, {
    plan_id: planId,
    archive_id: getArchiveId(),
    origin_url: window.location.origin,
  });
  return data; // { url, session_id }
}

export async function getCheckoutStatus(sessionId) {
  const { data } = await http.get(`/billing/status/${sessionId}`);
  return data;
}
