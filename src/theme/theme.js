/**
 * SentinelOps — Styled Components Theme
 * Centralized theme object for dynamic styling
 */

const theme = {
  colors: {
    primary: {
      50: '#eef6ff',
      100: '#d9eaff',
      200: '#bcdaff',
      300: '#8ec3ff',
      400: '#59a1ff',
      500: '#3380ff',
      600: '#1b5cf5',
      700: '#1447e1',
      800: '#1739b6',
      900: '#19338f',
    },
    accent: {
      50: '#f0fdf5',
      100: '#dcfce8',
      200: '#bbf7d1',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
    },
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    dark: {
      bg: '#0a0e1a',
      surface: '#111827',
      card: '#1a2236',
      border: '#2a3550',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
    },
    surface: {
      0: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },

  fonts: {
    primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },

  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
  },

  spacing: {
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
  },

  radii: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.25rem',
    full: '9999px',
  },

  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    glowPrimary: '0 0 20px rgba(51, 128, 255, 0.3)',
    glowAccent: '0 0 20px rgba(34, 197, 94, 0.3)',
    glowDanger: '0 0 20px rgba(239, 68, 68, 0.3)',
  },

  transitions: {
    fast: '150ms ease',
    base: '250ms ease',
    slow: '350ms ease',
    spring: '500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  zIndex: {
    dropdown: 100,
    sidebar: 200,
    overlay: 300,
    modal: 400,
    toast: 500,
    tooltip: 600,
  },

  layout: {
    sidebarWidth: '280px',
    sidebarCollapsedWidth: '72px',
    navbarHeight: '64px',
    bottomNavHeight: '64px',
  },

  breakpoints: {
    mobile: '480px',
    tablet: '768px',
    desktop: '1024px',
    wide: '1280px',
    ultrawide: '1536px',
  },
}

export default theme
