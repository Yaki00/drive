import BookmarkIcon from '@mui/icons-material/Bookmark';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import RedoIcon from '@mui/icons-material/Redo';
import TranslateIcon from '@mui/icons-material/Translate';
import UndoIcon from '@mui/icons-material/Undo';
import { Badge, Box, Button, Container, IconButton, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import { useThemeMode } from '../context/ThemeModeContext';
import type { SessionUser } from '../utils/sessionUser';

interface NavbarProps {
  actionButton?: React.ReactNode;
  sessionUser?: SessionUser | null;
  onUndo?: () => void;
  onRedo?: () => void;
  undoCount?: number;
  redoCount?: number;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function Navbar({
  actionButton,
  sessionUser = null,
  onUndo,
  onRedo,
  undoCount = 0,
  redoCount = 0,
  canUndo = false,
  canRedo = false,
}: NavbarProps) {
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();
  const { t, toggleLocale } = useLocale();
  const isLoginPage = location.pathname.startsWith('/login');
  const isHome = location.pathname === '/';
  const isActivity = location.pathname === '/activity';
  const isKpi = location.pathname === '/kpi';
  const showSession = (isHome || isActivity || isKpi) && sessionUser;

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
                {t('app.title')}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.25 }}>
                {t('app.subtitle')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {showSession && (
              <Typography
                variant="body2"
                sx={{
                  opacity: 0.95,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('nav.loggedInAs', { id: sessionUser.id, name: sessionUser.fullName })}
              </Typography>
            )}

            {isHome && onUndo && (
              <Tooltip title={canUndo ? t('nav.undo', { count: undoCount }) : t('nav.nothingToUndo')}>
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
              <Tooltip title={canRedo ? t('nav.redo', { count: redoCount }) : t('nav.nothingToRedo')}>
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

            {!isLoginPage && (
              <Tooltip title={t('nav.kpi')}>
                <IconButton
                  component={RouterLink}
                  to="/kpi"
                  sx={{
                    color: 'primary.contrastText',
                    bgcolor: isKpi ? 'rgba(255,255,255,0.18)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <InsightsOutlinedIcon />
                </IconButton>
              </Tooltip>
            )}

            {!isLoginPage && (
              <Tooltip title={t('nav.activity')}>
                <IconButton
                  component={RouterLink}
                  to="/activity"
                  sx={{
                    color: 'primary.contrastText',
                    bgcolor: isActivity ? 'rgba(255,255,255,0.18)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  <HistoryEduOutlinedIcon />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={t('nav.language')}>
              <IconButton
                onClick={toggleLocale}
                sx={{ color: 'primary.contrastText', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
              >
                <TranslateIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title={mode === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}>
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
                {t('nav.signIn')}
              </Button>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
