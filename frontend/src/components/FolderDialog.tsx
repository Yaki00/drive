import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { CreateFolderPayload, Folder } from '../types';

interface FolderDialogProps {
  open: boolean;
  folder?: Folder | null;
  onClose: () => void;
  onSave: (data: CreateFolderPayload) => Promise<void>;
}

const emptyForm: CreateFolderPayload = {
  title: '',
  description: '',
};

export function FolderDialog({ open, folder, onClose, onSave }: FolderDialogProps) {
  const [form, setForm] = useState<CreateFolderPayload>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(
        folder
          ? {
              title: folder.title,
              description: folder.description ?? '',
            }
          : emptyForm,
      );
      setError('');
    }
  }, [open, folder]);

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setError('Le titre est obligatoire.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSave({
        title: form.title.trim(),
        description: form.description?.trim() || undefined,
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
      <DialogTitle>{folder ? 'Modifier le dossier' : 'Nouveau dossier'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <TextField
          label="Titre"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
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
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {folder ? 'Enregistrer' : 'Créer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
