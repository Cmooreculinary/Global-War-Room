import axios from "axios";
import { getArchiveId } from "./storage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const http = axios.create({ baseURL: API, timeout: 90000 });

export async function fetchChamber(chamberId) {
  const { data } = await http.get(`/chambers/${chamberId}`);
  return data;
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
