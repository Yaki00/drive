import BookmarkIcon from '@mui/icons-material/Bookmark';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import RedoIcon from '@mui/icons-material/Redo';
import UndoIcon from '@mui/icons-material/Undo';
import { Badge, Box, Button, Container, IconButton, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useThemeMode } from '../context/ThemeModeContext';

interface NavbarProps {
  actionButton?: React.ReactNode;
  onUndo?: () => void;
  onRedo?: () => void;
  undoCount?: number;
  redoCount?: number;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function Navbar({
  actionButton,
  onUndo,
  onRedo,
  undoCount = 0,
  redoCount = 0,
  canUndo = false,
  canRedo = false,
}: NavbarProps) {
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();
  const isLoginPage = location.pathname === '/login';
  const isHome = location.pathname === '/';

  return (
    <Box
      component="header"
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        boxShadow: '0 2px 8px rgba(0, 118, 72, 0.25)',
      }}
    >
      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 2.5 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 1,
                bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookmarkIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" component="span" sx={{ fontWeight: 700, lineHeight: 1.2, display: 'block' }}>
                Bookmarks
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                APS Tools
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isHome && onUndo && (
              <Tooltip title={canUndo ? `Retour (${undoCount})` : 'Rien à annuler'}>
                <span>
                  <IconButton
                    onClick={onUndo}
                    disabled={!canUndo}
                    sx={{
                      color: 'primary.contrastText',
                      opacity: canUndo ? 1 : 0.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <Badge badgeContent={undoCount} color="warning" max={9}>
                      <UndoIcon />
                    </Badge>
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {isHome && onRedo && (
              <Tooltip title={canRedo ? `Suivant (${redoCount})` : 'Rien à rétablir'}>
                <span>
                  <IconButton
                    onClick={onRedo}
                    disabled={!canRedo}
                    sx={{
                      color: 'primary.contrastText',
                      opacity: canRedo ? 1 : 0.5,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    <Badge badgeContent={redoCount} color="warning" max={9}>
                      <RedoIcon />
                    </Badge>
                  </IconButton>
                </span>
              </Tooltip>
            )}

            <Tooltip title={mode === 'dark' ? 'Mode clair' : 'Mode sombre'}>
              <IconButton
                onClick={toggleMode}
                sx={{ color: 'primary.contrastText', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            {actionButton}
            {!isLoginPage && (
              <Button
                component={RouterLink}
                to="/login"
                variant="outlined"
                startIcon={<LoginOutlinedIcon />}
                sx={{
                  borderColor: 'rgba(255,255,255,0.6)',
                  color: 'primary.contrastText',
                  '&:hover': {
                    borderColor: 'primary.contrastText',
                    bgcolor: 'rgba(255,255,255,0.1)',
                  },
                }}
              >
                Se connecter
              </Button>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
