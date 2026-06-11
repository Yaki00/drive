import FilterListIcon from '@mui/icons-material/FilterList';
import {
  Autocomplete,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useLocale } from '../context/LocaleContext';
import type { Card } from '../types';
import type { FilterState } from '../utils/filters';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  cards: Card[];
  allTags: string[];
  allAuthors: string[];
}

export function FilterBar({ filters, onChange, cards, allTags, allAuthors }: FilterBarProps) {
  const { t } = useLocale();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <FilterListIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {t('filters.title')}
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '2fr 1fr 1fr 1fr 1fr 1fr' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <Autocomplete
          multiple
          options={allTags}
          value={filters.tags}
          onChange={(_, tags) => onChange({ ...filters, tags })}
          renderInput={(params) => <TextField {...params} label={t('filters.tags')} size="small" />}
          renderValue={(tags, getItemProps) =>
            tags.map((tag, index) => {
              const { key, ...props } = getItemProps({ index });
              return <Chip key={key} label={tag} size="small" {...props} />;
            })
          }
        />

        <FormControl size="small">
          <InputLabel>{t('filters.card')}</InputLabel>
          <Select
            label={t('filters.card')}
            value={filters.cardId === null ? '' : String(filters.cardId)}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filters,
                cardId: val === '' ? null : Number(val),
              });
            }}
          >
            <MenuItem value="">{t('filters.allCards')}</MenuItem>
            {cards.map((card) => (
              <MenuItem key={card.id} value={card.id}>
                {card.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>{t('filters.addedBy')}</InputLabel>
          <Select
            label={t('filters.addedBy')}
            value={filters.createdBy ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                createdBy: e.target.value === '' ? null : e.target.value,
              })
            }
          >
            <MenuItem value="">{t('filters.allAuthors')}</MenuItem>
            {allAuthors.map((author) => (
              <MenuItem key={author} value={author}>
                {author}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label={t('filters.dateFrom')}
          type="date"
          size="small"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label={t('filters.dateTo')}
          type="date"
          size="small"
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch
            checked={filters.favoritesOnly}
            onChange={(e) => onChange({ ...filters, favoritesOnly: e.target.checked })}
            size="small"
          />
          <Typography variant="body2">{t('filters.favorites')}</Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch
            checked={filters.deadOnly}
            onChange={(e) => onChange({ ...filters, deadOnly: e.target.checked })}
            size="small"
          />
          <Typography variant="body2">{t('filters.deadLinks')}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}
