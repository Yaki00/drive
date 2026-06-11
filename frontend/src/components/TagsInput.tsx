import { Autocomplete, Chip, TextField } from '@mui/material';
import { useLocale } from '../context/LocaleContext';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagsInput({ value, onChange, suggestions = [] }: TagsInputProps) {
  const { t } = useLocale();

  return (
    <Autocomplete
      multiple
      freeSolo
      options={suggestions}
      value={value}
      onChange={(_, newValue) =>
        onChange(
          newValue.map((tag) => (typeof tag === 'string' ? tag.trim() : tag)).filter(Boolean),
        )
      }
      renderValue={(tags, getItemProps) =>
        tags.map((tag, index) => {
          const { key, ...itemProps } = getItemProps({ index });
          return (
            <Chip
              key={key}
              label={tag}
              size="small"
              {...itemProps}
              sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600 }}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={t('tags.label')}
          placeholder={t('tags.placeholder')}
          helperText={t('tags.hint')}
        />
      )}
    />
  );
}
