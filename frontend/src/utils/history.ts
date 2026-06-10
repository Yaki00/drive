export interface HistoryEntry {
  linkId: number;
  title: string;
  url: string;
  cardTitle: string;
  cardColor: string;
  openedAt: string;
}

const STORAGE_KEY = 'bookmarks-history';
const MAX_ENTRIES = 25;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addHistoryEntry(entry: Omit<HistoryEntry, 'openedAt'>) {
  const history = loadHistory().filter((h) => h.linkId !== entry.linkId);
  history.unshift({ ...entry, openedAt: new Date().toISOString() });
  saveHistory(history);
  return history;
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}
