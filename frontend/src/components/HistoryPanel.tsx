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
import { getGreenPale } from '../theme';
import type { HistoryEntry } from '../utils/history';

interface HistoryPanelProps {
  history: HistoryEntry[];
  onClear: () => void;
  onOpen: (entry: HistoryEntry) => void;
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
}

export function HistoryPanel({ history, onClear, onOpen }: HistoryPanelProps) {
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);

  if (history.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: greenPale,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Historique
          </Typography>
          <Chip label={history.length} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        </Box>
        <Button size="small" onClick={onClear}>
          Effacer
        </Button>
      </Box>

      <List dense disablePadding>
        {history.map((entry) => (
          <ListItem
            key={`${entry.linkId}-${entry.openedAt}`}
            disablePadding
            secondaryAction={
              <Tooltip title="Ouvrir">
                <IconButton
                  size="small"
                  component="a"
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onOpen(entry)}
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
    </Paper>
  );
}
