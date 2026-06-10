import { api } from '../api/client';
import type { Card, CreateLinkPayload, Link, ReorderItem } from '../types';

export async function restoreCard(snapshot: Card): Promise<void> {
  const created = await api.createCard({
    title: snapshot.title,
    description: snapshot.description ?? undefined,
    color: snapshot.color,
    tags: snapshot.tags,
  });

  const folderIdMap = new Map<number, number>();

  for (const folder of snapshot.folders) {
    const newFolder = await api.addFolder(created.id, {
      title: folder.title,
      description: folder.description ?? undefined,
    });
    folderIdMap.set(folder.id, newFolder.id);

    for (const link of folder.links) {
      await api.addLink(created.id, linkToPayload(link, newFolder.id));
    }
  }

  for (const link of snapshot.links) {
    await api.addLink(created.id, linkToPayload(link, null));
  }
}

export async function restoreLink(link: Link): Promise<void> {
  await api.addLink(link.cardId, linkToPayload(link, link.folderId));
}

export async function restoreFolder(
  cardId: number,
  folder: { title: string; description: string | null; links: Link[] },
): Promise<void> {
  const created = await api.addFolder(cardId, {
    title: folder.title,
    description: folder.description ?? undefined,
  });
  for (const link of folder.links) {
    await api.addLink(cardId, linkToPayload(link, created.id));
  }
}

function linkToPayload(link: Link, folderId: number | null): CreateLinkPayload {
  return {
    title: link.title,
    url: link.url,
    description: link.description ?? undefined,
    folderId: folderId ?? undefined,
    tags: link.tags,
    isFavorite: link.isFavorite,
    createdBy: link.createdBy ?? undefined,
  };
}

export function snapshotReorder(items: ReorderItem[]): ReorderItem[] {
  return items.map((item) => ({ ...item }));
}
