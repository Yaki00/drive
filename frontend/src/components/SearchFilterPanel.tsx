import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import { Box, Chip, Collapse, IconButton, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import { getGreenPale } from '../theme';
import type { Card } from '../types';
import { hasActiveFilters, type FilterState } from '../utils/filters';
import { FilterBar } from './FilterBar';
import { SearchBar } from './SearchBar';

interface SearchFilterPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  resultCount?: number;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  cards: Card[];
  allTags: string[];
  allAuthors: string[];
}

export function SearchFilterPanel({
  searchQuery,
  onSearchChange,
  resultCount,
  filters,
  onFiltersChange,
  cards,
  allTags,
  allAuthors,
}: SearchFilterPanelProps) {
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);
  const { t } = useLocale();
  const [filtersExpanded, setFiltersExpanded] = useState(() => hasActiveFilters(filters));
  const filtersActive = hasActiveFilters(filters);

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
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: greenPale,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <SearchIcon sx={{ color: 'primary.main', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {t('search.title')}
        </Typography>
        {resultCount !== undefined && (
          <Chip label={resultCount} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0 }}>
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          resultCount={resultCount}
          showResultCount={filtersActive || Boolean(searchQuery.trim())}
        />

        <Box
          role="button"
          tabIndex={0}
          onClick={() => setFiltersExpanded((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFiltersExpanded((v) => !v);
            }
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer',
            userSelect: 'none',
            py: 0.5,
            px: 0.5,
            borderRadius: 1,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <FilterListIcon sx={{ fontSize: 18, color: filtersActive ? 'primary.main' : 'text.secondary' }} />
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 700, flexGrow: 1, color: filtersActive ? 'primary.main' : 'text.primary' }}
          >
            {t('filters.title')}
          </Typography>
          {filtersActive && (
            <Chip label={t('filters.active')} size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
          )}
          <IconButton size="small" tabIndex={-1} sx={{ p: 0.25 }} aria-label={t('filters.title')}>
            {filtersExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Collapse in={filtersExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ maxHeight: 280, overflow: 'auto', pt: 0.5 }}>
            <FilterBar
              filters={filters}
              onChange={onFiltersChange}
              cards={cards}
              allTags={allTags}
              allAuthors={allAuthors}
            />
          </Box>
        </Collapse>
      </Box>
    </Paper>
  );
}
