import AddIcon from '@mui/icons-material/Add';
import BookmarkIcon from '@mui/icons-material/Bookmark';
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
  Snackbar,
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
import { LinkCard } from '../components/LinkCard';
import { LinkDialog } from '../components/LinkDialog';
import { Navbar } from '../components/Navbar';
import { SearchBar } from '../components/SearchBar';
import { BookmarksDndProvider } from '../context/BookmarksDndContext';
import { useUndo } from '../hooks/useUndo';
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
import { getCurrentUser, setCurrentUser } from '../utils/currentUser';
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
import { restoreCard, restoreFolder, restoreLink, snapshotReorder } from '../utils/undoRestore';

type SnackbarState = { message: string; severity: 'success' | 'error' | 'info' };
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
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [currentUser, setCurrentUserState] = useState(getCurrentUser);

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
      createdBy: currentUser,
    }),
    [currentUser],
  );

  const loadCards = useCallback(async () => {
    try {
      const data = await api.getCards();
      setCards(data.map(normalizeCard));
      setError('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossible de charger les cartes';
      setError(
        message === 'Failed to fetch'
          ? 'Impossible de joindre le serveur. Vérifiez que le backend tourne sur le port 3001.'
          : message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const runAction = useCallback(
    async (action: () => Promise<void>, successMsg?: string) => {
      try {
        await action();
        if (successMsg) notify(successMsg);
        return true;
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Une erreur est survenue', 'error');
        return false;
      }
    },
    [notify],
  );

  const handleUndo = useCallback(async () => {
    const result = await undo();
    if (result.error) {
      notify(result.error, 'error');
      return;
    }
    if (result.label) {
      notify(`Retour : ${result.label}`, 'info');
      await loadCards();
    }
  }, [undo, notify, loadCards]);

  const handleRedo = useCallback(async () => {
    const result = await redo();
    if (result.error) {
      notify(result.error, 'error');
      return;
    }
    if (result.label) {
      notify(`Suivant : ${result.label}`, 'info');
      await loadCards();
    }
  }, [redo, notify, loadCards]);

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
          label: 'Modification carte',
          undo: async () => { await api.updateCard(editingCard.id, before); },
          redo: async () => { await api.updateCard(editingCard.id, data); },
        });
        notify('Carte mise à jour');
      } else {
        const created = await api.createCard(withAuthor(data));
        push({
          label: 'Création carte',
          undo: async () => { await api.deleteCard(created.id); },
          redo: async () => { await api.createCard(withAuthor(data)); },
        });
        notify('Carte créée');
      }
      await loadCards();
    });
  };

  const handleDeleteCard = (card: Card) => {
    setConfirm({
      title: 'Supprimer la carte',
      message: `Supprimer la carte « ${card.title} » et tous ses liens ?`,
      confirmLabel: 'Supprimer',
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const snapshot = JSON.parse(JSON.stringify(card)) as Card;
          await api.deleteCard(card.id);
          push({
            label: 'Suppression carte',
            undo: async () => restoreCard(snapshot),
            redo: async () => { await api.deleteCard(card.id); },
          });
          notify('Carte supprimée');
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
          label: 'Modification lien',
          undo: async () => { await api.updateLink(editingLink.id, before); },
          redo: async () => { await api.updateLink(editingLink.id, updatePayload); },
        });
        notify('Lien mis à jour');
      } else if (activeCardId) {
        const created = (await api.addLink(activeCardId, withAuthor({
          ...data,
          folderId: activeFolderId ?? undefined,
        }))) as Link;
        const cardId = activeCardId;
        const folderId = activeFolderId;
        push({
          label: 'Ajout lien',
          undo: async () => { await api.deleteLink(created.id); },
          redo: async () => {
            await api.addLink(cardId, withAuthor({ ...data, folderId: folderId ?? undefined }));
          },
        });
        notify('Lien ajouté');
      }
      setActiveFolderId(null);
      await loadCards();
    });
  };

  const handleDeleteLink = (link: Link) => {
    setConfirm({
      title: 'Supprimer le lien',
      message: `Supprimer le lien « ${link.title} » ?`,
      confirmLabel: 'Supprimer',
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const snapshot = { ...link };
          await api.deleteLink(link.id);
          push({
            label: 'Suppression lien',
            undo: async () => restoreLink(snapshot),
            redo: async () => { await api.deleteLink(link.id); },
          });
          notify('Lien supprimé');
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
          label: 'Modification dossier',
          undo: async () => { await api.updateFolder(editingFolder.id, before); },
          redo: async () => { await api.updateFolder(editingFolder.id, data); },
        });
        notify('Dossier mis à jour');
      } else if (activeCardId) {
        const created = await api.addFolder(activeCardId, withAuthor(data));
        const cardId = activeCardId;
        push({
          label: 'Création dossier',
          undo: async () => { await api.deleteFolder(created.id); },
          redo: async () => { await api.addFolder(cardId, withAuthor(data)); },
        });
        notify('Dossier créé');
      }
      await loadCards();
    });
  };

  const handleDeleteFolder = (folder: Folder) => {
    setConfirm({
      title: 'Supprimer le dossier',
      message: `Supprimer le dossier « ${folder.title} » et tous ses liens ?`,
      confirmLabel: 'Supprimer',
      onConfirm: () => {
        setConfirm(null);
        void runAction(async () => {
          const snapshot = { title: folder.title, description: folder.description, links: [...folder.links] };
          await api.deleteFolder(folder.id);
          push({
            label: 'Suppression dossier',
            undo: async () => restoreFolder(folder.cardId, snapshot),
            redo: async () => { await api.deleteFolder(folder.id); },
          });
          notify('Dossier supprimé');
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
        label: wasFavorite ? 'Retrait favori' : 'Ajout favori',
        undo: async () => { await api.updateLink(link.id, { isFavorite: wasFavorite }); },
        redo: async () => { await api.updateLink(link.id, { isFavorite: !wasFavorite }); },
      });
      notify(wasFavorite ? 'Retiré des favoris' : 'Ajouté aux favoris');
      await loadCards();
    });
  };

  const handleMarkAlive = async (link: Link) => {
    await runAction(async () => {
      await api.updateLink(link.id, { isDead: false });
      push({
        label: 'Lien marqué vivant',
        undo: async () => { await api.updateLink(link.id, { isDead: true }); },
        redo: async () => { await api.updateLink(link.id, { isDead: false }); },
      });
      notify('Lien marqué comme vivant');
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
        label: 'Réorganisation',
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
        label: 'Déplacement lien',
        undo: async () => {
          await api.updateLink(linkId, {
            cardId: before.cardId,
            folderId: before.folderId,
          });
        },
        redo: async () => { await api.moveLink(linkId, targetCardId, targetFolderId); },
      });
      notify('Lien déplacé');
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
        label: 'Réorganisation cartes',
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
      const skipped = result.skipped ? ` — ${result.skipped} ignoré${result.skipped > 1 ? 's' : ''}` : '';
      notify(
        `${result.checked} lien${result.checked > 1 ? 's' : ''} vérifié${result.checked > 1 ? 's' : ''} — ${result.dead} mort${result.dead > 1 ? 's' : ''}${skipped}`,
        'info',
      );
      await loadCards();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Échec de la vérification', 'error');
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
      Nouvelle carte
    </Button>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
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
                currentUser={currentUser}
                onCurrentUserChange={(name) => setCurrentUserState(setCurrentUser(name))}
              />
            </>
          )}

          {!loading && !error && cards.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip icon={<FolderOpenIcon />} label={`${stats.cards} carte${stats.cards > 1 ? 's' : ''}`} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', fontWeight: 600 }} />
              <Chip icon={<FolderOpenIcon />} label={`${stats.folders} dossier${stats.folders > 1 ? 's' : ''}`} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', fontWeight: 600 }} />
              <Chip icon={<LinkIcon />} label={`${stats.links} lien${stats.links > 1 ? 's' : ''}`} size="small" sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', fontWeight: 600 }} />
              <Button
                variant="outlined"
                size="small"
                startIcon={checkingLinks ? <CircularProgress size={14} /> : <LinkOffIcon />}
                onClick={handleCheckDeadLinks}
                disabled={checkingLinks}
                sx={{ ml: 'auto' }}
              >
                Vérifier les liens morts
              </Button>
            </Box>
          )}

          {isFiltering && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 1 }}>
              Le glisser-déposer est désactivé pendant le filtrage.
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
                  Réessayer
                </Button>
              }
            >
              {error}
            </Alert>
          )}

          {hasNoCards && (
            <Box sx={{ textAlign: 'center', py: 10, px: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
              <BookmarkIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" gutterBottom>Aucune carte pour l'instant</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                Créez votre première carte pour commencer à y ranger vos liens favoris.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateCard}>
                Créer une carte
              </Button>
            </Box>
          )}

          {hasNoResults && (
            <Box sx={{ textAlign: 'center', py: 8, px: 3, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
              <Typography variant="h6" gutterBottom>Aucun résultat</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Aucun élément ne correspond à vos critères.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchQuery('');
                  setFilters(emptyFilters);
                }}
              >
                Effacer les filtres
              </Button>
            </Box>
          )}

          {!loading && displayCards.length > 0 && (
            <BookmarksDndProvider
              cards={sortedCards}
              onReorder={handleReorder}
              onMoveLinkToCard={(linkId, targetCardId) => handleMoveLink(linkId, targetCardId, null)}
              disabled={isFiltering}
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
                        canMoveLeft={!isFiltering && globalIndex > 0}
                        canMoveRight={!isFiltering && globalIndex >= 0 && globalIndex < sortedCards.length - 1}
                        onMoveCard={isFiltering ? undefined : (direction) => handleMoveCard(card.id, direction)}
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
              Bookmarks — Gestionnaire de liens
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {stats.cards} carte{stats.cards > 1 ? 's' : ''} · {stats.folders} dossier{stats.folders > 1 ? 's' : ''} · {stats.links} lien{stats.links > 1 ? 's' : ''}
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
