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
import { useLocale } from '../context/LocaleContext';
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
  const { t } = useLocale();
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
      setError(t('folderDialog.titleRequired'));
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
      setError(err instanceof Error ? err.message : t('linkDialog.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{folder ? t('folderDialog.edit') : t('folderDialog.new')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label={t('folderDialog.title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
          fullWidth
        />
        <TextField
          label={t('folderDialog.description')}
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
        <Button onClick={onClose}>{t('folderDialog.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {folder ? t('folderDialog.save') : t('folderDialog.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
