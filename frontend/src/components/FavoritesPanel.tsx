import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import {
  Box,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { getGreenPale } from '../theme';
import type { FavoriteLink } from '../types';

/** ~5 lignes denses (ListItem dense ≈ 48px). */
const LIST_MAX_HEIGHT = 240;

interface FavoritesPanelProps {
  favorites: FavoriteLink[];
  onToggleFavorite: (link: FavoriteLink) => void;
  onLinkOpen: (link: FavoriteLink) => void;
}

export function FavoritesPanel({ favorites, onToggleFavorite, onLinkOpen }: FavoritesPanelProps) {
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: greenPale,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
          '&:hover': { filter: 'brightness(0.97)' },
        }}
      >
        <StarIcon sx={{ color: '#F9A825', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {t('favorites.title')}
        </Typography>
        <Chip label={favorites.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        {expanded ? (
          <ExpandLessIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        )}
      </Box>

      {expanded &&
        (favorites.length === 0 ? (
          <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {t('favorites.empty')}
          </Typography>
          </Box>
        ) : (
          <List
            dense
            disablePadding
            sx={{
              maxHeight: LIST_MAX_HEIGHT,
              overflow: 'auto',
            }}
          >
            {favorites.map((link) => (
              <ListItem
                key={link.id}
                disablePadding
                secondaryAction={
                  <Tooltip title={t('favorites.remove')}>
                    <IconButton size="small" onClick={() => onToggleFavorite(link)} sx={{ p: 0.5 }}>
                      <StarIcon sx={{ fontSize: 16, color: '#F9A825' }} />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton
                  component="a"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onLinkOpen(link)}
                  sx={{
                    py: 0.75,
                    px: 2,
                    gap: 1,
                    pr: 6,
                    '&:hover': { bgcolor: greenPale },
                  }}
                >
                  <LinkIcon sx={{ fontSize: 14, color: link.cardColor, flexShrink: 0 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      noWrap
                      sx={{
                        fontWeight: 600,
                        color: link.isDead ? 'error.main' : 'text.primary',
                      }}
                    >
                      {link.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {link.cardTitle}
                    </Typography>
                  </Box>
                  {link.tags.slice(0, 2).map((tag) => (
                    <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                  ))}
                  <OpenInNewIcon sx={{ fontSize: 12, opacity: 0.35 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ))}
    </Paper>
  );
}
