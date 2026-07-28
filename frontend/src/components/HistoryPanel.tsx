import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HistoryIcon from '@mui/icons-material/History';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  Button,
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
import { useEffect, useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { getGreenPale } from '../theme';
import type { HistoryEntry } from '../utils/history';

/** ~5 lignes denses (ListItem dense ≈ 48px). */
const LIST_MAX_HEIGHT = 240;

interface HistoryPanelProps {
  history: HistoryEntry[];
  onClear: () => void;
  onOpen: (entry: HistoryEntry) => void;
}

export function HistoryPanel({ history, onClear, onOpen }: HistoryPanelProps) {
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);
  const { t, dateLocale } = useLocale();
  const [now, setNow] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const formatRelative = (dateStr: string): string => {
    const diff = now - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('history.justNow');
    if (mins < 60) return t('history.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('history.hoursAgo', { count: hours });
    return new Date(dateStr).toLocaleDateString(dateLocale);
  };

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
          justifyContent: 'space-between',
          borderBottom: expanded ? '1px solid' : 'none',
          borderColor: 'divider',
          flexShrink: 0,
          cursor: 'pointer',
          userSelect: 'none',
          gap: 1,
          '&:hover': { filter: 'brightness(0.97)' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexGrow: 1 }}>
          <HistoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
            {t('history.title')}
          </Typography>
          <Chip label={history.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
        {expanded && history.length > 0 && (
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            sx={{ flexShrink: 0 }}
          >
            {t('history.clear')}
          </Button>
        )}
        {expanded ? (
          <ExpandLessIcon sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.secondary', flexShrink: 0 }} />
        )}
      </Box>

      {expanded &&
        (history.length === 0 ? (
          <Box sx={{ px: 2, py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            {t('history.empty')}
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
            {history.map((entry) => (
              <ListItem
                key={`${entry.linkId}-${entry.openedAt}`}
                disablePadding
                secondaryAction={
                  <Tooltip title={t('history.open')}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(entry);
                      }}
                    >
                      <OpenInNewIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton
                  onClick={() => onOpen(entry)}
                  sx={{ py: 0.75, px: 2, gap: 1, pr: 6, '&:hover': { bgcolor: greenPale } }}
                >
                  <LinkIcon sx={{ fontSize: 14, color: entry.cardColor, flexShrink: 0 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {entry.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {entry.cardTitle} · {formatRelative(entry.openedAt)}
                    </Typography>
                  </Box>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        ))}
    </Paper>
  );
}
