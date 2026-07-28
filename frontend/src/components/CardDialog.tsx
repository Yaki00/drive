import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import type { Card, CreateCardPayload } from '../types';
import { TagsInput } from './TagsInput';

const COLORS = [
  '#00965A', // vert
  '#1565C0', // bleu
  '#E65100', // orange
  '#6A1B9A', // violet
  '#00838F', // cyan
  '#C62828', // rouge
];

interface CardDialogProps {
  open: boolean;
  card?: Card | null;
  onClose: () => void;
  onSave: (data: CreateCardPayload) => Promise<void>;
  tagSuggestions?: string[];
}

const emptyForm: CreateCardPayload = {
  title: '',
  description: '',
  color: COLORS[0],
  tags: [],
};

export function CardDialog({ open, card, onClose, onSave, tagSuggestions = [] }: CardDialogProps) {
  const theme = useTheme();
  const { t } = useLocale();
  const [form, setForm] = useState<CreateCardPayload>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(
        card
          ? {
              title: card.title,
              description: card.description ?? '',
              color: card.color,
              tags: card.tags ?? [],
            }
          : emptyForm,
      );
      setError('');
    }
  }, [open, card]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError(t('cardDialog.titleRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave({
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
        color: form.color,
        tags: form.tags,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('linkDialog.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{card ? t('cardDialog.edit') : t('cardDialog.new')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label={t('cardDialog.title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
          fullWidth
        />
        <TextField
          label={t('cardDialog.description')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          multiline
          rows={2}
          fullWidth
        />
        <TagsInput
          value={form.tags ?? []}
          onChange={(tags) => setForm({ ...form, tags })}
          suggestions={tagSuggestions}
        />
        <Box>
          <Box sx={{ mb: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
            {t('cardDialog.color')}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setForm({ ...form, color })}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: color,
                  cursor: 'pointer',
                  border: form.color === color ? `3px solid ${theme.palette.text.primary}` : '3px solid transparent',
                  transition: 'transform 0.15s',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              />
            ))}
          </Box>
        </Box>
        {error && <Typography variant="body2" color="error">{error}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cardDialog.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {card ? t('cardDialog.save') : t('cardDialog.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
