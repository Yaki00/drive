import { Alert, Box, Button, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useLocale } from '../context/LocaleContext';
import { setAuthToken, setSessionUser } from '../utils/sessionUser';

function parseHashParams(hash: string) {
  const raw = String(hash || '').replace(/^#/, '');
  const params = new URLSearchParams(raw);
  const token = params.get('token') || '';
  const error = params.get('error') || '';
  return { token, error };
}

export function LoginSsoCallbackPage() {
  const navigate = useNavigate();
  const { t } = useLocale();

  const [error, setError] = useState('');

  const { token, error: hashError } = useMemo(
    () => parseHashParams(window.location.hash),
    [],
  );

  useEffect(() => {
    const run = async () => {
      if (hashError) {
        setError(hashError);
        return;
      }

      if (!token) {
        setError('missing_token');
        return;
      }

      setAuthToken(token);

      try {
        const me = await api.me();
        setSessionUser({
          id: me.user.id,
          fullName: me.user.fullName,
        });
        navigate('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : t('login.ssoFailed'));
      }
    };

    void run();
  }, [token, hashError, navigate, t]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Box sx={{ width: '100%', maxWidth: 520 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t('login.ssoFailed')}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {error}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/login')}>
                Retour login
              </Button>
            </Box>
          </Alert>
        ) : (
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Connexion SSO en cours…
          </Typography>
        )}
      </Box>
    </Box>
  );
}
