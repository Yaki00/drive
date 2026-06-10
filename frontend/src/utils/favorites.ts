import type { Card, FavoriteLink, Link } from '../types';

export function extractFavorites(cards: Card[]): FavoriteLink[] {
  const favorites: FavoriteLink[] = [];

  for (const card of cards) {
    const collect = (link: Link) => {
      if (link.isFavorite) {
        favorites.push({
          ...link,
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
