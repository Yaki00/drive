export interface SessionUser {
  id: string;
  fullName: string;
}

/** Display-only until enterprise auth is added later — not wired to login. */
const STORAGE_KEY = 'bookmarks-session-user';

const DEFAULT_USER: SessionUser = {
  id: 'guest',
  fullName: 'Guest',
};

export function getDisplayUser(): SessionUser {
  return getSessionUser() ?? DEFAULT_USER;
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed.id?.trim() || !parsed.fullName?.trim()) return null;
    return { id: parsed.id.trim(), fullName: parsed.fullName.trim() };
  } catch {
    return null;
  }
}

/** Persist display session (guest until real auth). Favorites are keyed by `user.id`. */
export function setSessionUser(user: SessionUser): void {
  const next: SessionUser = {
    id: user.id.trim(),
    fullName: user.fullName.trim(),
  };
  if (!next.id || !next.fullName) {
    throw new Error('Session user requires id and fullName');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearSessionUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getAuthorLabel(user: SessionUser): string {
  return `${user.id} - ${user.fullName}`;
}
