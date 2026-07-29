export interface SessionUser {
  id: string;
  fullName: string;
}

/** Session + JWT until enterprise auth is fully enforced. */
const STORAGE_KEY = 'bookmarks-session-user';
const TOKEN_KEY = 'bookmarks-auth-token';

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

/** Persist display session. Favorites are keyed by `user.id`. */
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

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAuth(): void {
  clearSessionUser();
  clearAuthToken();
}

export function getAuthorLabel(user: SessionUser): string {
  return `${user.id} - ${user.fullName}`;
}
