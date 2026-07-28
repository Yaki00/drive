import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import LinkIcon from '@mui/icons-material/Link';
import { Box, Typography } from '@mui/material';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Card, Link, ReorderItem } from '../types';
import { buildReorderPayload } from '../utils/reorder';

interface BookmarksDndContextValue {
  activeDragId: string | null;
}

const DndCtx = createContext<BookmarksDndContextValue>({ activeDragId: null });

export function useBookmarksDnd() {
  return useContext(DndCtx);
}

interface BookmarksDndProviderProps {
  cards: Card[];
  onReorder: (cardId: number, items: ReorderItem[]) => Promise<void>;
  onMoveLinkToCard: (linkId: number, targetCardId: number) => Promise<void>;
  disabled?: boolean;
  children: ReactNode;
}

function findLinkInCards(linkId: number, cards: Card[]): { link: Link; cardId: number } | null {
  for (const card of cards) {
    const root = card.links.find((l) => l.id === linkId);
    if (root) return { link: root, cardId: card.id };
    for (const folder of card.folders) {
      const nested = folder.links.find((l) => l.id === linkId);
      if (nested) return { link: nested, cardId: card.id };
    }
  }
  return null;
}

function processIntraCardDrag(
  card: Card,
  activeId: string,
  overId: string,
): Card | null {
  const rootItems = [
    ...card.folders.map((f) => ({ kind: 'folder' as const, data: f, sortOrder: f.sortOrder })),
    ...card.links.map((l) => ({ kind: 'link' as const, data: l, sortOrder: l.sortOrder })),
  ].sort((a, b) => a.sortOrder - b.sortOrder);

  const rootSortableIds = rootItems.map((item) =>
    item.kind === 'folder' ? `folder-${item.data.id}` : `link-${item.data.id}`,
  );

  const moveLinkInCard = (
    linkId: number,
    targetFolderId: number | null,
    targetIndex?: number,
  ): Card => {
    let movedLink: Link | undefined;

    const folders = card.folders.map((folder) => ({
      ...folder,
      links: folder.links.filter((link) => {
        if (link.id === linkId) {
          movedLink = { ...link, folderId: targetFolderId };
          return false;
        }
        return true;
      }),
    }));

    let rootLinks = card.links.filter((link) => {
      if (link.id === linkId) {
        movedLink = { ...link, folderId: targetFolderId };
        return false;
      }
      return true;
    });

    if (!movedLink) return card;
    movedLink = { ...movedLink, folderId: targetFolderId };

    if (targetFolderId === null) {
      const insertAt = targetIndex ?? rootLinks.length;
      rootLinks = [
        ...rootLinks.slice(0, insertAt),
        movedLink,
        ...rootLinks.slice(insertAt),
      ].map((link, index) => ({ ...link, sortOrder: index }));
      return { ...card, folders, links: rootLinks };
    }

    const updatedFolders = folders.map((folder) => {
      if (folder.id !== targetFolderId) return folder;
      const links = [...folder.links];
      const insertAt = targetIndex ?? links.length;
      links.splice(insertAt, 0, movedLink!);
      return { ...folder, links: links.map((link, index) => ({ ...link, sortOrder: index })) };
    });

    return { ...card, folders: updatedFolders, links: rootLinks };
  };

  if (activeId.startsWith('link-') && overId.startsWith('folder-drop-')) {
    const linkId = Number(activeId.replace('link-', ''));
    const folderId = Number(overId.replace('folder-drop-', ''));
    return moveLinkInCard(linkId, folderId);
  }

  if (
    activeId.startsWith('link-') &&
    (overId.startsWith(`root-drop-${card.id}`) ||
      overId.startsWith('folder-') ||
      overId.startsWith('link-'))
  ) {
    const linkId = Number(activeId.replace('link-', ''));
    const fromFolder = card.folders.some((f) => f.links.some((l) => l.id === linkId));
    if (fromFolder) {
      let targetIndex = card.links.length;
      if (overId.startsWith('link-')) {
        const overLinkId = Number(overId.replace('link-', ''));
        targetIndex = card.links.findIndex((l) => l.id === overLinkId);
      }
      return moveLinkInCard(linkId, null, targetIndex);
    }
  }

  if (activeId.startsWith('folder-') || activeId.startsWith('link-')) {
    const oldIndex = rootSortableIds.indexOf(activeId);
    const newIndex = rootSortableIds.indexOf(overId);
    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const reordered = arrayMove(rootItems, oldIndex, newIndex);
      const folders = reordered
        .filter((item) => item.kind === 'folder')
        .map((item, index) => ({ ...(item.data as Card['folders'][0]), sortOrder: index }));
      const links = reordered
        .filter((item) => item.kind === 'link')
        .map((item, index) => ({ ...(item.data as Link), sortOrder: index }));

      const folderMap = new Map(folders.map((f) => [f.id, f]));
      const updatedFolders = card.folders
        .map((f) => folderMap.get(f.id) ?? f)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      return { ...card, folders: updatedFolders, links };
    }
  }

  if (activeId.startsWith('link-') && overId.startsWith('link-')) {
    const activeLinkId = Number(activeId.replace('link-', ''));
    const overLinkId = Number(overId.replace('link-', ''));
    const activeFolder = card.folders.find((f) => f.links.some((l) => l.id === activeLinkId));
    const overFolder = card.folders.find((f) => f.links.some((l) => l.id === overLinkId));

    if (activeFolder && overFolder && activeFolder.id === overFolder.id) {
      const links = [...activeFolder.links].sort((a, b) => a.sortOrder - b.sortOrder);
      const oldIndex = links.findIndex((l) => l.id === activeLinkId);
      const newIndex = links.findIndex((l) => l.id === overLinkId);
      const reordered = arrayMove(links, oldIndex, newIndex).map((link, index) => ({
        ...link,
        sortOrder: index,
      }));
      const updatedFolders = card.folders.map((f) =>
        f.id === activeFolder.id ? { ...f, links: reordered } : f,
      );
      return { ...card, folders: updatedFolders };
    }
  }

  return null;
}

export function BookmarksDndProvider({
  cards,
  onReorder,
  onMoveLinkToCard,
  disabled = false,
  children,
}: BookmarksDndProviderProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null);
      if (disabled) return;

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId === overId) return;

      if (activeId.startsWith('link-') && overId.startsWith('card-drop-')) {
        const linkId = Number(activeId.replace('link-', ''));
        const targetCardId = Number(overId.replace('card-drop-', ''));
        const found = findLinkInCards(linkId, cards);
        if (found && found.cardId !== targetCardId) {
          await onMoveLinkToCard(linkId, targetCardId);
        }
        return;
      }

      if (!activeId.startsWith('link-') && !activeId.startsWith('folder-')) return;

      const sourceCardId = activeId.startsWith('folder-')
        ? cards.find((c) => c.folders.some((f) => f.id === Number(activeId.replace('folder-', ''))))?.id
        : findLinkInCards(Number(activeId.replace('link-', '')), cards)?.cardId;

      if (!sourceCardId) return;

      const card = cards.find((c) => c.id === sourceCardId);
      if (!card) return;

      const updated = processIntraCardDrag(card, activeId, overId);
      if (updated) {
        await onReorder(updated.id, buildReorderPayload(updated));
      }
    },
    [cards, disabled, onMoveLinkToCard, onReorder],
  );

  const activeLink = useMemo(() => {
    if (!activeDragId?.startsWith('link-')) return null;
    const id = Number(activeDragId.replace('link-', ''));
    return findLinkInCards(id, cards)?.link ?? null;
  }, [activeDragId, cards]);

  const value = useMemo(() => ({ activeDragId }), [activeDragId]);

  return (
    <DndCtx.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeLink && (
            <Box
              sx={{
                px: 1,
                py: 0.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0.5,
                boxShadow: 3,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <LinkIcon sx={{ fontSize: 14, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                {activeLink.title}
              </Typography>
            </Box>
          )}
        </DragOverlay>
      </DndContext>
    </DndCtx.Provider>
  );
}
