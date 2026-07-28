import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import RedoIcon from '@mui/icons-material/Redo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import UndoIcon from '@mui/icons-material/Undo';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Navbar } from '../components/Navbar';
import { useLocale } from '../context/LocaleContext';
import type { ActivityAction, ActivityEntry, ActivityEntityType } from '../types';
import { getDateLocale, type TranslationKey } from '../i18n/translations';
import { getDisplayUser } from '../utils/sessionUser';

type PeriodKey = 'today' | 'week' | 'month' | 'archive';
type ConfirmTarget = { entry: ActivityEntry; mode: 'revert' | 'unrevert' };

const PERIOD_ORDER: PeriodKey[] = ['today', 'week', 'month', 'archive'];

const PERIOD_LABEL: Record<PeriodKey, TranslationKey> = {
  today: 'activity.groupToday',
  week: 'activity.groupWeek',
  month: 'activity.groupMonth',
  archive: 'activity.groupArchive',
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function periodFor(iso: string, now = new Date()): PeriodKey {
  const at = new Date(iso);
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 29);

  if (at >= todayStart) return 'today';
  if (at >= weekStart) return 'week';
  if (at >= monthStart) return 'month';
  return 'archive';
}

export function ActivityPage() {
  const { t, locale } = useLocale();
  const displayUser = getDisplayUser();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<'' | ActivityAction>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await api.getActivity());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const actors = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      if (entry.actor?.trim()) set.add(entry.actor.trim());
      if (entry.revertedBy?.trim()) set.add(entry.revertedBy.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (
        actorFilter &&
        entry.actor !== actorFilter &&
        entry.revertedBy !== actorFilter
      ) {
        return false;
      }
      if (actionFilter && entry.action !== actionFilter) return false;
      return true;
    });
  }, [entries, actorFilter, actionFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<PeriodKey, ActivityEntry[]> = {
      today: [],
      week: [],
      month: [],
      archive: [],
    };
    for (const entry of filtered) {
      buckets[periodFor(entry.at)].push(entry);
    }
    return PERIOD_ORDER.map((key) => ({
      key,
      label: t(PERIOD_LABEL[key]),
      items: buckets[key],
    })).filter((group) => group.items.length > 0);
  }, [filtered, t]);

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    const { entry, mode } = confirmTarget;
    setBusyId(entry.id);
    setError(null);
    try {
      if (mode === 'revert') await api.revertActivity(entry.id);
      else await api.unrevertActivity(entry.id);
      setConfirmTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
      setConfirmTarget(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleClear = async () => {
    setClearOpen(false);
    setError(null);
    try {
      await api.clearActivity();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(getDateLocale(locale), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const actionLabel = (action: ActivityAction) => {
    if (action === 'create') return t('activity.actionCreate');
    if (action === 'update') return t('activity.actionUpdate');
    return t('activity.actionDelete');
  };

  const entityLabel = (type: ActivityEntityType) => {
    if (type === 'card') return t('activity.entityCard');
    if (type === 'folder') return t('activity.entityFolder');
    return t('activity.entityLink');
  };

  const actionColor = (action: ActivityAction): 'success' | 'info' | 'error' => {
    if (action === 'create') return 'success';
    if (action === 'update') return 'info';
    return 'error';
  };

  const revertMeta = (entry: ActivityEntry) => {
    if (!entry.reverted) return null;
    if (entry.revertedBy && entry.revertedAt) {
      return t('activity.revertedByAt', {
        actor: entry.revertedBy,
        date: formatDate(entry.revertedAt),
      });
    }
    if (entry.revertedBy) return t('activity.revertedBy', { actor: entry.revertedBy });
    if (entry.revertedAt) return t('activity.revertedAt', { date: formatDate(entry.revertedAt) });
    return t('activity.reverted');
  };

  const renderEntry = (entry: ActivityEntry, showDivider: boolean) => (
    <Box key={entry.id}>
      {showDivider && <Divider />}
      <ListItem
        alignItems="flex-start"
        secondaryAction={
          entry.reverted ? (
            <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
              <Chip size="small" label={t('activity.reverted')} variant="outlined" color="warning" />
              <Tooltip title={t('activity.unrevert')}>
                <span>
                  <IconButton
                    edge="end"
                    aria-label={t('activity.unrevert')}
                    onClick={() => setConfirmTarget({ entry, mode: 'unrevert' })}
                    disabled={busyId === entry.id}
                  >
                    {busyId === entry.id ? <CircularProgress size={18} /> : <RedoIcon />}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          ) : (
            <Tooltip title={t('activity.revert')}>
              <span>
                <IconButton
                  edge="end"
                  aria-label={t('activity.revert')}
                  onClick={() => setConfirmTarget({ entry, mode: 'revert' })}
                  disabled={busyId === entry.id}
                >
                  {busyId === entry.id ? <CircularProgress size={18} /> : <UndoIcon />}
                </IconButton>
              </span>
            </Tooltip>
          )
        }
        sx={{ pr: 14, py: 1.75 }}
      >
        <ListItemText
          primary={
            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
              <Chip size="small" label={actionLabel(entry.action)} color={actionColor(entry.action)} />
              <Chip size="small" label={entityLabel(entry.entityType)} variant="outlined" />
              <Typography variant="body1" component="span" sx={{ fontWeight: 600 }}>
                {entry.summary}
              </Typography>
            </Stack>
          }
          secondary={
            <Typography variant="body2" color="text.secondary" component="span">
              {formatDate(entry.at)}
              {' · '}
              {t('activity.by', { actor: entry.actor })}
              {entry.reverted ? ` · ${revertMeta(entry)}` : null}
            </Typography>
          }
        />
      </ListItem>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Navbar sessionUser={displayUser} />

      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 }, flexGrow: 1 }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}
        >
          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <HistoryEduOutlinedIcon color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('activity.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('activity.subtitle')}
            </Typography>
          </Box>

          <Button
            variant="outlined"
            color="inherit"
            startIcon={<RestartAltIcon />}
            onClick={() => setClearOpen(true)}
            disabled={loading || entries.length === 0}
          >
            {t('activity.clearLog')}
          </Button>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            borderRadius: 1,
            p: 2,
            mb: 2,
            overflow: 'visible',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 2, alignItems: { sm: 'center' }, flexWrap: 'wrap' }}
          >
            <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
              <InputLabel id="activity-actor-filter">{t('activity.filterUser')}</InputLabel>
              <Select
                labelId="activity-actor-filter"
                label={t('activity.filterUser')}
                value={actorFilter}
                onChange={(e) => setActorFilter(String(e.target.value))}
              >
                <MenuItem value="">{t('activity.filterAll')}</MenuItem>
                {actors.map((actor) => (
                  <MenuItem key={actor} value={actor}>
                    {actor}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180, flex: 1 }}>
              <InputLabel id="activity-action-filter">{t('activity.filterAction')}</InputLabel>
              <Select
                labelId="activity-action-filter"
                label={t('activity.filterAction')}
                value={actionFilter}
                onChange={(e) => setActionFilter(String(e.target.value) as '' | ActivityAction)}
              >
                <MenuItem value="">{t('activity.filterAll')}</MenuItem>
                <MenuItem value="create">{t('activity.actionCreate')}</MenuItem>
                <MenuItem value="update">{t('activity.actionUpdate')}</MenuItem>
                <MenuItem value="delete">{t('activity.actionDelete')}</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Paper variant="outlined" sx={{ borderRadius: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={32} />
            </Box>
          </Paper>
        ) : entries.length === 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 1 }}>
            <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">{t('activity.empty')}</Typography>
            </Box>
          </Paper>
        ) : filtered.length === 0 ? (
          <Paper variant="outlined" sx={{ borderRadius: 1 }}>
            <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">{t('activity.emptyFiltered')}</Typography>
            </Box>
          </Paper>
        ) : (
          <Stack sx={{ gap: 2 }}>
            {grouped.map((group) => (
              <Paper key={group.key} variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
                <Box
                  sx={{
                    px: 2,
                    py: 1.25,
                    bgcolor: 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {group.label}
                  </Typography>
                  <Chip size="small" label={group.items.length} sx={{ height: 22 }} />
                </Box>
                <List disablePadding>
                  {group.items.map((entry, index) => renderEntry(entry, index > 0))}
                </List>
              </Paper>
            ))}
          </Stack>
        )}
      </Container>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={
          confirmTarget?.mode === 'unrevert'
            ? t('activity.unrevertTitle')
            : t('activity.revertTitle')
        }
        message={
          confirmTarget
            ? t(
                confirmTarget.mode === 'unrevert'
                  ? 'activity.unrevertMessage'
                  : 'activity.revertMessage',
                { summary: confirmTarget.entry.summary },
              )
            : ''
        }
        confirmLabel={
          confirmTarget?.mode === 'unrevert' ? t('activity.unrevert') : t('activity.revert')
        }
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={clearOpen}
        title={t('activity.clearTitle')}
        message={t('activity.clearMessage')}
        confirmLabel={t('activity.clearLog')}
        onConfirm={() => void handleClear()}
        onCancel={() => setClearOpen(false)}
      />
    </Box>
  );
}
