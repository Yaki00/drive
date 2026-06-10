import type { Card, ReorderItem } from '../types';

export function buildReorderPayload(card: Card): ReorderItem[] {
  const items: ReorderItem[] = [];

  const rootEntries = [
    ...card.folders.map((folder) => ({
      type: 'folder' as const,
      id: folder.id,
      sortOrder: folder.sortOrder,
    })),
    ...card.links.map((link) => ({
      type: 'link' as const,
      id: link.id,
      sortOrder: link.sortOrder,
      folderId: null as number | null,
    })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  rootEntries.forEach((entry, index) => {
    if (entry.type === 'folder') {
      items.push({ type: 'folder', id: entry.id, sortOrder: index });
    } else {
      items.push({ type: 'link', id: entry.id, sortOrder: index, folderId: null });
    }
  });

  card.folders.forEach((folder) => {
    const sortedLinks = [...folder.links].sort((a, b) => a.sortOrder - b.sortOrder);
    sortedLinks.forEach((link, index) => {
      items.push({ type: 'link', id: link.id, sortOrder: index, folderId: folder.id });
    });
  });

  return items;
}
