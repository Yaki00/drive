import type { Card, FavoriteLink, Link } from '../types';

/** Per-user favorites in localStorage — not the shared link.isFavorite API field. */
const FAVORITES_KEY_PREFIX = 'bookmarks-favorites:';

export function favoritesStorageKey(userId: string): string {
  return `${FAVORITES_KEY_PREFIX}${userId}`;
}

function collectFavoriteIdsFromCards(cards: Card[]): Set<number> {
  const ids = new Set<number>();
  for (const card of cards) {
    for (const link of card.links) {
      if (link.isFavorite) ids.add(link.id);
    }
    for (const folder of card.folders) {
      for (const link of folder.links) {
        if (link.isFavorite) ids.add(link.id);
      }
    }
  }
  return ids;
}

export function loadFavoriteIds(userId: string): Set<number> {
  try {
    const raw = localStorage.getItem(favoritesStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
    );
  } catch {
    return new Set();
  }
}

export function saveFavoriteIds(userId: string, ids: Set<number>): void {
  localStorage.setItem(favoritesStorageKey(userId), JSON.stringify([...ids]));
}

/**
 * Load favorites for a user. First visit for `guest` seeds from legacy global
 * `link.isFavorite` once; other users start empty (key written so we don't re-seed).
 */
export function ensureFavoriteIds(userId: string, cards: Card[]): Set<number> {
  const key = favoritesStorageKey(userId);
  if (localStorage.getItem(key) !== null) {
    return loadFavoriteIds(userId);
  }

  const ids = userId === 'guest' ? collectFavoriteIdsFromCards(cards) : new Set<number>();
  saveFavoriteIds(userId, ids);
  return ids;
}

export function setLinkFavorite(
  userId: string,
  favoriteIds: Set<number>,
  linkId: number,
  favorite: boolean,
): Set<number> {
  const next = new Set(favoriteIds);
  if (favorite) next.add(linkId);
  else next.delete(linkId);
  saveFavoriteIds(userId, next);
  return next;
}

export function toggleLinkFavorite(
  userId: string,
  favoriteIds: Set<number>,
  linkId: number,
): { next: Set<number>; wasFavorite: boolean } {
  const wasFavorite = favoriteIds.has(linkId);
  return {
    next: setLinkFavorite(userId, favoriteIds, linkId, !wasFavorite),
    wasFavorite,
  };
}

/** Overlay per-user favorites onto cards so LinkCard / filters keep using link.isFavorite. */
export function applyFavoriteOverlay(cards: Card[], favoriteIds: Set<number>): Card[] {
  const overlayLink = (link: Link): Link => ({
    ...link,
    isFavorite: favoriteIds.has(link.id),
  });

  return cards.map((card) => ({
    ...card,
    links: card.links.map(overlayLink),
    folders: card.folders.map((folder) => ({
      ...folder,
      links: folder.links.map(overlayLink),
    })),
  }));
}

export function extractFavorites(cards: Card[], favoriteIds?: Set<number>): FavoriteLink[] {
  const favorites: FavoriteLink[] = [];

  for (const card of cards) {
    const collect = (link: Link) => {
      const isFavorite = favoriteIds ? favoriteIds.has(link.id) : link.isFavorite;
      if (isFavorite) {
        favorites.push({
          ...link,
          isFavorite: true,
          cardTitle: card.title,
          cardColor: card.color,
        });
      }
    };

    card.links.forEach(collect);
    card.folders.forEach((folder) => folder.links.forEach(collect));
  }

  return favorites.sort((a, b) => a.title.localeCompare(b.title));
}
