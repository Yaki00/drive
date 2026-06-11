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

export function getAuthorLabel(user: SessionUser): string {
  return `${user.id} - ${user.fullName}`;
}
