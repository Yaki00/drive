import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Navbar } from '../components/Navbar';
import { useLocale } from '../context/LocaleContext';
import { getGreenPale } from '../theme';
import { setAuthToken, setSessionUser } from '../utils/sessionUser';

export function LoginPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);
  const { t } = useLocale();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.login(username.trim(), password);
      setAuthToken(result.token);
      setSessionUser({
        id: result.user.id,
        fullName: result.user.fullName,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSso = () => {
    // En DEV Vite, seul /api est proxyé vers le backend (sauf si /auth est aussi proxyé).
    // Le backend retire le préfixe /api → /auth/oidc/start.
    // En PROD (même hôte), /api/auth/... ou /auth/... marchent tous les deux.
    const apiBase =
      import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '/api' : '');
    window.location.href = `${apiBase}/auth/oidc/start`;
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Navbar />
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          py: 6,
        }}
      >
        <Paper
          elevation={0}
          component="form"
          onSubmit={(e) => void handleSubmit(e)}
          sx={{
            width: '100%',
            maxWidth: 420,
            p: 4,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: greenPale,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <LoginOutlinedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>

          <Typography variant="h5" align="center" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('login.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            {t('login.subtitle')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField
              label={t('login.username')}
              fullWidth
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
            <TextField
              label={t('login.password')}
              type="password"
              fullWidth
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </Box>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginOutlinedIcon />}
            disabled={loading || !username.trim() || !password}
          >
            {t('login.submit')}
          </Button>

          <Button
            type="button"
            variant="outlined"
            fullWidth
            size="large"
            sx={{ mt: 2 }}
            onClick={handleSso}
            disabled={loading}
          >
            {t('login.sso')}
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
