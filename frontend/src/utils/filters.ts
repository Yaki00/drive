import type { Card, Link, LinkEnvironment } from '../types';
import { filterCards as searchFilter } from './search';

export interface FilterState {
  tags: string[];
  cardId: number | null;
  environment: LinkEnvironment | null;
  favoritesOnly: boolean;
  deadOnly: boolean;
  createdBy: string | null;
  dateFrom: string | null;
  dateTo: string | null;
}

export const emptyFilters: FilterState = {
  tags: [],
  cardId: null,
  environment: null,
  favoritesOnly: false,
  deadOnly: false,
  createdBy: null,
  dateFrom: null,
  dateTo: null,
};

function linkPassesDateFilter(link: Link, filters: FilterState): boolean {
  if (!filters.dateFrom && !filters.dateTo) return true;

  const created = new Date(link.createdAt);

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    from.setHours(0, 0, 0, 0);
    if (created < from) return false;
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    if (created > to) return false;
  }

  return true;
}

function linkPassesFilters(link: Link, filters: FilterState): boolean {
  if (filters.favoritesOnly && !link.isFavorite) return false;
  if (filters.deadOnly && !link.isDead) return false;
  if (filters.createdBy && link.createdBy !== filters.createdBy) return false;
  if (filters.environment && (link.environment ?? 'Not define') !== filters.environment) return false;
  if (!linkPassesDateFilter(link, filters)) return false;
  if (filters.tags.length > 0) {
    const linkTags = link.tags ?? [];
    if (!filters.tags.every((tag) => linkTags.includes(tag))) return false;
  }
  return true;
}

export function applyFilters(cards: Card[], searchQuery: string, filters: FilterState): Card[] {
  let result = searchFilter(cards, searchQuery);

  if (filters.cardId !== null) {
    result = result.filter((card) => card.id === filters.cardId);
  }

  const hasLinkFilters =
    filters.tags.length > 0 ||
    filters.favoritesOnly ||
    filters.deadOnly ||
    filters.createdBy !== null ||
    filters.environment !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null;

  if (!hasLinkFilters) return result;

  return result.reduce<Card[]>((acc, card) => {
    const filteredFolders = card.folders
      .map((folder) => ({
        ...folder,
        links: folder.links.filter((link) => linkPassesFilters(link, filters)),
      }))
      .filter((folder) => folder.links.length > 0);

    const filteredLinks = card.links.filter((link) => linkPassesFilters(link, filters));

    const cardTagsMatch =
      filters.tags.length === 0 ||
      filters.tags.every((tag) => (card.tags ?? []).includes(tag));

    if (!cardTagsMatch && filteredLinks.length === 0 && filteredFolders.length === 0) {
      return acc;
    }

    if (
      filters.favoritesOnly ||
      filters.deadOnly ||
      filters.createdBy ||
      filters.environment ||
      filters.dateFrom ||
      filters.dateTo
    ) {
      if (filteredLinks.length === 0 && filteredFolders.length === 0) return acc;
      acc.push({ ...card, folders: filteredFolders, links: filteredLinks });
    } else if (filters.tags.length > 0) {
      acc.push({
        ...card,
        folders: filteredFolders,
        links: cardTagsMatch ? card.links : filteredLinks,
      });
    } else {
      acc.push(card);
    }

    return acc;
  }, []);
}

export function hasActiveFilters(filters: FilterState): boolean {
  return (
    filters.tags.length > 0 ||
    filters.cardId !== null ||
    filters.environment !== null ||
    filters.favoritesOnly ||
    filters.deadOnly ||
    filters.createdBy !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null
  );
}
