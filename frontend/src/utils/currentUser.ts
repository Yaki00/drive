const STORAGE_KEY = 'bookmarks-current-user';
const DEFAULT_USER = 'Anonyme';

export function getCurrentUser(): string {
  return localStorage.getItem(STORAGE_KEY)?.trim() || DEFAULT_USER;
}

export function setCurrentUser(name: string): string {
  const trimmed = name.trim() || DEFAULT_USER;
  localStorage.setItem(STORAGE_KEY, trimmed);
  return trimmed;
}
