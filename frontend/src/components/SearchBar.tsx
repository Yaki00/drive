import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { useLocale } from '../context/LocaleContext';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
  /** Affiche le compteur même sans texte de recherche (ex. filtres seuls). */
  showResultCount?: boolean;
}

export function SearchBar({ value, onChange, resultCount, showResultCount }: SearchBarProps) {
  const { t } = useLocale();
  const displayCount = showResultCount || value.trim().length > 0;

  return (
    <Box>
      <TextField
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('search.placeholder')}
        size="small"
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'primary.main', fontSize: 22 }} />
              </InputAdornment>
            ),
            endAdornment: value ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => onChange('')} edge="end">
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
        sx={{
          '& .MuiOutlinedInput-root.Mui-focused fieldset': {
            borderColor: 'primary.main',
            borderWidth: 2,
          },
        }}
      />
      {displayCount && resultCount !== undefined && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 4, height: 16, bgcolor: 'primary.main', borderRadius: 0.5 }} />
          <Typography variant="caption" color="text.secondary">
            {resultCount === 0
              ? t('search.noResults')
              : t(resultCount === 1 ? 'search.result' : 'search.results', { count: resultCount })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
