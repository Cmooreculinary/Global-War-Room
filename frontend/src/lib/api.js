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
