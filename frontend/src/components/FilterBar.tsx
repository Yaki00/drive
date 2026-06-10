import FilterListIcon from '@mui/icons-material/FilterList';
import PersonIcon from '@mui/icons-material/Person';
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
import type { Card } from '../types';
import type { FilterState } from '../utils/filters';

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  cards: Card[];
  allTags: string[];
  allAuthors: string[];
  currentUser: string;
  onCurrentUserChange: (name: string) => void;
}

export function FilterBar({
  filters,
  onChange,
  cards,
  allTags,
  allAuthors,
  currentUser,
  onCurrentUserChange,
}: FilterBarProps) {
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Filtres
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
          <PersonIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <TextField
            size="small"
            label="Utilisateur actuel"
            value={currentUser}
            onChange={(e) => onCurrentUserChange(e.target.value)}
            onBlur={(e) => onCurrentUserChange(e.target.value)}
            sx={{ minWidth: 160 }}
          />
        </Box>
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
          renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
          renderValue={(tags, getItemProps) =>
            tags.map((tag, index) => {
              const { key, ...props } = getItemProps({ index });
              return <Chip key={key} label={tag} size="small" {...props} />;
            })
          }
        />

        <FormControl size="small">
          <InputLabel>Carte</InputLabel>
          <Select
            label="Carte"
            value={filters.cardId === null ? '' : String(filters.cardId)}
            onChange={(e) => {
              const val = e.target.value;
              onChange({
                ...filters,
                cardId: val === '' ? null : Number(val),
              });
            }}
          >
            <MenuItem value="">Toutes</MenuItem>
            {cards.map((card) => (
              <MenuItem key={card.id} value={card.id}>
                {card.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>Ajouté par</InputLabel>
          <Select
            label="Ajouté par"
            value={filters.createdBy ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                createdBy: e.target.value === '' ? null : e.target.value,
              })
            }
          >
            <MenuItem value="">Tous</MenuItem>
            {allAuthors.map((author) => (
              <MenuItem key={author} value={author}>
                {author}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Depuis le"
          type="date"
          size="small"
          value={filters.dateFrom ?? ''}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })}
          slotProps={{ inputLabel: { shrink: true } }}
        />

        <TextField
          label="Jusqu'au"
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
          <Typography variant="body2">Favoris</Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch
            checked={filters.deadOnly}
            onChange={(e) => onChange({ ...filters, deadOnly: e.target.checked })}
            size="small"
          />
          <Typography variant="body2">Liens morts</Typography>
        </Box>
      </Box>
    </Paper>
  );
}
