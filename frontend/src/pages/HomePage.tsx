import AddIcon from '@mui/icons-material/Add';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ChecklistIcon from '@mui/icons-material/Checklist';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Snackbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { CardDropZone } from '../components/CardDropZone';
import { CardDialog } from '../components/CardDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FavoritesPanel } from '../components/FavoritesPanel';
import { FilterBar } from '../components/FilterBar';
import { FolderDialog } from '../components/FolderDialog';
import { HistoryPanel } from '../components/HistoryPanel';
import { ImportLinksDialog } from '../components/ImportLinksDialog';
import { LinkCard } from '../components/LinkCard';
import { LinkDialog } from '../components/LinkDialog';
import { Navbar } from '../components/Navbar';
import { SearchBar } from '../components/SearchBar';
import { BookmarksDndProvider } from '../context/BookmarksDndContext';
import { useLocale } from '../context/LocaleContext';
import { useUndo } from '../hooks/useUndo';
import type { TranslationKey } from '../i18n/translations';
import type {
  Card,
  CardOrderItem,
  CreateCardPayload,
  CreateFolderPayload,
  CreateLinkPayload,
  Folder,
  Link,
  ReorderItem,
} from '../types';
import { collectAllAuthors } from '../utils/collectAuthors';
import { getAuthorLabel, getDisplayUser } from '../utils/sessionUser';
import { extractFavorites } from '../utils/favorites';
import { applyFilters, emptyFilters, hasActiveFilters, type FilterState } from '../utils/filters';
import {
  addHistoryEntry,
  clearHistory,
  loadHistory,
  type HistoryEntry,
} from '../utils/history';
import { buildReorderPayload } from '../utils/reorder';
import { collectAllTags, countResults } from '../utils/search';
import { collectFoldersByIds, collectLinksByIds, exportLinksFile } from '../utils/linkTransfer';
import { restoreCard, restoreFolder, restoreLink, snapshotReorder } from '../utils/undoRestore';

type SnackbarState = { message: string; severity: 'success' | 'error' | 'info' | 'warning' };
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

function normalizeLink(link: Link): Link {
  return {
    ...link,
    tags: link.tags ?? [],
    isFavorite: link.isFavorite ?? false,
    isDead: link.isDead ?? false,
    sortOrder: link.sortOrder ?? 0,
    createdBy: link.createdBy ?? null,
  };
}

function normalizeCard(card: Card): Card {
  return {
    ...card,
    tags: card.tags ?? [],
    createdBy: card.createdBy ?? null,
    folders: (card.folders ?? []).map((folder) => ({
      ...folder,
      createdBy: folder.createdBy ?? null,
      links: (folder.links ?? []).map(normalizeLink),
    })),
    links: (card.links ?? []).map(normalizeLink),
  };
}

function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export function HomePage() {
  const { t } = useLocale();
  const displayUser = getDisplayUser();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const countLabel = useCallback(
    (count: number, one: TranslationKey, many: TranslationKey) =>
      t(count === 1 ? one : many, { count }),
    [t],
  );

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [activeCardId, setActiveCardId] = useState<number | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<number>>(() => new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<number>>(() => new Set());
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const {
    push,
    undo,
    redo,
    undoCount,
    redoCount,
    canUndo,
    canRedo,
  } = useUndo();

  const sortedCards = useMemo(() => sortCards(cards), [cards]);

  const filteredCards = useMemo(
    () => applyFilters(sortedCards, searchQuery, filters),
    [sortedCards, searchQuery, filters],
  );

  const stats = useMemo(() => countResults(cards), [cards]);
  const filteredStats = useMemo(() => countResults(filteredCards), [filteredCards]);
  const favorites = useMemo(() => extractFavorites(cards), [cards]);
  const tagSuggestions = useMemo(() => collectAllTags(cards), [cards]);
  const authorSuggestions = useMemo(() => collectAllAuthors(cards), [cards]);

  const notify = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ message, severity });
  }, []);

  const withAuthor = useCallback(
    <T extends object>(data: T): T & { createdBy: string } => ({
      ...data,
      createdBy: getAuthorLabel(displayUser),
    }),
    [displayUser],
  );

  const loadCards = useCallback(async () => {
    try {
      const data = await api.getCards();
      setCards(data.map(normalizeCard));
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error.loadCards');
      setError(message === 'Failed to fetch' ? t('error.server') : message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const runAction = useCallback(
    async (action: () => Promise<void>, successMsg?: string) => {
      try {
        await action();
        if (successMsg) notify(successMsg);
        return true;
      } catch (err) {
        notify(err instanceof Error ? err.message : t('error.generic'), 'error');
        return false;
      }
    },
    [notify, t],
  );

  const handleUndo = useCallback(async () => {
    const result = await undo();
    if (result.error) {
      notify(result.error, 'error');
      return;
    }
    if (result.label) {
      notify(t('snackbar.undo', { label: result.label }), 'info');
      await loadCards();
    }
  }, [undo, notify, loadCards, t]);

  const handleRedo = useCallback(async () => {
    const result = await redo();
    if (result.error) {
      notify(result.error, 'error');
      return;
    }
    if (result.label) {
      notify(t('snackbar.redo', { label: result.label }), 'info');
      await loadCards();
    }
  }, [redo, notify, loadCards, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) {
        void handleRedo();
      } else {
        void handleUndo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const handleSaveCard = async (data: CreateCardPayload) => {
    await runAction(async () => {
      if (editingCard) {
        const before = {
          title: editingCard.title,
          description: editingCard.description ?? undefined,
          color: editingCard.color,
          tags: editingCard.tags,
        };
        await api.updateCard(editingCard.id, data);
        push({
          label: t('undo.cardEdit'),
          undo: async () => { await api.updateCard(editingCard.id, before); },
          redo: async () => { await api.updateCard(editingCard.id, data); },
        });
        notify(t('snackbar.cardUpdated'));
      } else {
        const created = await api.createCard(withAuthor(data));
        push({
          label: t('undo.cardCreate'),
          undo: async () => { await api.deleteCard(created.id); },
          redo: async () => { await api.createCard(withAuthor(data)); },
        });
        notify(t('snackbar.cardCreated'));
      }
      await loadCards();
    });
  };

  const handleDeleteCard = (card: Card) => {
    setConfirm({
      title: t('confirm.deleteCardTitle'),
      message: t('confirm.deleteCardMessage', { title: card.title }),
      confirmLabel: t('confirm.delete'),
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const snapshot = JSON.parse(JSON.stringify(card)) as Card;
          await api.deleteCard(card.id);
          push({
            label: t('undo.cardDelete'),
            undo: async () => restoreCard(snapshot),
            redo: async () => { await api.deleteCard(card.id); },
          });
          notify(t('snackbar.cardDeleted'));
          await loadCards();
        });
      },
    });
  };

  const handleSaveLink = async (data: CreateLinkPayload & { cardId?: number }) => {
    await runAction(async () => {
      if (editingLink) {
        const before: Partial<CreateLinkPayload & { cardId?: number; folderId?: number | null }> = {
          title: editingLink.title,
          url: editingLink.url,
          description: editingLink.description ?? undefined,
          tags: editingLink.tags,
          isFavorite: editingLink.isFavorite,
          cardId: editingLink.cardId,
          folderId: editingLink.folderId,
        };
        const updatePayload = {
          title: data.title,
          url: data.url,
          description: data.description,
          tags: data.tags,
          isFavorite: data.isFavorite,
          cardId: data.cardId ?? editingLink.cardId,
          folderId: data.folderId ?? null,
        };
        await api.updateLink(editingLink.id, updatePayload);
        push({
          label: t('undo.linkEdit'),
          undo: async () => { await api.updateLink(editingLink.id, before); },
          redo: async () => { await api.updateLink(editingLink.id, updatePayload); },
        });
        notify(t('snackbar.linkUpdated'));
      } else if (activeCardId) {
        const created = (await api.addLink(activeCardId, withAuthor({
          ...data,
          folderId: activeFolderId ?? undefined,
        }))) as Link;
        const cardId = activeCardId;
        const folderId = activeFolderId;
        push({
          label: t('undo.linkAdd'),
          undo: async () => { await api.deleteLink(created.id); },
          redo: async () => {
            await api.addLink(cardId, withAuthor({ ...data, folderId: folderId ?? undefined }));
          },
        });
        notify(t('snackbar.linkAdded'));
      }
      setActiveFolderId(null);
      await loadCards();
    });
  };

  const handleDeleteLink = (link: Link) => {
    setConfirm({
      title: t('confirm.deleteLinkTitle'),
      message: t('confirm.deleteLinkMessage', { title: link.title }),
      confirmLabel: t('confirm.delete'),
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const snapshot = { ...link };
          await api.deleteLink(link.id);
          push({
            label: t('undo.linkDelete'),
            undo: async () => restoreLink(snapshot),
            redo: async () => { await api.deleteLink(link.id); },
          });
          notify(t('snackbar.linkDeleted'));
          await loadCards();
        });
      },
    });
  };

  const handleSaveFolder = async (data: CreateFolderPayload) => {
    await runAction(async () => {
      if (editingFolder) {
        const before = {
          title: editingFolder.title,
          description: editingFolder.description ?? undefined,
        };
        await api.updateFolder(editingFolder.id, data);
        push({
          label: t('undo.folderEdit'),
          undo: async () => { await api.updateFolder(editingFolder.id, before); },
          redo: async () => { await api.updateFolder(editingFolder.id, data); },
        });
        notify(t('snackbar.folderUpdated'));
      } else if (activeCardId) {
        const created = await api.addFolder(activeCardId, withAuthor(data));
        const cardId = activeCardId;
        push({
          label: t('undo.folderCreate'),
          undo: async () => { await api.deleteFolder(created.id); },
          redo: async () => { await api.addFolder(cardId, withAuthor(data)); },
        });
        notify(t('snackbar.folderCreated'));
      }
      await loadCards();
    });
  };

  const handleDeleteFolder = (folder: Folder) => {
    setConfirm({
      title: t('confirm.deleteFolderTitle'),
      message: t('confirm.deleteFolderMessage', { title: folder.title }),
      confirmLabel: t('confirm.delete'),
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const snapshot = { title: folder.title, description: folder.description, links: [...folder.links] };
          await api.deleteFolder(folder.id);
          push({
            label: t('undo.folderDelete'),
            undo: async () => restoreFolder(folder.cardId, snapshot),
            redo: async () => { await api.deleteFolder(folder.id); },
          });
          notify(t('snackbar.folderDeleted'));
          await loadCards();
        });
      },
    });
  };

  const handleToggleFavorite = async (link: Link) => {
    const wasFavorite = link.isFavorite;
    await runAction(async () => {
      await api.updateLink(link.id, { isFavorite: !wasFavorite });
      push({
        label: wasFavorite ? t('undo.favoriteRemove') : t('undo.favoriteAdd'),
        undo: async () => { await api.updateLink(link.id, { isFavorite: wasFavorite }); },
        redo: async () => { await api.updateLink(link.id, { isFavorite: !wasFavorite }); },
      });
      notify(wasFavorite ? t('snackbar.favoriteRemoved') : t('snackbar.favoriteAdded'));
      await loadCards();
    });
  };

  const handleMarkAlive = async (link: Link) => {
    await runAction(async () => {
      await api.updateLink(link.id, { isDead: false });
      push({
        label: t('undo.linkAlive'),
        undo: async () => { await api.updateLink(link.id, { isDead: true }); },
        redo: async () => { await api.updateLink(link.id, { isDead: false }); },
      });
      notify(t('snackbar.linkAlive'));
      await loadCards();
    });
  };

  const handleReorder = async (cardId: number, items: ReorderItem[]) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    await runAction(async () => {
      const before = snapshotReorder(buildReorderPayload(card));
      const after = snapshotReorder(items);
      await api.reorderCard(cardId, items);
      push({
        label: t('undo.reorder'),
        undo: async () => { await api.reorderCard(cardId, before); },
        redo: async () => { await api.reorderCard(cardId, after); },
      });
      await loadCards();
    });
  };

  const handleMoveLink = async (
    linkId: number,
    targetCardId: number,
    targetFolderId?: number | null,
  ) => {
    const found = cards.flatMap((c) => [
      ...c.links.map((l) => ({ link: l, cardId: c.id })),
      ...c.folders.flatMap((f) => f.links.map((l) => ({ link: l, cardId: c.id }))),
    ]).find((x) => x.link.id === linkId);

    if (!found) return;

    const before = {
      cardId: found.link.cardId,
      folderId: found.link.folderId,
    };

    await runAction(async () => {
      await api.moveLink(linkId, targetCardId, targetFolderId);
      push({
        label: t('undo.moveLink'),
        undo: async () => {
          await api.updateLink(linkId, {
            cardId: before.cardId,
            folderId: before.folderId,
          });
        },
        redo: async () => { await api.moveLink(linkId, targetCardId, targetFolderId); },
      });
      notify(t('snackbar.linkMoved'));
      await loadCards();
    });
  };

  const handleMoveCard = async (cardId: number, direction: 'left' | 'right') => {
    const sorted = sortCards(cards);
    const index = sorted.findIndex((c) => c.id === cardId);
    const swapIndex = direction === 'left' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= sorted.length) return;

    const before: CardOrderItem[] = sorted.map((c, i) => ({ id: c.id, sortOrder: i }));
    const next = [...sorted];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    const after: CardOrderItem[] = next.map((c, i) => ({ id: c.id, sortOrder: i }));

    await runAction(async () => {
      await api.reorderCards(after);
      push({
        label: t('undo.reorderCards'),
        undo: async () => { await api.reorderCards(before); },
        redo: async () => { await api.reorderCards(after); },
      });
      await loadCards();
    });
  };

  const handleCheckDeadLinks = async () => {
    setCheckingLinks(true);
    try {
      const result = await api.checkDeadLinks();
      const skipped = result.skipped
        ? t('snackbar.linksSkippedSuffix', { count: result.skipped })
        : '';
      const unreachable = result.unreachable
        ? t('snackbar.linksUnreachableSuffix', { count: result.unreachable })
        : '';
      notify(
        t('snackbar.linksChecked', {
          checked: result.checked,
          dead: result.dead,
          skipped,
          unreachable,
        }),
        result.unreachable ? 'warning' : 'info',
      );
      await loadCards();
    } catch (err) {
      notify(err instanceof Error ? err.message : t('error.checkFailed'), 'error');
    } finally {
      setCheckingLinks(false);
    }
  };

  const handleLinkOpen = (link: Link, cardTitle: string, cardColor: string) => {
    setHistory(addHistoryEntry({
      linkId: link.id,
      title: link.title,
      url: link.url,
      cardTitle,
      cardColor,
    }));
  };

  const handleHistoryOpen = (entry: HistoryEntry) => {
    setHistory(addHistoryEntry({
      linkId: entry.linkId,
      title: entry.title,
      url: entry.url,
      cardTitle: entry.cardTitle,
      cardColor: entry.cardColor,
    }));
    window.open(entry.url, '_blank', 'noopener,noreferrer');
  };

  const openCreateCard = () => {
    setEditingCard(null);
    setCardDialogOpen(true);
  };

  const openEditCard = (card: Card) => {
    setEditingCard(card);
    setCardDialogOpen(true);
  };

  const toggleLinkSelection = useCallback((linkId: number) => {
    setSelectedLinkIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  }, []);

  const toggleFolderSelection = useCallback((folderId: number) => {
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const selectedCount = selectedLinkIds.size + selectedFolderIds.size;

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedLinkIds(new Set());
    setSelectedFolderIds(new Set());
  }, []);

  const handleExportLinks = useCallback(
    (links: Link[]) => {
      if (links.length === 0) return;
      exportLinksFile(links, sortedCards);
      notify(
        links.length === 1
          ? t('snackbar.linkExported')
          : t('snackbar.linksExported', { count: links.length }),
      );
    },
    [notify, sortedCards, t],
  );

  const handleExportSelected = useCallback(() => {
    const links = collectLinksByIds(sortedCards, selectedLinkIds);
    handleExportLinks(links);
    exitSelectionMode();
  }, [selectedLinkIds, sortedCards, handleExportLinks, exitSelectionMode]);

  const handleDeleteSelected = useCallback(() => {
    const folders = collectFoldersByIds(sortedCards, selectedFolderIds);
    const links = collectLinksByIds(sortedCards, selectedLinkIds);
    const deletedFolderIds = new Set(folders.map((folder) => folder.id));
    const linksToDelete = links.filter(
      (link) => !link.folderId || !deletedFolderIds.has(link.folderId),
    );
    const total = folders.length + linksToDelete.length;
    if (total === 0) return;

    setConfirm({
      title: t('confirm.deleteSelectedTitle'),
      message: t('confirm.deleteSelectedMessage', { count: total }),
      confirmLabel: t('confirm.delete'),
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const folderSnapshots = folders.map((folder) => ({
            cardId: folder.cardId,
            snapshot: {
              title: folder.title,
              description: folder.description,
              links: [...folder.links],
            },
          }));
          const linkSnapshots = linksToDelete.map((link) => ({ ...link }));

          for (const folder of folders) {
            await api.deleteFolder(folder.id);
          }
          for (const link of linksToDelete) {
            await api.deleteLink(link.id);
          }

          push({
            label: t('undo.bulkDelete'),
            undo: async () => {
              for (const { cardId, snapshot } of folderSnapshots) {
                await restoreFolder(cardId, snapshot);
              }
              for (const link of linkSnapshots) {
                await restoreLink(link);
              }
            },
            redo: async () => {
              for (const folder of folders) {
                await api.deleteFolder(folder.id);
              }
              for (const link of linksToDelete) {
                await api.deleteLink(link.id);
              }
            },
          });

          notify(t('snackbar.itemsDeleted', { count: total }));
          exitSelectionMode();
          await loadCards();
        });
      },
    });
  }, [
    sortedCards,
    selectedFolderIds,
    selectedLinkIds,
    t,
    runAction,
    push,
    notify,
    exitSelectionMode,
    loadCards,
  ]);

  const handleImportLinks = useCallback(
    async (payloads: CreateLinkPayload[], cardId: number, folderId: number | null) => {
      await runAction(async () => {
        const createdIds: number[] = [];
        for (const payload of payloads) {
          const created = (await api.addLink(cardId, withAuthor({
            ...payload,
            folderId: folderId ?? undefined,
          }))) as Link;
          createdIds.push(created.id);
        }

        push({
          label: t('undo.linkImport'),
          undo: async () => {
            for (const id of createdIds) {
              await api.deleteLink(id);
            }
          },
          redo: async () => {
            for (const payload of payloads) {
              await api.addLink(cardId, withAuthor({
                ...payload,
                folderId: folderId ?? undefined,
              }));
            }
          },
        });

        notify(
          payloads.length === 1
            ? t('snackbar.linkImported')
            : t('snackbar.linksImported', { count: payloads.length }),
        );
        await loadCards();
      });
    },
    [runAction, withAuthor, push, t, notify, loadCards],
  );

  const openAddLink = (card: Card, folderId?: number) => {
    setEditingLink(null);
    setActiveCardId(card.id);
    setActiveFolderId(folderId ?? null);
    setLinkDialogOpen(true);
  };

  const openAddFolder = (card: Card) => {
    setEditingFolder(null);
    setActiveCardId(card.id);
    setFolderDialogOpen(true);
  };

  const openEditLink = (link: Link) => {
    setEditingLink(link);
    setActiveCardId(link.cardId);
    setActiveFolderId(link.folderId);
    setLinkDialogOpen(true);
  };

  const openEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setActiveCardId(folder.cardId);
    setFolderDialogOpen(true);
  };

  const isFiltering = searchQuery.trim().length > 0 || hasActiveFilters(filters);
  const dndDisabled = isFiltering || selectionMode;

  useEffect(() => {
    if (isFiltering && selectionMode) {
      setSelectionMode(false);
      setSelectedLinkIds(new Set());
      setSelectedFolderIds(new Set());
    }
  }, [isFiltering, selectionMode]);
  const displayCards = isFiltering ? filteredCards : sortedCards;
  const hasNoCards = !loading && !error && cards.length === 0;
  const hasNoResults = !loading && !error && cards.length > 0 && displayCards.length === 0;

  const newCardButton = (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={openCreateCard}
      sx={{
        bgcolor: '#FFFFFF',
        color: 'primary.main',
        px: 2.5,
        '&:hover': { bgcolor: '#F0F0F0' },
      }}
    >
      {t('nav.newCard')}
    </Button>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        sessionUser={displayUser}
        actionButton={newCardButton}
        onUndo={handleUndo}
        onRedo={handleRedo}
        undoCount={undoCount}
        redoCount={redoCount}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', py: 3 }}>
        <Container maxWidth="lg">
          {!loading && !error && cards.length > 0 && (
            <FavoritesPanel
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              onLinkOpen={(link) => handleLinkOpen(link, link.cardTitle, link.cardColor)}
            />
          )}

          {!loading && !error && history.length > 0 && (
            <HistoryPanel
              history={history}
              onClear={() => setHistory(clearHistory())}
              onOpen={handleHistoryOpen}
            />
          )}

          {!loading && !error && cards.length > 0 && (
            <>
              <Box sx={{ mb: 3 }}>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  resultCount={
                    isFiltering
                      ? filteredStats.cards + filteredStats.folders + filteredStats.links
                      : undefined
                  }
                />
              </Box>
              <FilterBar
                filters={filters}
                onChange={setFilters}
                cards={sortedCards}
                allTags={tagSuggestions}
                allAuthors={authorSuggestions}
              />
            </>
          )}

          {!loading && !error && cards.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip icon={<FolderOpenIcon />} label={countLabel(stats.cards, 'stats.cards', 'stats.cards_plural')} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', fontWeight: 600 }} />
              <Chip icon={<FolderOpenIcon />} label={countLabel(stats.folders, 'stats.folders', 'stats.folders_plural')} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', fontWeight: 600 }} />
              <Chip icon={<LinkIcon />} label={countLabel(stats.links, 'stats.links', 'stats.links_plural')} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', fontWeight: 600 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
                {selectionMode ? (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', px: 0.5 }}>
                      {t('export.selected', { count: selectedCount })}
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<FileDownloadIcon />}
                      onClick={handleExportSelected}
                      disabled={selectedLinkIds.size === 0}
                    >
                      {t('export.exportSelected')}
                    </Button>
                    <Tooltip title={t('export.deleteSelected')}>
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={handleDeleteSelected}
                          disabled={selectedCount === 0}
                          sx={{
                            border: '1px solid',
                            borderColor: 'error.main',
                            borderRadius: 1,
                            width: 34,
                            height: 34,
                          }}
                        >
                          <DeleteOutlinedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Button variant="outlined" size="small" onClick={exitSelectionMode}>
                      {t('export.cancelSelection')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ChecklistIcon />}
                      onClick={() => setSelectionMode(true)}
                    >
                      {t('export.selectItems')}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<FileUploadIcon />}
                      onClick={() => setImportDialogOpen(true)}
                    >
                      {t('import.button')}
                    </Button>
                  </>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={checkingLinks ? <CircularProgress size={14} /> : <LinkOffIcon />}
                  onClick={handleCheckDeadLinks}
                  disabled={checkingLinks || selectionMode}
                >
                  {t('stats.checkDead')}
                </Button>
              </Box>
            </Box>
          )}

          {dndDisabled && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
              {selectionMode ? t('stats.selectionMode') : t('stats.dndDisabled')}
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
              <CircularProgress color="primary" />
            </Box>
          )}

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 3, borderRadius: 1 }}
              action={
                <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => { setLoading(true); void loadCards(); }}>
                  {t('error.retry')}
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {hasNoCards && (
            <Box sx={{ textAlign: 'center', py: 10, px: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
              <BookmarkIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>{t('empty.noCards')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                {t('empty.noCardsHint')}
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateCard}>
                {t('empty.createCard')}
              </Button>
            </Box>
          )}

          {hasNoResults && (
            <Box sx={{ textAlign: 'center', py: 8, px: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
              <Typography variant="h6" gutterBottom>{t('empty.noResults')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('empty.noResultsHint')}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setFilters(emptyFilters);
                }}
              >
                {t('empty.clearFilters')}
              </Button>
            </Box>
          )}

          {!loading && displayCards.length > 0 && (
            <BookmarksDndProvider
              cards={sortedCards}
              onReorder={handleReorder}
              onMoveLinkToCard={(linkId, targetCardId) => handleMoveLink(linkId, targetCardId, null)}
              disabled={dndDisabled}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                  gap: 2.5,
                }}
              >
                {displayCards.map((card) => {
                  const globalIndex = sortedCards.findIndex((c) => c.id === card.id);
                  return (
                    <CardDropZone key={card.id} cardId={card.id}>
                      <LinkCard
                        card={card}
                        allCards={sortedCards}
                        onEditCard={openEditCard}
                        onDeleteCard={handleDeleteCard}
                        onAddLink={openAddLink}
                        onAddFolder={openAddFolder}
                        onEditLink={openEditLink}
                        onDeleteLink={handleDeleteLink}
                        onEditFolder={openEditFolder}
                        onDeleteFolder={handleDeleteFolder}
                        onToggleFavorite={handleToggleFavorite}
                        onMoveLink={handleMoveLink}
                        onMarkAlive={handleMarkAlive}
                        onLinkOpen={(link) => handleLinkOpen(link, card.title, card.color)}
                        canMoveLeft={!dndDisabled && globalIndex > 0}
                        canMoveRight={!dndDisabled && globalIndex >= 0 && globalIndex < sortedCards.length - 1}
                        onMoveCard={dndDisabled ? undefined : (direction) => handleMoveCard(card.id, direction)}
                        selectionMode={selectionMode}
                        selectedLinkIds={selectedLinkIds}
                        selectedFolderIds={selectedFolderIds}
                        onToggleLinkSelection={toggleLinkSelection}
                        onToggleFolderSelection={toggleFolderSelection}
                        onExportLink={(link) => handleExportLinks([link])}
                      />
                    </CardDropZone>
                  );
                })}
              </Box>
            </BookmarksDndProvider>
          )}
        </Container>
      </Box>

      <Box component="footer" sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', py: 2.5, mt: 'auto' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              {t('app.footer')}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {countLabel(stats.cards, 'stats.cards', 'stats.cards_plural')} · {countLabel(stats.folders, 'stats.folders', 'stats.folders_plural')} · {countLabel(stats.links, 'stats.links', 'stats.links_plural')}
            </Typography>
          </Box>
        </Container>
      </Box>

      <CardDialog open={cardDialogOpen} card={editingCard} onClose={() => setCardDialogOpen(false)} onSave={handleSaveCard} tagSuggestions={tagSuggestions} />
      <LinkDialog
        open={linkDialogOpen}
        link={editingLink}
        cards={sortedCards}
        onClose={() => { setLinkDialogOpen(false); setActiveFolderId(null); }}
        onSave={handleSaveLink}
        tagSuggestions={tagSuggestions}
      />
      <FolderDialog open={folderDialogOpen} folder={editingFolder} onClose={() => setFolderDialogOpen(false)} onSave={handleSaveFolder} />
      <ImportLinksDialog
        open={importDialogOpen}
        cards={sortedCards}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportLinks}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />

      <Snackbar
        open={!!snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar ? (
          <Alert onClose={() => setSnackbar(null)} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
