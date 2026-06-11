import type { Card, CreateLinkPayload, Folder, Link } from '../types';
import { isValidUrl, normalizeUrl } from './url';

export const LINK_EXPORT_VERSION = 1;

export interface ExportedLink {
  title: string;
  url: string;
  description?: string | null;
  tags?: string[];
  isFavorite?: boolean;
  sourceCardTitle?: string;
  sourceFolderTitle?: string | null;
}

export interface LinkExportFile {
  version: number;
  exportedAt: string;
  links: ExportedLink[];
}

export interface ParsedImportLink {
  index: number;
  title: string;
  url: string;
  description?: string;
  tags: string[];
  isFavorite: boolean;
  valid: boolean;
  error?: string;
}

export function findLinkInCards(cards: Card[], linkId: number): Link | undefined {
  for (const card of cards) {
    const root = card.links.find((link) => link.id === linkId);
    if (root) return root;
    for (const folder of card.folders) {
      const nested = folder.links.find((link) => link.id === linkId);
      if (nested) return nested;
    }
  }
  return undefined;
}

export function collectFoldersByIds(cards: Card[], folderIds: Iterable<number>): Folder[] {
  const idSet = new Set(folderIds);
  const result: Folder[] = [];
  for (const card of cards) {
    for (const folder of card.folders) {
      if (idSet.has(folder.id)) result.push(folder);
    }
  }
  return result;
}

export function collectLinksByIds(cards: Card[], linkIds: Iterable<number>): Link[] {
  const idSet = new Set(linkIds);
  const result: Link[] = [];
  for (const card of cards) {
    for (const link of card.links) {
      if (idSet.has(link.id)) result.push(link);
    }
    for (const folder of card.folders) {
      for (const link of folder.links) {
        if (idSet.has(link.id)) result.push(link);
      }
    }
  }
  return result;
}

export function linkToExported(link: Link, cards: Card[]): ExportedLink {
  const card = cards.find((item) => item.id === link.cardId);
  const folder = card?.folders.find((item) => item.id === link.folderId);
  return {
    title: link.title,
    url: link.url,
    description: link.description,
    tags: link.tags ?? [],
    isFavorite: link.isFavorite,
    sourceCardTitle: card?.title,
    sourceFolderTitle: folder?.title ?? null,
  };
}

export function buildExportFile(links: Link[], cards: Card[]): LinkExportFile {
  return {
    version: LINK_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    links: links.map((link) => linkToExported(link, cards)),
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportLinksFile(links: Link[], cards: Card[]): void {
  const payload = buildExportFile(links, cards);
  const date = new Date().toISOString().slice(0, 10);
  const suffix = links.length === 1 ? 'link' : 'links';
  downloadJson(payload, `aps-tools-${suffix}-${date}.json`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRawLink(raw: unknown, index: number): ParsedImportLink {
  if (!isRecord(raw)) {
    return {
      index,
      title: '',
      url: '',
      tags: [],
      isFavorite: false,
      valid: false,
      error: 'invalidShape',
    };
  }

  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const description =
    typeof raw.description === 'string'
      ? raw.description.trim()
      : raw.description === null
        ? ''
        : undefined;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
    : [];
  const isFavorite = raw.isFavorite === true;

  if (!title || !url) {
    return {
      index,
      title,
      url,
      description,
      tags,
      isFavorite,
      valid: false,
      error: 'missingFields',
    };
  }

  if (!isValidUrl(url)) {
    return {
      index,
      title,
      url,
      description,
      tags,
      isFavorite,
      valid: false,
      error: 'invalidUrl',
    };
  }

  return {
    index,
    title,
    url: normalizeUrl(url),
    description,
    tags,
    isFavorite,
    valid: true,
  };
}

function extractRawLinks(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (!isRecord(data)) return [];

  if (Array.isArray(data.links)) return data.links;
  if (typeof data.title === 'string' && typeof data.url === 'string') return [data];

  return [];
}

export function parseImportFile(content: string): ParsedImportLink[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  return extractRawLinks(parsed).map((item, index) => normalizeRawLink(item, index));
}

export function toCreatePayload(link: ParsedImportLink, createdBy: string): CreateLinkPayload {
  return {
    title: link.title,
    url: link.url,
    description: link.description || undefined,
    tags: link.tags,
    isFavorite: link.isFavorite,
    createdBy,
  };
}
