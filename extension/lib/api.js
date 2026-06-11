import { getApiUrl } from './storage.js';

export async function apiRequest(path, options = {}) {
  const base = await getApiUrl();
  const response = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const error = await response.json();
      message = Array.isArray(error.message) ? error.message.join(', ') : error.message || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined;
  }

  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text);
}

export async function getCards() {
  return apiRequest('/cards');
}

export async function addLink(cardId, payload) {
  return apiRequest(`/cards/${cardId}/links`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addLinksBulk(cardId, links, folderId = null) {
  return apiRequest(`/cards/${cardId}/links/bulk`, {
    method: 'POST',
    body: JSON.stringify({ links, folderId }),
  });
}

export async function pingApi() {
  await getCards();
  return true;
}
