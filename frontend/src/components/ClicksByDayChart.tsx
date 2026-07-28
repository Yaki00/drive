import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { getDateLocale } from '../i18n/translations';
import { BNP_GREEN, BNP_GREEN_LIGHT } from '../theme';

export interface DayClickPoint {
  date: string;
  count: number;
}

interface ClicksByDayChartProps {
  days: DayClickPoint[];
}

function niceMax(value: number): number {
  if (value <= 0) return 4;
  const padded = Math.ceil(value * 1.15);
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  const normalized = padded / magnitude;
  const step = normalized <= 2 ? 2 : normalized <= 4 ? 4 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

export function ClicksByDayChart({ days }: ClicksByDayChartProps) {
  const { t, locale } = useLocale();
  const [hovered, setHovered] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = days.reduce((sum, d) => sum + d.count, 0);
    const peak = days.reduce(
      (best, d) => (d.count > best.count ? d : best),
      days[0] ?? { date: '', count: 0 },
    );
    const activeDays = days.filter((d) => d.count > 0).length;
    const avg = days.length ? total / days.length : 0;
    return { total, peak, activeDays, avg };
  }, [days]);

  const yMax = niceMax(stats.peak.count);
  const yTicks = [0, Math.round(yMax / 2), yMax];

  const formatDayShort = (isoDate: string) =>
    new Date(`${isoDate}T12:00:00`).toLocaleDateString(getDateLocale(locale), {
      day: 'numeric',
      month: 'short',
    });

  const formatDayLong = (isoDate: string) =>
    new Date(`${isoDate}T12:00:00`).toLocaleDateString(getDateLocale(locale), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  const labelIndexes = useMemo(() => {
    const indexes = new Set<number>();
    if (days.length === 0) return indexes;
    indexes.add(0);
    indexes.add(days.length - 1);
    const step = Math.max(1, Math.round((days.length - 1) / 5));
    for (let i = step; i < days.length - 1; i += step) indexes.add(i);
    const peakIdx = days.findIndex((d) => d.date === stats.peak.date);
    if (peakIdx >= 0) indexes.add(peakIdx);
    return indexes;
  }, [days, stats.peak.date]);

  if (days.every((d) => d.count === 0)) {
    return (
      <Typography color="text.secondary" variant="body2">
        {t('kpi.noClicksYet')}
      </Typography>
    );
  }

  return (
    <Box>
      <Stack direction="row" sx={{ gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <StatPill label={t('kpi.periodTotal')} value={String(stats.total)} />
        <StatPill label={t('kpi.periodAvg')} value={stats.avg.toFixed(1)} />
        <StatPill
          label={t('kpi.periodPeak')}
          value={`${stats.peak.count}`}
          hint={stats.peak.date ? formatDayShort(stats.peak.date) : undefined}
        />
        <StatPill label={t('kpi.periodActiveDays')} value={String(stats.activeDays)} />
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr',
          gridTemplateRows: '180px auto',
          columnGap: 1,
          rowGap: 0.75,
        }}
      >
        <Box sx={{ position: 'relative', gridRow: 1, gridColumn: 1 }}>
          {yTicks.map((tick) => {
            const bottom = (tick / yMax) * 100;
            return (
              <Typography
                key={tick}
                variant="caption"
                color="text.secondary"
                sx={{
                  position: 'absolute',
                  right: 0,
                  bottom: `calc(${bottom}% - 0.55em)`,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tick}
              </Typography>
            );
          })}
        </Box>

        <Box
          sx={{
            position: 'relative',
            gridRow: 1,
            gridColumn: 2,
            borderLeft: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
            borderRadius: '4px 4px 0 0',
            overflow: 'hidden',
          }}
        >
          {yTicks.slice(1).map((tick) => (
            <Box
              key={tick}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: `${(tick / yMax) * 100}%`,
                borderTop: '1px dashed',
                borderColor: 'divider',
                opacity: 0.8,
                pointerEvents: 'none',
              }}
            />
          ))}

          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'flex-end',
              gap: '3px',
              px: 0.75,
              pb: 0,
            }}
          >
            {days.map((day) => {
              const heightPct = day.count > 0 ? Math.max(6, (day.count / yMax) * 100) : 2;
              const isPeak = day.date === stats.peak.date && day.count > 0;
              const isHovered = hovered === day.date;
              return (
                <Tooltip
                  key={day.date}
                  arrow
                  placement="top"
                  title={
                    <Box sx={{ textAlign: 'center', py: 0.25 }}>
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.85 }}>
                        {formatDayLong(day.date)}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {t(day.count === 1 ? 'kpi.clicksOne' : 'kpi.clicksMany', { count: day.count })}
                      </Typography>
                    </Box>
                  }
                >
                  <Box
                    onMouseEnter={() => setHovered(day.date)}
                    onMouseLeave={() => setHovered(null)}
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      cursor: 'default',
                    }}
                  >
                    {(isHovered || isPeak) && day.count > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          mb: 0.25,
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          lineHeight: 1,
                          color: isPeak ? 'primary.dark' : 'text.secondary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {day.count}
                      </Typography>
                    )}
                    <Box
                      sx={{
                        width: '100%',
                        maxWidth: 18,
                        height: `${heightPct}%`,
                        borderRadius: '4px 4px 1px 1px',
                        bgcolor: day.count === 0 ? 'action.disabledBackground' : isPeak ? BNP_GREEN : BNP_GREEN_LIGHT,
                        outline: isHovered ? '2px solid' : 'none',
                        outlineColor: 'primary.dark',
                        outlineOffset: 1,
                        transition: 'height 160ms ease, background-color 120ms ease, outline 120ms ease',
                        boxShadow: isPeak ? `0 0 0 1px ${BNP_GREEN}` : 'none',
                      }}
                    />
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        <Box sx={{ gridRow: 2, gridColumn: 1 }} />
        <Box
          sx={{
            gridRow: 2,
            gridColumn: 2,
            display: 'flex',
            px: 0.75,
            gap: '3px',
          }}
        >
          {days.map((day, index) => (
            <Box key={day.date} sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
              {labelIndexes.has(index) ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    fontSize: '0.65rem',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {formatDayShort(day.date)}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function StatPill({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.75,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minWidth: 88,
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3, fontVariantNumeric: 'tabular-nums' }}>
        {value}
        {hint ? (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.75, fontWeight: 500 }}>
            · {hint}
          </Typography>
        ) : null}
      </Typography>
    </Box>
  );
}
