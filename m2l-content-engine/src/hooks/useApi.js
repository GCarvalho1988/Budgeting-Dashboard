const BASE = '/api';

async function json(res) {
  if (!res.ok) throw new Error(`API ${res.status}: ${res.url}`);
  return res.json();
}

const headers = { 'Content-Type': 'application/json' };
const put  = (url, body) => fetch(url, { method: 'PUT',    headers, body: JSON.stringify(body) }).then(json);
const post = (url, body) => fetch(url, { method: 'POST',   headers, body: JSON.stringify(body) }).then(json);
const del  = (url)       => fetch(url, { method: 'DELETE' }).then(json);

export const getCampaign     = ()               => fetch(`${BASE}/campaign`).then(json);
export const updateCampaign  = (data)           => put(`${BASE}/campaign`, data);
export const getPostingRules = ()               => fetch(`${BASE}/posting-rules`).then(json);

export const getDrafts       = ()               => fetch(`${BASE}/drafts`).then(json);
export const getDraft        = (filename)       => fetch(`${BASE}/drafts/${filename}`).then(json);
export const updateDraft     = (filename, data) => put(`${BASE}/drafts/${filename}`, data);
export const deleteDraft     = (filename)       => del(`${BASE}/drafts/${filename}`);

export const addEvent        = (event)          => post(`${BASE}/events`, event);
export const deleteEvent     = (date)           => del(`${BASE}/events/${encodeURIComponent(date)}`);
