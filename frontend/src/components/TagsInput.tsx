import { Autocomplete, Chip, TextField } from '@mui/material';

interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  label?: string;
  suggestions?: string[];
}

export function TagsInput({
  value,
  onChange,
  label = 'Tags',
  suggestions = [],
}: TagsInputProps) {
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
          label={label}
          placeholder="Ajouter un tag…"
          helperText="Entrée pour valider"
        />
      )}
    />
  );
}
