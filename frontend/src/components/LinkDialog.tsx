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
import { useLocale } from '../context/LocaleContext';
import type { TranslationKey } from '../i18n/translations';
import {
  DEFAULT_LINK_ENVIRONMENT,
  LINK_ENVIRONMENTS,
  type Card,
  type CreateLinkPayload,
  type Link,
  type LinkEnvironment,
} from '../types';
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

const ENV_LABEL_KEYS: Record<LinkEnvironment, TranslationKey> = {
  PRD: 'environment.prd',
  STG: 'environment.stg',
  'Not define': 'environment.notDefine',
};

const emptyForm: CreateLinkPayload = {
  title: '',
  url: '',
  description: '',
  tags: [],
  environment: DEFAULT_LINK_ENVIRONMENT,
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
  const { t } = useLocale();
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
              environment: link.environment ?? DEFAULT_LINK_ENVIRONMENT,
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
      setError(t('linkDialog.required'));
      return;
    }
    if (!form.environment || !LINK_ENVIRONMENTS.includes(form.environment)) {
      setError(t('linkDialog.environmentRequired'));
      return;
    }

    const normalizedUrl = normalizeUrl(form.url);
    if (!isValidUrl(normalizedUrl)) {
      setError(t('linkDialog.invalidUrl'));
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
        environment: form.environment,
        isFavorite: form.isFavorite,
        cardId: form.cardId,
        folderId: form.folderId ?? null,
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
      <DialogTitle>{link ? t('linkDialog.edit') : t('linkDialog.add')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label={t('linkDialog.title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          autoFocus
          fullWidth
        />
        <TextField
          label={t('linkDialog.url')}
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          placeholder={t('linkDialog.urlPlaceholder')}
          fullWidth
        />
        <TextField
          label={t('linkDialog.description')}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          multiline
          rows={2}
          fullWidth
        />
        <FormControl fullWidth required>
          <InputLabel>{t('linkDialog.environment')}</InputLabel>
          <Select
            label={t('linkDialog.environment')}
            value={form.environment}
            onChange={(e) =>
              setForm({ ...form, environment: e.target.value as LinkEnvironment })
            }
          >
            {LINK_ENVIRONMENTS.map((env) => (
              <MenuItem key={env} value={env}>
                {t(ENV_LABEL_KEYS[env])}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {link && cards.length > 0 && (
          <>
            <FormControl fullWidth size="small">
              <InputLabel>{t('linkDialog.card')}</InputLabel>
              <Select
                label={t('linkDialog.card')}
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
              <InputLabel>{t('linkDialog.location')}</InputLabel>
              <Select
                label={t('linkDialog.location')}
                value={form.folderId === null || form.folderId === undefined ? '' : String(form.folderId)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    folderId: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              >
                <MenuItem value="">{t('linkDialog.root')}</MenuItem>
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
          label={t('linkDialog.favorite')}
        />
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('linkDialog.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {link ? t('linkDialog.save') : t('linkDialog.addBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
