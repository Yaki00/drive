const DEFAULT_API_URL = 'http://localhost:3001';

export async function getApiUrl() {
  const stored = await chrome.storage.sync.get({ apiUrl: DEFAULT_API_URL });
  return String(stored.apiUrl || DEFAULT_API_URL).replace(/\/$/, '');
}

export async function setApiUrl(apiUrl) {
  await chrome.storage.sync.set({ apiUrl: String(apiUrl).replace(/\/$/, '') });
}
