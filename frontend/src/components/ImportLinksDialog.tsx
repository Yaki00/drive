import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from '../context/LocaleContext';
import type { Card, CreateLinkPayload } from '../types';
import { parseImportFile, type ParsedImportLink } from '../utils/linkTransfer';

interface ImportLinksDialogProps {
  open: boolean;
  cards: Card[];
  onClose: () => void;
  onImport: (payloads: CreateLinkPayload[], cardId: number, folderId: number | null) => Promise<void>;
}

export function ImportLinksDialog({ open, cards, onClose, onImport }: ImportLinksDialogProps) {
  const { t } = useLocale();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jsonText, setJsonText] = useState('');
  const [parsedLinks, setParsedLinks] = useState<ParsedImportLink[]>([]);
  const [parseError, setParseError] = useState('');
  const [cardId, setCardId] = useState<number | ''>('');
  const [folderId, setFolderId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const folderOptions = useMemo(() => {
    const card = cards.find((item) => item.id === cardId);
    return card?.folders ?? [];
  }, [cards, cardId]);

  const validLinks = useMemo(() => parsedLinks.filter((link) => link.valid), [parsedLinks]);
  const invalidCount = parsedLinks.length - validLinks.length;

  useEffect(() => {
    if (!open) return;
    setJsonText('');
    setParsedLinks([]);
    setParseError('');
    setFolderId('');
    setCardId(cards[0]?.id ?? '');
  }, [open, cards]);

  const parseContent = (content: string) => {
    setJsonText(content);
    if (!content.trim()) {
      setParsedLinks([]);
      setParseError('');
      return;
    }

    const links = parseImportFile(content);
    if (links.length === 0) {
      setParsedLinks([]);
      setParseError(t('import.invalidFile'));
      return;
    }

    setParsedLinks(links);
    setParseError('');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const content = await file.text();
    parseContent(content);
  };

  const linkErrorMessage = (error?: string) => {
    if (error === 'missingFields') return t('import.missingFields');
    if (error === 'invalidUrl') return t('import.invalidUrl');
    return t('import.invalidEntry');
  };

  const handleImport = async () => {
    if (!cardId || validLinks.length === 0) return;
    setLoading(true);
    try {
      const payloads: CreateLinkPayload[] = validLinks.map((link) => ({
        title: link.title,
        url: link.url,
        description: link.description || undefined,
        tags: link.tags,
        isFavorite: link.isFavorite,
      }));
      await onImport(payloads, cardId, folderId === '' ? null : folderId);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('import.title')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {t('import.hint')}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
            {t('import.chooseFile')}
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" hidden onChange={handleFileChange} />
        </Box>

        <TextField
          label={t('import.pasteJson')}
          value={jsonText}
          onChange={(e) => parseContent(e.target.value)}
          multiline
          minRows={4}
          placeholder='{"links":[{"title":"Example","url":"https://example.com"}]}'
          fullWidth
        />

        {parseError && <Alert severity="error">{parseError}</Alert>}

        {parsedLinks.length > 0 && (
          <>
            <Typography variant="body2">
              {t('import.summary', { valid: validLinks.length, total: parsedLinks.length })}
              {invalidCount > 0 ? ` — ${t('import.skipped', { count: invalidCount })}` : ''}
            </Typography>

            <List dense sx={{ maxHeight: 180, overflow: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {parsedLinks.map((link) => (
                <ListItem key={link.index} sx={{ py: 0.25 }}>
                  <ListItemText
                    primary={link.title || t('import.untitled')}
                    secondary={link.valid ? link.url : linkErrorMessage(link.error)}
                    slotProps={{
                      primary: { noWrap: true },
                      secondary: {
                        noWrap: true,
                        color: link.valid ? 'text.secondary' : 'error',
                      },
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}

        <FormControl fullWidth disabled={cards.length === 0}>
          <InputLabel>{t('import.targetCard')}</InputLabel>
          <Select
            label={t('import.targetCard')}
            value={cardId}
            onChange={(e) => {
              setCardId(e.target.value as number);
              setFolderId('');
            }}
          >
            {cards.map((card) => (
              <MenuItem key={card.id} value={card.id}>
                {card.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={!cardId || folderOptions.length === 0}>
          <InputLabel>{t('import.targetFolder')}</InputLabel>
          <Select
            label={t('import.targetFolder')}
            value={folderId}
            onChange={(e) => setFolderId(e.target.value as number | '')}
          >
            <MenuItem value="">{t('import.rootFolder')}</MenuItem>
            {folderOptions.map((folder) => (
              <MenuItem key={folder.id} value={folder.id}>
                {folder.title}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('import.cancel')}</Button>
        <Button
          variant="contained"
          onClick={() => void handleImport()}
          disabled={loading || !cardId || validLinks.length === 0}
        >
          {t('import.confirm', { count: validLinks.length })}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
