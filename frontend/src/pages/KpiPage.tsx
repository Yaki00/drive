import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LinkIcon from '@mui/icons-material/Link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { ClicksByDayChart } from '../components/ClicksByDayChart';
import { Navbar } from '../components/Navbar';
import { useLocale } from '../context/LocaleContext';
import { getDateLocale } from '../i18n/translations';
import type { KpiSnapshot } from '../types';
import { getDisplayUser } from '../utils/sessionUser';

type LinkRow = KpiSnapshot['links'][number];
type SortKey = 'title' | 'cardTitle' | 'clicked' | 'clickCount' | 'lastClickedAt';
type SortDir = 'asc' | 'desc';

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Box sx={{ minWidth: 120, flex: '1 1 140px' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function RankBar({
  label,
  count,
  max,
  href,
  onOpen,
}: {
  label: string;
  count: number;
  max: number;
  href?: string;
  onOpen?: () => void;
}) {
  const width = max > 0 ? Math.max(6, Math.round((count / max) * 100)) : 0;
  return (
    <Box sx={{ mb: 1.25 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1, mb: 0.35 }}>
        <Typography
          variant="body2"
          noWrap
          component={href ? 'a' : 'span'}
          href={href}
          target={href ? '_blank' : undefined}
          rel={href ? 'noopener noreferrer' : undefined}
          onClick={href ? () => onOpen?.() : undefined}
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            textDecoration: 'none',
            color: 'text.primary',
            '&:hover': href ? { color: 'primary.main' } : undefined,
          }}
        >
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
          {count}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={width}
        sx={{ height: 8, borderRadius: 1, bgcolor: 'action.hover' }}
      />
    </Box>
  );
}

function compareLinks(a: LinkRow, b: LinkRow, key: SortKey, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1;
  switch (key) {
    case 'title':
      return mul * a.title.localeCompare(b.title);
    case 'cardTitle':
      return mul * a.cardTitle.localeCompare(b.cardTitle);
    case 'clicked':
      return mul * (Number(a.clicked) - Number(b.clicked));
    case 'clickCount':
      return mul * (a.clickCount - b.clickCount);
    case 'lastClickedAt': {
      const aTs = a.lastClickedAt ? Date.parse(a.lastClickedAt) : 0;
      const bTs = b.lastClickedAt ? Date.parse(b.lastClickedAt) : 0;
      return mul * (aTs - bTs);
    }
    default:
      return 0;
  }
}

export function KpiPage() {
  const { t, locale } = useLocale();
  const displayUser = getDisplayUser();
  const [kpi, setKpi] = useState<KpiSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('clickCount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setKpi(await api.getKpi());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(getDateLocale(locale), {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

  const sortedLinks = useMemo(() => {
    const rows = [...(kpi?.links ?? [])];
    rows.sort((a, b) => compareLinks(a, b, sortKey, sortDir));
    return rows;
  }, [kpi?.links, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'title' || key === 'cardTitle' ? 'asc' : 'desc');
  };

  const maxTop = Math.max(1, ...(kpi?.topLinks.map((d) => d.clicks) ?? [1]));
  const maxActor = Math.max(1, ...(kpi?.clicksByActor.map((d) => d.count) ?? [1]));
  const maxCard = Math.max(1, ...(kpi?.clicksByCard.map((d) => d.count) ?? [1]));

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Navbar sessionUser={displayUser} />

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 }, flexGrow: 1 }}>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2.5 }}
        >
          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <InsightsOutlinedIcon color="primary" />
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('kpi.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('kpi.subtitle')}
            </Typography>
          </Box>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
            {t('kpi.refresh')}
          </Button>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && !kpi ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : kpi ? (
          <Stack sx={{ gap: 2.5 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
                {t('kpi.overview')}
              </Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2.5 }}>
                <Metric label={t('kpi.totalClicks')} value={kpi.totals.totalClicks} />
                <Metric label={t('kpi.uniqueClicked')} value={kpi.totals.uniqueLinksClicked} />
                <Metric label={t('kpi.links')} value={kpi.totals.links} />
                <Metric label={t('kpi.deadLinks')} value={kpi.totals.deadLinks} />
                <Metric label={t('kpi.cards')} value={kpi.totals.cards} />
                <Metric label={t('kpi.folders')} value={kpi.totals.folders} />
                <Metric
                  label={t('kpi.activityEvents')}
                  value={kpi.totals.activityEvents}
                  hint={`${kpi.activitySummary.create} / ${kpi.activitySummary.update} / ${kpi.activitySummary.delete}`}
                />
              </Stack>
              {kpi.generatedAt && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  {t('kpi.generatedAt', { date: formatDate(kpi.generatedAt) })}
                  {kpi.timeZone ? ` · ${t('kpi.timeZone', { zone: kpi.timeZone })}` : null}
                </Typography>
              )}
            </Paper>

            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2.5, alignItems: 'stretch' }}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('kpi.byEnvironment')}
                </Typography>
                <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={`${t('environment.prd')}: ${kpi.byEnvironment.PRD}`} color="success" variant="outlined" />
                  <Chip label={`${t('environment.stg')}: ${kpi.byEnvironment.STG}`} color="warning" variant="outlined" />
                  <Chip
                    label={`${t('environment.notDefine')}: ${kpi.byEnvironment['Not define']}`}
                    variant="outlined"
                  />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('kpi.activityMix')}
                </Typography>
                <RankBar label={t('activity.actionCreate')} count={kpi.activitySummary.create} max={Math.max(1, ...Object.values(kpi.activitySummary))} />
                <RankBar label={t('activity.actionUpdate')} count={kpi.activitySummary.update} max={Math.max(1, ...Object.values(kpi.activitySummary))} />
                <RankBar label={t('activity.actionDelete')} count={kpi.activitySummary.delete} max={Math.max(1, ...Object.values(kpi.activitySummary))} />
              </Paper>

              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, flex: 1.6, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('kpi.clicksLast30Days')}
                </Typography>
                <ClicksByDayChart days={kpi.clicksByDay} />
              </Paper>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 2.5 }}>
              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('kpi.topLinks')}
                </Typography>
                {kpi.topLinks.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    {t('kpi.noClicksYet')}
                  </Typography>
                ) : (
                  kpi.topLinks.map((link) => (
                    <RankBar
                      key={link.linkId}
                      label={`${link.title} · ${link.cardTitle}`}
                      count={link.clicks}
                      max={maxTop}
                      href={link.url}
                      onOpen={() => {
                        void api.recordLinkClick(link.linkId).catch(() => {});
                      }}
                    />
                  ))
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 1, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('kpi.byUser')}
                </Typography>
                {kpi.clicksByActor.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    {t('kpi.noClicksYet')}
                  </Typography>
                ) : (
                  kpi.clicksByActor.map((row) => (
                    <RankBar key={row.actor} label={row.actor} count={row.count} max={maxActor} />
                  ))
                )}
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                  {t('kpi.byCard')}
                </Typography>
                {kpi.clicksByCard.length === 0 ? (
                  <Typography color="text.secondary" variant="body2">
                    {t('kpi.noClicksYet')}
                  </Typography>
                ) : (
                  kpi.clicksByCard.map((row) => (
                    <RankBar key={row.cardId} label={row.cardTitle} count={row.count} max={maxCard} />
                  ))
                )}
              </Paper>
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {t('kpi.allLinks')}
                  </Typography>
                  <Chip
                    size="small"
                    label={sortedLinks.length}
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                </Stack>
              </Box>
              {sortedLinks.length === 0 ? (
                <Box sx={{ px: 2.5, py: 4 }}>
                  <Typography color="text.secondary" variant="body2">
                    {t('kpi.noLinks')}
                  </Typography>
                </Box>
              ) : (
                <TableContainer sx={{ maxHeight: 480 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sortDirection={sortKey === 'title' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'title'}
                            direction={sortKey === 'title' ? sortDir : 'asc'}
                            onClick={() => handleSort('title')}
                          >
                            {t('kpi.colTitle')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sortDirection={sortKey === 'cardTitle' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'cardTitle'}
                            direction={sortKey === 'cardTitle' ? sortDir : 'asc'}
                            onClick={() => handleSort('cardTitle')}
                          >
                            {t('kpi.colCard')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sortDirection={sortKey === 'clicked' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'clicked'}
                            direction={sortKey === 'clicked' ? sortDir : 'desc'}
                            onClick={() => handleSort('clicked')}
                          >
                            {t('kpi.colClicked')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sortDirection={sortKey === 'clickCount' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'clickCount'}
                            direction={sortKey === 'clickCount' ? sortDir : 'desc'}
                            onClick={() => handleSort('clickCount')}
                          >
                            {t('kpi.colClicks')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sortDirection={sortKey === 'lastClickedAt' ? sortDir : false}>
                          <TableSortLabel
                            active={sortKey === 'lastClickedAt'}
                            direction={sortKey === 'lastClickedAt' ? sortDir : 'desc'}
                            onClick={() => handleSort('lastClickedAt')}
                          >
                            {t('kpi.colLastClick')}
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" padding="checkbox" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedLinks.map((row) => (
                        <TableRow key={row.linkId} hover>
                          <TableCell sx={{ maxWidth: 280 }}>
                            <Stack direction="row" sx={{ alignItems: 'center', gap: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap sx={{ fontWeight: 600, minWidth: 0 }} title={row.title}>
                                {row.title}
                              </Typography>
                              {row.isDead && (
                                <Chip
                                  size="small"
                                  color="error"
                                  variant="outlined"
                                  label={t('link.dead')}
                                  sx={{ height: 20, fontSize: '0.65rem', flexShrink: 0 }}
                                />
                              )}
                              <Chip
                                size="small"
                                label={row.environment}
                                sx={{ height: 20, fontSize: '0.65rem', flexShrink: 0 }}
                              />
                            </Stack>
                            <Typography
                              variant="caption"
                              noWrap
                              component="a"
                              href={row.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={row.url}
                              sx={{
                                display: 'block',
                                textDecoration: 'none',
                                color: 'text.secondary',
                                '&:hover': { color: 'primary.main' },
                              }}
                            >
                              {row.url}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" noWrap title={row.cardTitle} sx={{ maxWidth: 160 }}>
                              {row.cardTitle}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={row.clicked ? t('kpi.clickedYes') : t('kpi.clickedNo')}
                              color={row.clicked ? 'success' : 'default'}
                              variant={row.clicked ? 'filled' : 'outlined'}
                              sx={{ height: 22, fontSize: '0.7rem' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.clickCount}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color={row.lastClickedAt ? 'text.primary' : 'text.secondary'}>
                              {row.lastClickedAt ? formatDate(row.lastClickedAt) : t('kpi.neverClicked')}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" padding="checkbox">
                            <Tooltip title={t('history.open')}>
                              <IconButton
                                size="small"
                                component="a"
                                href={row.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={() => {
                                  void api.recordLinkClick(row.linkId).catch(() => {});
                                }}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t('kpi.recentClicks')}
                </Typography>
              </Box>
              {kpi.recentClicks.length === 0 ? (
                <Box sx={{ px: 2.5, py: 4 }}>
                  <Typography color="text.secondary" variant="body2">
                    {t('kpi.noClicksYet')}
                  </Typography>
                </Box>
              ) : (
                <List disablePadding>
                  {kpi.recentClicks.map((click, index) => (
                    <Box key={click.id}>
                      {index > 0 && <Divider />}
                      <ListItem
                        secondaryAction={
                          <Tooltip title={t('history.open')}>
                            <IconButton
                              edge="end"
                              component="a"
                              href={click.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                void api.recordLinkClick(click.linkId).catch(() => {});
                              }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        }
                        sx={{ pr: 8 }}
                      >
                        <LinkIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 18 }} />
                        <ListItemText
                          primary={
                            <Stack direction="row" sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {click.title}
                              </Typography>
                              <Chip size="small" label={click.environment} sx={{ height: 20, fontSize: '0.65rem' }} />
                              <Chip size="small" variant="outlined" label={click.cardTitle} sx={{ height: 20, fontSize: '0.65rem' }} />
                            </Stack>
                          }
                          secondary={`${formatDate(click.at)} · ${t('activity.by', { actor: click.actor })}`}
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          </Stack>
        ) : null}
      </Container>
    </Box>
  );
}
