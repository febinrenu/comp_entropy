import { createTheme, alpha } from '@mui/material/styles';

type PaletteMode = 'light' | 'dark';

// Stunning cyberpunk/aurora color palette
const colors = {
  // Primary - Electric Violet
  primary: {
    main: '#8b5cf6',
    light: '#a78bfa',
    dark: '#7c3aed',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  },
  // Secondary - Cyan Glow
  secondary: {
    main: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
  },
  // Accent colors
  accent: {
    pink: '#ec4899',
    orange: '#f97316',
    yellow: '#eab308',
    lime: '#84cc16',
    emerald: '#10b981',
    teal: '#14b8a6',
    cyan: '#06b6d4',
    blue: '#3b82f6',
    indigo: '#6366f1',
    violet: '#8b5cf6',
    purple: '#a855f7',
    fuchsia: '#d946ef',
    rose: '#f43f5e',
  },
  // Semantic
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  // Dark mode backgrounds - Deep space theme
  dark: {
    bg: '#030712',
    surface: '#0a0f1a',
    surfaceLight: '#111827',
    surfaceElevated: '#1f2937',
    border: 'rgba(139, 92, 246, 0.2)',
    borderLight: 'rgba(255, 255, 255, 0.06)',
  },
  // Light mode backgrounds
  light: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceLight: '#f1f5f9',
    surfaceElevated: '#ffffff',
    border: 'rgba(139, 92, 246, 0.15)',
    borderLight: 'rgba(0, 0, 0, 0.06)',
  },
};

export const getTheme = (mode: PaletteMode) => {
  const isDark = mode === 'dark';
  const bg = isDark ? colors.dark : colors.light;
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary.main,
        light: colors.primary.light,
        dark: colors.primary.dark,
      },
      secondary: {
        main: colors.secondary.main,
        light: colors.secondary.light,
        dark: colors.secondary.dark,
      },
      error: { main: colors.error },
      warning: { main: colors.warning },
      success: { main: colors.success },
      info: { main: colors.info },
      background: {
        default: bg.bg,
        paper: bg.surface,
      },
      text: {
        primary: isDark ? '#f1f5f9' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
      divider: bg.borderLight,
    },
    typography: {
      fontFamily: "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      h1: {
        fontSize: '3rem',
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 1.1,
      },
      h2: {
        fontSize: '2.25rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontSize: '1.375rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontSize: '1.125rem',
        fontWeight: 600,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.7,
        letterSpacing: '0.01em',
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.6,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.02em',
      },
      caption: {
        fontSize: '0.75rem',
        letterSpacing: '0.03em',
      },
      overline: {
        fontSize: '0.7rem',
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      },
    },
    shape: {
      borderRadius: 16,
    },
    shadows: [
      'none',
      `0 2px 8px ${alpha(colors.primary.main, 0.08)}`,
      `0 4px 16px ${alpha(colors.primary.main, 0.1)}`,
      `0 8px 24px ${alpha(colors.primary.main, 0.12)}`,
      `0 12px 32px ${alpha(colors.primary.main, 0.14)}`,
      `0 16px 40px ${alpha(colors.primary.main, 0.16)}`,
      `0 20px 48px ${alpha(colors.primary.main, 0.18)}`,
      `0 24px 56px ${alpha(colors.primary.main, 0.2)}`,
      `0 28px 64px ${alpha(colors.primary.main, 0.22)}`,
      `0 32px 72px ${alpha(colors.primary.main, 0.24)}`,
      `0 36px 80px ${alpha(colors.primary.main, 0.26)}`,
      `0 40px 88px ${alpha(colors.primary.main, 0.28)}`,
      `0 44px 96px ${alpha(colors.primary.main, 0.3)}`,
      `0 48px 104px ${alpha(colors.primary.main, 0.32)}`,
      `0 52px 112px ${alpha(colors.primary.main, 0.34)}`,
      `0 56px 120px ${alpha(colors.primary.main, 0.36)}`,
      `0 60px 128px ${alpha(colors.primary.main, 0.38)}`,
      `0 64px 136px ${alpha(colors.primary.main, 0.4)}`,
      `0 68px 144px ${alpha(colors.primary.main, 0.42)}`,
      `0 72px 152px ${alpha(colors.primary.main, 0.44)}`,
      `0 76px 160px ${alpha(colors.primary.main, 0.46)}`,
      `0 80px 168px ${alpha(colors.primary.main, 0.48)}`,
      `0 84px 176px ${alpha(colors.primary.main, 0.5)}`,
      `0 88px 184px ${alpha(colors.primary.main, 0.52)}`,
      `0 92px 192px ${alpha(colors.primary.main, 0.54)}`,
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.primary.main} ${bg.surface}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative' as const,
            overflow: 'hidden',
          },
          contained: {
            background: colors.primary.gradient,
            boxShadow: `0 4px 20px ${alpha(colors.primary.main, 0.4)}, 0 0 40px ${alpha(colors.primary.main, 0.2)}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: `0 8px 30px ${alpha(colors.primary.main, 0.5)}, 0 0 60px ${alpha(colors.primary.main, 0.3)}`,
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          outlined: {
            borderWidth: 2,
            borderColor: colors.primary.main,
            '&:hover': {
              borderWidth: 2,
              background: alpha(colors.primary.main, 0.1),
              boxShadow: `0 0 20px ${alpha(colors.primary.main, 0.3)}`,
            },
          },
          text: {
            '&:hover': {
              background: alpha(colors.primary.main, 0.1),
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#0a0f1a', 0.8) : alpha('#ffffff', 0.9),
            backdropFilter: 'blur(20px)',
            border: `1px solid ${bg.border}`,
            borderRadius: 20,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative' as const,
            overflow: 'hidden',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: `0 20px 40px ${alpha(colors.primary.main, 0.15)}, 0 0 60px ${alpha(colors.primary.main, 0.1)}`,
              borderColor: alpha(colors.primary.main, 0.4),
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? alpha('#0a0f1a', 0.9) : '#ffffff',
            backdropFilter: 'blur(10px)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.02em',
          },
          filled: {
            background: alpha(colors.primary.main, 0.15),
            '&:hover': {
              background: alpha(colors.primary.main, 0.25),
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            height: 8,
            backgroundColor: alpha(colors.primary.main, 0.1),
          },
          bar: {
            borderRadius: 8,
            background: colors.primary.gradient,
          },
        },
      },
      MuiCircularProgress: {
        styleOverrides: {
          root: {
            color: colors.primary.main,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? '#1f2937' : '#0f172a',
            border: `1px solid ${alpha(colors.primary.main, 0.3)}`,
            borderRadius: 12,
            fontSize: '0.8rem',
            padding: '10px 16px',
            boxShadow: `0 8px 24px ${alpha('#000', 0.3)}`,
          },
          arrow: {
            color: isDark ? '#1f2937' : '#0f172a',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
            backgroundImage: isDark 
              ? `linear-gradient(180deg, ${alpha(colors.primary.main, 0.03)} 0%, transparent 50%)`
              : 'none',
            borderRight: `1px solid ${bg.borderLight}`,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha('#030712', 0.85) : alpha('#ffffff', 0.9),
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${bg.borderLight}`,
            color: isDark ? '#f1f5f9' : '#0f172a',
            boxShadow: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: bg.borderLight,
            padding: '16px',
          },
          head: {
            fontWeight: 700,
            backgroundColor: isDark ? alpha(colors.primary.main, 0.08) : alpha(colors.primary.main, 0.05),
            textTransform: 'uppercase' as const,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              transition: 'all 0.3s ease',
              '& fieldset': {
                borderColor: bg.borderLight,
                borderWidth: 2,
              },
              '&:hover fieldset': {
                borderColor: alpha(colors.primary.main, 0.5),
              },
              '&.Mui-focused fieldset': {
                borderColor: colors.primary.main,
                boxShadow: `0 0 20px ${alpha(colors.primary.main, 0.2)}`,
              },
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: '1px solid',
          },
          standardSuccess: {
            backgroundColor: alpha(colors.success, 0.1),
            borderColor: alpha(colors.success, 0.3),
          },
          standardError: {
            backgroundColor: alpha(colors.error, 0.1),
            borderColor: alpha(colors.error, 0.3),
          },
          standardWarning: {
            backgroundColor: alpha(colors.warning, 0.1),
            borderColor: alpha(colors.warning, 0.3),
          },
          standardInfo: {
            backgroundColor: alpha(colors.info, 0.1),
            borderColor: alpha(colors.info, 0.3),
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            backgroundColor: alpha(colors.primary.main, 0.05),
            padding: 4,
          },
          indicator: {
            height: '100%',
            borderRadius: 10,
            background: colors.primary.gradient,
            zIndex: 0,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            fontWeight: 600,
            zIndex: 1,
            transition: 'all 0.3s ease',
            '&.Mui-selected': {
              color: '#fff',
            },
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.08),
            },
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: bg.borderLight,
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            background: colors.primary.gradient,
            fontWeight: 700,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: alpha(colors.primary.main, 0.1),
              transform: 'scale(1.1)',
            },
          },
        },
      },
    },
  });
};

// Export color utilities for use in components
export { colors };

// Default dark theme for backwards compatibility
export const theme = getTheme('dark');
