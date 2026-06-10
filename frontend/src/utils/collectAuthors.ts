import type { Card } from '../types';

export function collectAllAuthors(cards: Card[]): string[] {
  const authors = new Set<string>();

  for (const card of cards) {
    if (card.createdBy) authors.add(card.createdBy);
    for (const folder of card.folders) {
      if (folder.createdBy) authors.add(folder.createdBy);
      for (const link of folder.links) {
        if (link.createdBy) authors.add(link.createdBy);
      }
    }
    for (const link of card.links) {
      if (link.createdBy) authors.add(link.createdBy);
    }
  }

  return [...authors].sort((a, b) => a.localeCompare(b, 'fr'));
}
