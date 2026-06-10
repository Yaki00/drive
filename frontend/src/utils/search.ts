import type { Card, Folder, Link } from '../types';

function matches(text: string | null | undefined, query: string): boolean {
  return (text ?? '').toLowerCase().includes(query);
}

function tagsMatch(tags: string[] | undefined, query: string): boolean {
  return (tags ?? []).some((tag) => tag.toLowerCase().includes(query));
}

function linkMatches(link: Link, query: string): boolean {
  return (
    matches(link.title, query) ||
    matches(link.url, query) ||
    matches(link.description, query) ||
    tagsMatch(link.tags, query)
  );
}

function folderMatches(folder: Folder, query: string): boolean {
  return matches(folder.title, query) || matches(folder.description, query);
}

function cardMatches(card: Card, query: string): boolean {
  return (
    matches(card.title, query) ||
    matches(card.description, query) ||
    tagsMatch(card.tags, query)
  );
}

function countCardLinks(card: Card): number {
  const rootLinks = card.links.length;
  const folderLinks = card.folders.reduce((sum, folder) => sum + folder.links.length, 0);
  return rootLinks + folderLinks;
}

export function filterCards(cards: Card[], query: string): Card[] {
  const q = query.trim().toLowerCase();
  if (!q) return cards;

  return cards.reduce<Card[]>((result, card) => {
    const matchesCard = cardMatches(card, q);

    const filteredFolders = card.folders.reduce<Folder[]>((folders, folder) => {
      const folderTitleMatches = folderMatches(folder, q);
      const matchingLinks = folder.links.filter((link) => linkMatches(link, q));

      if (folderTitleMatches) {
        folders.push(folder);
      } else if (matchingLinks.length > 0) {
        folders.push({ ...folder, links: matchingLinks });
      }

      return folders;
    }, []);

    const matchingRootLinks = card.links.filter((link) => linkMatches(link, q));

    if (matchesCard) {
      result.push(card);
    } else if (filteredFolders.length > 0 || matchingRootLinks.length > 0) {
      result.push({
        ...card,
        folders: filteredFolders,
        links: matchingRootLinks,
      });
    }

    return result;
  }, []);
}

export function countResults(cards: Card[]): {
  cards: number;
  links: number;
  folders: number;
} {
  return {
    cards: cards.length,
    folders: cards.reduce((sum, card) => sum + card.folders.length, 0),
    links: cards.reduce((sum, card) => sum + countCardLinks(card), 0),
  };
}

export function collectAllTags(cards: Card[]): string[] {
  const tagSet = new Set<string>();
  for (const card of cards) {
    card.tags?.forEach((tag) => tagSet.add(tag));
    card.links.forEach((link) => link.tags?.forEach((tag) => tagSet.add(tag)));
    card.folders.forEach((folder) =>
      folder.links.forEach((link) => link.tags?.forEach((tag) => tagSet.add(tag))),
    );
  }
  return Array.from(tagSet).sort();
}
