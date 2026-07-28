import {
  Autocomplete,
  Box,
  Chip,
  FormControl,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useLocale } from '../context/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import { LINK_ENVIRONMENTS, type Card, type LinkEnvironment } from '../types';
import type { FilterState } from '../utils/filters';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  cards: Card[];
  allTags: string[];
  allAuthors: string[];
}

const ENV_LABEL_KEYS: Record<LinkEnvironment, TranslationKey> = {
  PRD: 'environment.prd',
  STG: 'environment.stg',
  'Not define': 'environment.notDefine',
};

function FieldLabel({ children }: { children: string }) {
  return (
    <Typography
      variant="caption"
      component="label"
      sx={{
        display: 'block',
        mb: 0.5,
        fontWeight: 600,
        color: 'text.secondary',
        lineHeight: 1.3,
      }}
    >
      {children}
    </Typography>
  );
}

export function FilterBar({ filters, onChange, cards, allTags, allAuthors }: FilterBarProps) {
  const { t } = useLocale();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1.5,
        alignItems: 'end',
      }}
    >
      <Box sx={{ gridColumn: '1 / -1' }}>
        <FieldLabel>{t('filters.tags')}</FieldLabel>
        <Autocomplete
          multiple
          size="small"
          options={allTags}
          value={filters.tags}
          onChange={(_, tags) => onChange({ ...filters, tags })}
          renderInput={(params) => <TextField {...params} size="small" />}
          renderValue={(tags, getItemProps) =>
            tags.map((tag, index) => {
              const { key, ...props } = getItemProps({ index });
              return <Chip key={key} label={tag} size="small" {...props} />;
            })
          }
        />
      </Box>

      <Box>
        <FieldLabel>{t('filters.environment')}</FieldLabel>
        <FormControl size="small" fullWidth>
          <Select
            displayEmpty
            value={filters.environment ?? ''}
            onChange={(e) => {
              const val = String(e.target.value);
              onChange({
                ...filters,
                environment: val === '' ? null : (val as LinkEnvironment),
              });
            }}
          >
            <MenuItem value="">{t('filters.allEnvironments')}</MenuItem>
            {LINK_ENVIRONMENTS.map((env) => (
              <MenuItem key={env} value={env}>
                {t(ENV_LABEL_KEYS[env])}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box>
        <FieldLabel>{t('filters.card')}</FieldLabel>
        <FormControl size="small" fullWidth>
          <Select
            displayEmpty
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
      </Box>

      <Box>
        <FieldLabel>{t('filters.addedBy')}</FieldLabel>
        <FormControl size="small" fullWidth>
          <Select
            displayEmpty
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
      </Box>

      <Box>
        <FieldLabel>{t('filters.dateFrom')}</FieldLabel>
        <TextField
          type="date"
          size="small"
          fullWidth
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
        />
      </Box>

      <Box>
        <FieldLabel>{t('filters.dateTo')}</FieldLabel>
        <TextField
          type="date"
          size="small"
          fullWidth
          value={filters.dateTo ?? ''}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 40 }}>
        <Switch
          checked={filters.favoritesOnly}
          onChange={(e) => onChange({ ...filters, favoritesOnly: e.target.checked })}
          size="small"
        />
        <Typography variant="body2">{t('filters.favorites')}</Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 40 }}>
        <Switch
          checked={filters.deadOnly}
          onChange={(e) => onChange({ ...filters, deadOnly: e.target.checked })}
          size="small"
        />
        <Typography variant="body2">{t('filters.deadLinks')}</Typography>
      </Box>
    </Box>
  );
}
