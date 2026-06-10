import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
}

export function SearchBar({ value, onChange, resultCount }: SearchBarProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <TextField
        fullWidth
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher une carte, un lien ou une URL…"
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
      {value.trim() && resultCount !== undefined && (
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 4,
              height: 16,
              bgcolor: 'primary.main',
              borderRadius: 0.5,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {resultCount === 0
              ? 'Aucun résultat trouvé'
              : `${resultCount} résultat${resultCount > 1 ? 's' : ''}`}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}
