import { alpha, createTheme, type PaletteMode } from '@mui/material';

export const BNP_GREEN = '#00965A';
export const BNP_GREEN_DARK = '#007348';
export const BNP_GREEN_LIGHT = '#6ABB97';
export const BNP_GREEN_PALE_LIGHT = '#E8F5EF';
export const BNP_GREEN_PALE_DARK = '#1A2E26';

export function getGreenPale(mode: PaletteMode) {
  return mode === 'dark' ? BNP_GREEN_PALE_DARK : BNP_GREEN_PALE_LIGHT;
}

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: BNP_GREEN,
        dark: BNP_GREEN_DARK,
        light: BNP_GREEN_LIGHT,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: isDark ? '#0A0D0C' : '#1A1A1A',
        contrastText: '#FFFFFF',
      },
      background: {
        default: isDark ? '#121514' : '#F4F6F5',
        paper: isDark ? '#1C211F' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E8ECE9' : '#1A1A1A',
        secondary: isDark ? '#9AA8A0' : '#5C6660',
      },
      divider: isDark ? '#2E3834' : '#E0E4E2',
      error: {
        main: isDark ? '#FF6B6B' : '#D32F2F',
      },
      action: {
        hover: isDark ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.04),
        selected: isDark ? alpha('#FFFFFF', 0.12) : alpha('#000000', 0.08),
      },
    },
    typography: {
      fontFamily: '"Open Sans", "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 4 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            colorScheme: mode,
          },
          body: {
            backgroundColor: isDark ? '#121514' : '#F4F6F5',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          contained: {
            '&.MuiButton-colorPrimary:hover': { backgroundColor: BNP_GREEN_DARK },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.06)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha('#FFFFFF', 0.04) : '#FAFBFA',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 4, backgroundImage: 'none' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
    },
  });
}
