import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { Card, CreateLinkPayload, Link } from '../types';
import { isValidUrl, normalizeUrl } from '../utils/url';
import { TagsInput } from './TagsInput';

interface LinkDialogProps {
  open: boolean;
  link?: Link | null;
  cards?: Card[];
  onClose: () => void;
  onSave: (data: CreateLinkPayload & { cardId?: number }) => Promise<void>;
  tagSuggestions?: string[];
}

const emptyForm: CreateLinkPayload = {
  title: '',
  url: '',
  description: '',
  tags: [],
  isFavorite: false,
};

export function LinkDialog({
  open,
  link,
  cards = [],
  onClose,
  onSave,
  tagSuggestions = [],
}: LinkDialogProps) {
  const [form, setForm] = useState<CreateLinkPayload & { cardId?: number }>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const folderOptions = useMemo(() => {
    const card = cards.find((c) => c.id === form.cardId);
    return card?.folders ?? [];
  }, [cards, form.cardId]);

  useEffect(() => {
    if (open) {
      setForm(
        link
          ? {
              title: link.title,
              url: link.url,
              description: link.description ?? '',
              tags: link.tags ?? [],
              isFavorite: link.isFavorite,
              cardId: link.cardId,
              folderId: link.folderId,
            }
          : emptyForm,
      );
      setError('');
    }
  }, [open, link]);

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.url.trim()) {
      setError('Le titre et l\'URL sont obligatoires.');
      return;
    }

    const normalizedUrl = normalizeUrl(form.url);
    if (!isValidUrl(normalizedUrl)) {
      setError('L\'URL n\'est pas valide.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave({
        title: form.title.trim(),
        url: normalizedUrl,
        description: form.description?.trim() || undefined,
        tags: form.tags,
        isFavorite: form.isFavorite,
        cardId: form.cardId,
        folderId: form.folderId ?? null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{link ? 'Modifier le lien' : 'Ajouter un lien'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          label="Titre"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
          fullWidth
        />
        <TextField
          label="URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder="exemple.com ou https://..."
          fullWidth
        />
        <TextField
          label="Description (optionnel)"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          multiline
          rows={2}
          fullWidth
        />
        {link && cards.length > 0 && (
          <>
            <FormControl fullWidth size="small">
              <InputLabel>Carte</InputLabel>
              <Select
                label="Carte"
                value={form.cardId ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cardId: Number(e.target.value),
                    folderId: null,
                  })
                }
              >
                {cards.map((card) => (
                  <MenuItem key={card.id} value={card.id}>
                    {card.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Emplacement</InputLabel>
              <Select
                label="Emplacement"
                value={form.folderId === null || form.folderId === undefined ? '' : String(form.folderId)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    folderId: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              >
                <MenuItem value="">Racine de la carte</MenuItem>
                {folderOptions.map((folder) => (
                  <MenuItem key={folder.id} value={folder.id}>
                    {folder.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}
        <TagsInput
          value={form.tags ?? []}
          onChange={(tags) => setForm({ ...form, tags })}
          suggestions={tagSuggestions}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={form.isFavorite ?? false}
              onChange={(e) => setForm({ ...form, isFavorite: e.target.checked })}
            />
          }
          label="Ajouter aux favoris"
        />
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {link ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
