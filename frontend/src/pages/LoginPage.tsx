import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { useTheme } from '@mui/material/styles';
import { getGreenPale } from '../theme';

export function LoginPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const greenPale = getGreenPale(theme.palette.mode);

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
            Connexion
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Accédez à vos bookmarks
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <TextField label="Identifiant" fullWidth disabled />
            <TextField label="Mot de passe" type="password" fullWidth disabled />
          </Box>

          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<LoginOutlinedIcon />}
            onClick={() => navigate('/')}
          >
            Se connecter
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}
