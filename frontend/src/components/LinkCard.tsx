import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState } from 'react';
import { BNP_GREEN, getGreenPale } from '../theme';
import type { Card as CardType, Folder, Link } from '../types';

interface LinkCardProps {
  card: CardType;
  allCards: CardType[];
  onEditCard: (card: CardType) => void;
  onDeleteCard: (card: CardType) => void;
  onAddLink: (card: CardType, folderId?: number) => void;
  onAddFolder: (card: CardType) => void;
  onEditLink: (link: Link) => void;
  onDeleteLink: (link: Link) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onToggleFavorite: (link: Link) => void;
  onMoveLink: (linkId: number, targetCardId: number, targetFolderId?: number | null) => void;
  onMarkAlive?: (link: Link) => void;
  onLinkOpen: (link: Link) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveCard?: (direction: 'left' | 'right') => void;
}

type CardItem =
  | { kind: 'folder'; data: Folder; sortOrder: number }
  | { kind: 'link'; data: Link; sortOrder: number };

function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip title={text} arrow placement="top">
      <IconButton
        size="small"
        sx={{ p: 0.25, ml: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
        onClick={(e) => e.stopPropagation()}
      >
        <InfoOutlined sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
}

function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
      {tags.slice(0, 2).map((tag) => (
        <Chip key={tag} label={tag} size="small" sx={{ height: 16, fontSize: '0.6rem' }} />
      ))}
    </Box>
  );
}

function formatLinkMeta(link: Link): string {
  const parts = [link.description, link.url].filter(Boolean) as string[];
  if (link.createdBy) parts.push(`Ajouté par ${link.createdBy}`);
  if (link.createdAt) {
    parts.push(`Le ${new Date(link.createdAt).toLocaleDateString('fr-FR')}`);
  }
  if (link.isDead && link.lastCheckedAt) {
    parts.push(`Vérifié le ${new Date(link.lastCheckedAt).toLocaleString('fr-FR')}`);
  }
  return parts.join(' · ');
}

function RowActions({
  onEdit,
  onDelete,
  onFavorite,
  onMove,
  onMarkAlive,
  isFavorite,
  isDead,
  compact,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onFavorite?: () => void;
  onMove?: (anchor: HTMLElement) => void;
  onMarkAlive?: () => void;
  isFavorite?: boolean;
  isDead?: boolean;
  compact?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      {onMove && (
        <Tooltip title="Déplacer vers…">
          <IconButton
            size="small"
            sx={{ p: 0.25, color: 'text.secondary' }}
            onClick={(e) => {
              e.stopPropagation();
              onMove(e.currentTarget);
            }}
          >
            <DriveFileMoveIcon sx={{ fontSize: compact ? 13 : 14 }} />
          </IconButton>
        </Tooltip>
      )}
      {isDead && onMarkAlive && (
        <Tooltip title="Marquer comme vivant">
          <IconButton size="small" sx={{ p: 0.25, color: 'success.main' }} onClick={onMarkAlive}>
            <CheckCircleOutlinedIcon sx={{ fontSize: compact ? 13 : 14 }} />
          </IconButton>
        </Tooltip>
      )}
      {onFavorite && (
        <Tooltip title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
          <IconButton size="small" sx={{ p: 0.25 }} onClick={onFavorite}>
            {isFavorite ? (
              <StarIcon sx={{ fontSize: compact ? 13 : 14, color: '#F9A825' }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: compact ? 13 : 14, color: 'text.secondary' }} />
            )}
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title="Modifier">
        <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary' }} onClick={onEdit}>
          <EditIcon sx={{ fontSize: compact ? 13 : 14 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title="Supprimer">
        <IconButton
          size="small"
          sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          onClick={onDelete}
        >
          <DeleteOutlined sx={{ fontSize: compact ? 13 : 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function SortableLinkRow({
  link,
  accentColor,
  greenPale,
  compact,
  onEdit,
  onDelete,
  onFavorite,
  onMove,
  onMarkAlive,
  onLinkOpen,
}: {
  link: Link;
  accentColor: string;
  greenPale: string;
  compact: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFavorite: () => void;
  onMove: (anchor: HTMLElement) => void;
  onMarkAlive?: () => void;
  onLinkOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `link-${link.id}`,
    data: { type: 'link', link },
  });

  const tooltipText = formatLinkMeta(link);

  return (
    <ListItem
      ref={setNodeRef}
      disablePadding
      sx={{
        minHeight: compact ? 26 : 30,
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      secondaryAction={
        <RowActions
          compact={compact}
          onEdit={onEdit}
          onDelete={onDelete}
          onFavorite={onFavorite}
          onMove={onMove}
          onMarkAlive={onMarkAlive}
          isFavorite={link.isFavorite}
          isDead={link.isDead}
        />
      }
    >
      <ListItemButton
        component="a"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onLinkOpen}
        sx={{
          py: 0.25,
          px: 0.5,
          minHeight: compact ? 26 : 30,
          borderRadius: 0.5,
          pr: 9,
          gap: 0.5,
          backgroundColor: link.isDead ? (t) => `${t.palette.error.main}18` : undefined,
          '&:hover': { bgcolor: link.isDead ? (t) => `${t.palette.error.main}28` : greenPale },
        }}
      >
        <IconButton
          size="small"
          sx={{ p: 0, cursor: 'grab', color: 'text.disabled' }}
          {...attributes}
          {...listeners}
          onClick={(e) => e.preventDefault()}
        >
          <DragIndicatorIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <LinkIcon sx={{ fontSize: 13, color: link.isDead ? 'error.main' : accentColor, flexShrink: 0 }} />
        <Typography
          variant="body2"
          noWrap
          sx={{
            flexGrow: 1,
            fontSize: compact ? '0.78rem' : '0.84rem',
            lineHeight: 1.2,
            color: link.isDead ? 'error.main' : 'text.primary',
            fontWeight: link.isDead ? 600 : 400,
          }}
        >
          {link.title}
        </Typography>
        <TagChips tags={link.tags ?? []} />
        {link.isDead && (
          <Tooltip title="Lien mort ou inaccessible">
            <Chip label="mort" size="small" color="error" sx={{ height: 16, fontSize: '0.6rem' }} />
          </Tooltip>
        )}
        {tooltipText && <InfoTooltip text={tooltipText} />}
        <OpenInNewIcon sx={{ fontSize: 11, opacity: 0.35, flexShrink: 0 }} />
      </ListItemButton>
    </ListItem>
  );
}

function SortableFolderRow({
  folder,
  accentColor,
  greenPale,
  compact,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddLink,
  children,
}: {
  folder: Folder;
  accentColor: string;
  greenPale: string;
  compact: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddLink: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder },
  });

  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: 'folder-drop', folderId: folder.id },
  });

  return (
    <Box ref={setNodeRef} sx={{ opacity: isDragging ? 0.4 : 1, transform: CSS.Transform.toString(transform), transition }}>
      <ListItem
        ref={dropRef}
        disablePadding
        sx={{ minHeight: compact ? 26 : 30, outline: isOver ? `2px dashed ${accentColor}` : 'none', borderRadius: 0.5 }}
        secondaryAction={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Ajouter un lien">
              <IconButton size="small" sx={{ p: 0.25, color: 'primary.main' }} onClick={onAddLink}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <RowActions compact={compact} onEdit={onEdit} onDelete={onDelete} />
          </Box>
        }
      >
        <ListItemButton
          onClick={onToggle}
          sx={{ py: 0.25, px: 0.5, minHeight: compact ? 26 : 30, borderRadius: 0.5, pr: 10, gap: 0.25, '&:hover': { bgcolor: greenPale } }}
        >
          <IconButton size="small" sx={{ p: 0, cursor: 'grab', color: 'text.disabled' }} {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            <DragIndicatorIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton size="small" sx={{ p: 0, mr: 0.25 }} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
          </IconButton>
          <FolderOutlinedIcon sx={{ fontSize: 14, color: accentColor, flexShrink: 0 }} />
          <Typography variant="body2" noWrap sx={{ flexGrow: 1, fontSize: compact ? '0.78rem' : '0.84rem', fontWeight: 600, lineHeight: 1.2 }}>
            {folder.title}
          </Typography>
          {folder.description && <InfoTooltip text={folder.description} />}
          <Chip label={folder.links.length} size="small" sx={{ height: 16, minWidth: 20, fontSize: '0.65rem', bgcolor: greenPale, color: accentColor, '& .MuiChip-label': { px: 0.75 } }} />
        </ListItemButton>
      </ListItem>
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        {children}
      </Collapse>
    </Box>
  );
}

export function LinkCard({
  card,
  allCards,
  onEditCard,
  onDeleteCard,
  onAddLink,
  onAddFolder,
  onEditLink,
  onDeleteLink,
  onEditFolder,
  onDeleteFolder,
  onToggleFavorite,
  onMoveLink,
  onMarkAlive,
  onLinkOpen,
  canMoveLeft,
  canMoveRight,
  onMoveCard,
}: LinkCardProps) {
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);
  const accentColor = card.color || BNP_GREEN;

  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [moveAnchor, setMoveAnchor] = useState<null | HTMLElement>(null);
  const [movingLinkId, setMovingLinkId] = useState<number | null>(null);

  const { setNodeRef: rootDropRef } = useDroppable({
    id: `root-drop-${card.id}`,
    data: { type: 'root-drop', cardId: card.id },
  });

  const rootItems = useMemo<CardItem[]>(() => {
    const folderItems: CardItem[] = card.folders.map((folder) => ({ kind: 'folder', data: folder, sortOrder: folder.sortOrder }));
    const linkItems: CardItem[] = card.links.map((link) => ({ kind: 'link', data: link, sortOrder: link.sortOrder }));
    return [...folderItems, ...linkItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [card.folders, card.links]);

  const rootSortableIds = useMemo(
    () => rootItems.map((item) => (item.kind === 'folder' ? `folder-${item.data.id}` : `link-${item.data.id}`)),
    [rootItems],
  );

  const totalItems = card.links.length + card.folders.reduce((sum, folder) => sum + folder.links.length, 0);
  const isCompact = totalItems > 1;
  const moveTargets = useMemo(() => {
    const targets: { cardId: number; folderId: number | null; label: string; color?: string }[] = [];

    targets.push({ cardId: card.id, folderId: null, label: `${card.title} (racine)`, color: card.color });
    card.folders.forEach((folder) => {
      targets.push({
        cardId: card.id,
        folderId: folder.id,
        label: `${card.title} › ${folder.title}`,
        color: card.color,
      });
    });

    allCards
      .filter((c) => c.id !== card.id)
      .forEach((targetCard) => {
        targets.push({
          cardId: targetCard.id,
          folderId: null,
          label: targetCard.title,
          color: targetCard.color,
        });
        targetCard.folders.forEach((folder) => {
          targets.push({
            cardId: targetCard.id,
            folderId: folder.id,
            label: `${targetCard.title} › ${folder.title}`,
            color: targetCard.color,
          });
        });
      });

    return targets;
  }, [allCards, card]);

  const openMoveMenu = (linkId: number, anchor: HTMLElement) => {
    setMovingLinkId(linkId);
    setMoveAnchor(anchor);
  };

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${accentColor}`,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': { boxShadow: '0 4px 16px rgba(0, 150, 90, 0.12)', borderColor: `${accentColor}55` },
      }}
    >
      <CardContent sx={{ flexGrow: 1, pb: 0.5, pt: 1.5, '&:last-child': { pb: 0.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: isCompact ? 0.5 : 0.75 }}>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', minWidth: 0, gap: 0.5 }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
              {card.title}
            </Typography>
            {card.description && <InfoTooltip text={card.description} />}
            <TagChips tags={card.tags ?? []} />
          </Box>
          <Chip label={totalItems} size="small" sx={{ height: 20, fontSize: '0.7rem', mr: 0.5, bgcolor: greenPale, color: accentColor, fontWeight: 700 }} />
          {onMoveCard && (
            <>
              <Tooltip title="Déplacer la carte à gauche">
                <span>
                  <IconButton size="small" disabled={!canMoveLeft} onClick={() => onMoveCard('left')} sx={{ p: 0.25 }}>
                    <ChevronLeftIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Déplacer la carte à droite">
                <span>
                  <IconButton size="small" disabled={!canMoveRight} onClick={() => onMoveCard('right')} sx={{ p: 0.25 }}>
                    <ChevronRightIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title="Modifier">
            <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }} onClick={() => onEditCard(card)}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Supprimer">
            <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }} onClick={() => onDeleteCard(card)}>
              <DeleteOutlined sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box ref={rootDropRef}>
          <SortableContext items={rootSortableIds} strategy={verticalListSortingStrategy}>
            <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.15 }}>
              {rootItems.length === 0 ? (
                <Typography variant="caption" color="text.secondary" sx={{ py: 1.5, textAlign: 'center', fontStyle: 'italic', display: 'block' }}>
                  Aucun élément — déposez un lien ici
                </Typography>
              ) : (
                rootItems.map((item) =>
                  item.kind === 'folder' ? (
                    <SortableFolderRow
                      key={`folder-${item.data.id}`}
                      folder={item.data}
                      accentColor={accentColor}
                      greenPale={greenPale}
                      compact={isCompact}
                      isExpanded={expandedFolders.has(item.data.id)}
                      onToggle={() =>
                        setExpandedFolders((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.data.id)) next.delete(item.data.id);
                          else next.add(item.data.id);
                          return next;
                        })
                      }
                      onEdit={() => onEditFolder(item.data)}
                      onDelete={() => onDeleteFolder(item.data)}
                      onAddLink={() => onAddLink(card, item.data.id)}
                    >
                      <SortableContext items={item.data.links.map((l) => `link-${l.id}`)} strategy={verticalListSortingStrategy}>
                        <List dense disablePadding sx={{ pl: 2.5 }}>
                          {item.data.links.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 0.75, pl: 1, fontStyle: 'italic' }}>
                              Dossier vide
                            </Typography>
                          ) : (
                            [...item.data.links]
                              .sort((a, b) => a.sortOrder - b.sortOrder)
                              .map((link) => (
                                <SortableLinkRow
                                  key={link.id}
                                  link={link}
                                  accentColor={accentColor}
                                  greenPale={greenPale}
                                  compact={isCompact}
                                  onEdit={() => onEditLink(link)}
                                  onDelete={() => onDeleteLink(link)}
                                  onFavorite={() => onToggleFavorite(link)}
                                  onMove={(anchor) => openMoveMenu(link.id, anchor)}
                                  onMarkAlive={onMarkAlive ? () => onMarkAlive(link) : undefined}
                                  onLinkOpen={() => onLinkOpen(link)}
                                />
                              ))
                          )}
                        </List>
                      </SortableContext>
                    </SortableFolderRow>
                  ) : (
                    <SortableLinkRow
                      key={item.data.id}
                      link={item.data}
                      accentColor={accentColor}
                      greenPale={greenPale}
                      compact={isCompact}
                      onEdit={() => onEditLink(item.data)}
                      onDelete={() => onDeleteLink(item.data)}
                      onFavorite={() => onToggleFavorite(item.data)}
                      onMove={(anchor) => openMoveMenu(item.data.id, anchor)}
                      onMarkAlive={onMarkAlive ? () => onMarkAlive(item.data) : undefined}
                      onLinkOpen={() => onLinkOpen(item.data)}
                    />
                  ),
                )
              )}
            </List>
          </SortableContext>
        </Box>
      </CardContent>

      <Box sx={{ px: 1.5, pb: 1.25, pt: 0.5 }}>
        <Button
          size="small"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ minWidth: 0, px: 0.5, py: 0.25, color: 'primary.main', fontSize: '0.8rem', fontWeight: 600, '&:hover': { bgcolor: greenPale } }}
        >
          <AddIcon sx={{ fontSize: 16, mr: 0.25 }} />
          Ajouter
        </Button>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); onAddLink(card); }}>
            <LinkIcon sx={{ fontSize: 18, mr: 1.5, color: accentColor }} />
            Lien
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); onAddFolder(card); }}>
            <FolderOutlinedIcon sx={{ fontSize: 18, mr: 1.5, color: accentColor }} />
            Dossier
          </MenuItem>
        </Menu>
        <Menu anchorEl={moveAnchor} open={Boolean(moveAnchor)} onClose={() => { setMoveAnchor(null); setMovingLinkId(null); }}>
          {moveTargets.map((target) => (
            <MenuItem
              key={`${target.cardId}-${target.folderId ?? 'root'}`}
              onClick={() => {
                if (movingLinkId) onMoveLink(movingLinkId, target.cardId, target.folderId);
                setMoveAnchor(null);
                setMovingLinkId(null);
              }}
            >
              <DriveFileMoveIcon sx={{ fontSize: 18, mr: 1.5, color: target.color ?? accentColor }} />
              {target.label}
            </MenuItem>
          ))}
        </Menu>
      </Box>
    </Card>
  );
}
