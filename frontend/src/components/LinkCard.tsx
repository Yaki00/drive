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
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import LinkIcon from '@mui/icons-material/Link';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMemo, useState, type MouseEvent } from 'react';
import { useLocale } from '../context/LocaleContext';
import { BNP_GREEN, getGreenPale } from '../theme';
import type { TranslationKey } from '../i18n/translations';
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
  selectionMode?: boolean;
  selectedLinkIds?: Set<number>;
  selectedFolderIds?: Set<number>;
  onToggleLinkSelection?: (linkId: number) => void;
  onToggleFolderSelection?: (folderId: number) => void;
  onExportLink?: (link: Link) => void;
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

function formatLinkMeta(
  link: Link,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  dateLocale: string,
): string {
  const parts = [link.description, link.url].filter(Boolean) as string[];
  if (link.createdBy) parts.push(t('link.addedBy', { author: link.createdBy }));
  if (link.createdAt) {
    parts.push(t('link.addedOn', { date: new Date(link.createdAt).toLocaleDateString(dateLocale) }));
  }
  if (link.isDead && link.lastCheckedAt) {
    parts.push(t('link.checkedOn', { date: new Date(link.lastCheckedAt).toLocaleString(dateLocale) }));
  }
  return parts.join(' · ');
}

function RowActions({
  onEdit,
  onDelete,
  onFavorite,
  onMove,
  onMarkAlive,
  onExport,
  isFavorite,
  isDead,
  compact,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onFavorite?: () => void;
  onMove?: (anchor: HTMLElement) => void;
  onMarkAlive?: () => void;
  onExport?: () => void;
  isFavorite?: boolean;
  isDead?: boolean;
  compact?: boolean;
}) {
  const { t } = useLocale();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 0.25 }}>
      {onMove && (
        <Tooltip title={t('link.moveTo')}>
          <IconButton
            size="small"
            sx={{ p: 0.5, color: 'text.secondary' }}
            onClick={(e) => {
              e.stopPropagation();
              onMove(e.currentTarget);
            }}
          >
            <DriveFileMoveIcon sx={{ fontSize: compact ? 15 : 16 }} />
          </IconButton>
        </Tooltip>
      )}
      {isDead && onMarkAlive && (
        <Tooltip title={t('link.markAlive')}>
          <IconButton size="small" sx={{ p: 0.5, color: 'success.main' }} onClick={onMarkAlive}>
            <CheckCircleOutlinedIcon sx={{ fontSize: compact ? 15 : 16 }} />
          </IconButton>
        </Tooltip>
      )}
      {onFavorite && (
        <Tooltip title={isFavorite ? t('link.removeFavorite') : t('link.addFavorite')}>
          <IconButton size="small" sx={{ p: 0.5 }} onClick={onFavorite}>
            {isFavorite ? (
              <StarIcon sx={{ fontSize: compact ? 15 : 16, color: '#F9A825' }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: compact ? 15 : 16, color: 'text.secondary' }} />
            )}
          </IconButton>
        </Tooltip>
      )}
      {onExport && (
        <Tooltip title={t('link.export')}>
          <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }} onClick={onExport}>
            <FileDownloadOutlinedIcon sx={{ fontSize: compact ? 15 : 16 }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={t('card.edit')}>
        <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }} onClick={onEdit}>
          <EditIcon sx={{ fontSize: compact ? 15 : 16 }} />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('card.delete')}>
        <IconButton
          size="small"
          sx={{ p: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          onClick={onDelete}
        >
          <DeleteOutlined sx={{ fontSize: compact ? 15 : 16 }} />
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
  selectionMode,
  selected,
  onToggleSelection,
  onExport,
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
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: () => void;
  onExport?: () => void;
}) {
  const { t, dateLocale } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `link-${link.id}`,
    data: { type: 'link', link },
    disabled: selectionMode,
  });

  const tooltipText = formatLinkMeta(link, t, dateLocale);

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        minHeight: compact ? 32 : 36,
        opacity: isDragging ? 0.4 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        borderRadius: 0.5,
        backgroundColor: link.isDead ? (theme) => `${theme.palette.error.main}18` : undefined,
        '&:hover': { bgcolor: link.isDead ? (theme) => `${theme.palette.error.main}28` : greenPale },
      }}
    >
      <Box
        component={selectionMode ? 'div' : 'a'}
        href={selectionMode ? undefined : link.url}
        target={selectionMode ? undefined : '_blank'}
        rel={selectionMode ? undefined : 'noopener noreferrer'}
        onClick={
          selectionMode
            ? (e: MouseEvent) => {
                e.preventDefault();
                onToggleSelection?.();
              }
            : onLinkOpen
        }
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.25,
          pl: 0.5,
          pr: 0.5,
          textDecoration: 'none',
          color: 'inherit',
          cursor: selectionMode ? 'pointer' : undefined,
        }}
      >
        {selectionMode ? (
          <Checkbox
            size="small"
            checked={selected}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelection?.();
            }}
            sx={{ p: 0, flexShrink: 0 }}
          />
        ) : (
          <IconButton
            size="small"
            component="span"
            sx={{ p: 0, cursor: 'grab', color: 'text.disabled', flexShrink: 0 }}
            {...attributes}
            {...listeners}
            onClick={(e) => e.preventDefault()}
          >
            <DragIndicatorIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
        <LinkIcon sx={{ fontSize: 13, color: link.isDead ? 'error.main' : accentColor, flexShrink: 0 }} />
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: compact ? '0.78rem' : '0.84rem',
            lineHeight: 1.2,
            color: link.isDead ? 'error.main' : 'text.primary',
            fontWeight: link.isDead ? 600 : 400,
          }}
        >
          {link.title}
        </Typography>
        {link.isDead && (
          <Tooltip title={t('link.deadTooltip')}>
            <Chip
              label={t('link.dead')}
              size="small"
              color="error"
              sx={{ height: 16, fontSize: '0.6rem', flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}
            />
          </Tooltip>
        )}
        <TagChips tags={link.tags ?? []} />
        {tooltipText && <InfoTooltip text={tooltipText} />}
      </Box>
      {!selectionMode && (
        <Box sx={{ flexShrink: 0, pr: 0.25 }}>
          <RowActions
            compact={compact}
            onEdit={onEdit}
            onDelete={onDelete}
            onFavorite={onFavorite}
            onMove={onMove}
            onMarkAlive={onMarkAlive}
            onExport={onExport}
            isFavorite={link.isFavorite}
            isDead={link.isDead}
          />
        </Box>
      )}
    </Box>
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
  selectionMode,
  selected,
  onToggleSelection,
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
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `folder-${folder.id}`,
    data: { type: 'folder', folder },
    disabled: selectionMode,
  });

  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { type: 'folder-drop', folderId: folder.id },
  });

  return (
    <Box ref={setNodeRef} sx={{ opacity: isDragging ? 0.4 : 1, transform: CSS.Transform.toString(transform), transition }}>
      <Box
        ref={dropRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          minHeight: compact ? 32 : 36,
          outline: isOver ? `2px dashed ${accentColor}` : 'none',
          borderRadius: 0.5,
          '&:hover': { bgcolor: greenPale },
        }}
      >
        <ListItemButton
          onClick={selectionMode ? onToggleSelection : onToggle}
          sx={{
            flex: 1,
            minWidth: 0,
            py: 0.25,
            px: 0.5,
            minHeight: compact ? 32 : 36,
            borderRadius: 0.5,
            gap: 0.25,
          }}
        >
          {selectionMode ? (
            <Checkbox
              size="small"
              checked={selected}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection?.();
              }}
              sx={{ p: 0, flexShrink: 0 }}
            />
          ) : (
            <IconButton size="small" sx={{ p: 0, cursor: 'grab', color: 'text.disabled', flexShrink: 0 }} {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
              <DragIndicatorIcon sx={{ fontSize: 14 }} />
            </IconButton>
          )}
          {!selectionMode && (
            <IconButton size="small" sx={{ p: 0, mr: 0.25, flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
              {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
            </IconButton>
          )}
          <FolderOutlinedIcon sx={{ fontSize: 14, color: accentColor, flexShrink: 0 }} />
          <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontSize: compact ? '0.78rem' : '0.84rem', fontWeight: 600, lineHeight: 1.2 }}>
            {folder.title}
          </Typography>
          {folder.description && <InfoTooltip text={folder.description} />}
          <Chip label={folder.links.length} size="small" sx={{ height: 16, minWidth: 20, fontSize: '0.65rem', bgcolor: greenPale, color: accentColor, flexShrink: 0, '& .MuiChip-label': { px: 0.75 } }} />
        </ListItemButton>
        {!selectionMode && (
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, pr: 0.25, gap: 0.25 }}>
            <Tooltip title={t('card.addLink')}>
              <IconButton size="small" sx={{ p: 0.5, color: 'primary.main' }} onClick={onAddLink}>
                <AddIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            <RowActions compact={compact} onEdit={onEdit} onDelete={onDelete} />
          </Box>
        )}
      </Box>
      <Collapse in={isExpanded || selectionMode} timeout="auto" unmountOnExit>
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
  selectionMode = false,
  selectedLinkIds,
  selectedFolderIds,
  onToggleLinkSelection,
  onToggleFolderSelection,
  onExportLink,
}: LinkCardProps) {
  const theme = useTheme();
  const { t } = useLocale();
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

    targets.push({ cardId: card.id, folderId: null, label: `${card.title} ${t('card.root')}`, color: card.color });
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
  }, [allCards, card, t]);

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
              <Tooltip title={t('card.moveLeft')}>
                <span>
                  <IconButton size="small" disabled={!canMoveLeft} onClick={() => onMoveCard('left')} sx={{ p: 0.25 }}>
                    <ChevronLeftIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('card.moveRight')}>
                <span>
                  <IconButton size="small" disabled={!canMoveRight} onClick={() => onMoveCard('right')} sx={{ p: 0.25 }}>
                    <ChevronRightIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          <Tooltip title={t('card.edit')}>
            <IconButton size="small" sx={{ p: 0.5, color: 'text.secondary' }} onClick={() => onEditCard(card)}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('card.delete')}>
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
                  {t('card.empty')}
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
                      selectionMode={selectionMode}
                      selected={selectedFolderIds?.has(item.data.id)}
                      onToggleSelection={() => onToggleFolderSelection?.(item.data.id)}
                    >
                      <SortableContext items={item.data.links.map((l) => `link-${l.id}`)} strategy={verticalListSortingStrategy}>
                        <List dense disablePadding sx={{ pl: 2.5 }}>
                          {item.data.links.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 0.75, pl: 1, fontStyle: 'italic' }}>
                              {t('card.folderEmpty')}
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
                                  selectionMode={selectionMode}
                                  selected={selectedLinkIds?.has(link.id)}
                                  onToggleSelection={() => onToggleLinkSelection?.(link.id)}
                                  onExport={onExportLink ? () => onExportLink(link) : undefined}
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
                      selectionMode={selectionMode}
                      selected={selectedLinkIds?.has(item.data.id)}
                      onToggleSelection={() => onToggleLinkSelection?.(item.data.id)}
                      onExport={onExportLink ? () => onExportLink(item.data) : undefined}
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
          {t('card.add')}
        </Button>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={() => { setMenuAnchor(null); onAddLink(card); }}>
            <LinkIcon sx={{ fontSize: 18, mr: 1.5, color: accentColor }} />
            {t('card.link')}
          </MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); onAddFolder(card); }}>
            <FolderOutlinedIcon sx={{ fontSize: 18, mr: 1.5, color: accentColor }} />
            {t('card.folder')}
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
