import type { ThemeConfig } from '../types/theme';

/**
 * ePlace (Place Estate Agents) theme
 *
 * Brand Identity:
 * - Navy blue primary (2020 rebrand from green)
 * - Encircled 'P' logo with sharp contemporary design
 * - Vibrant Brisbane essence with fresh, clean feel
 * - Modern, professional real estate branding
 *
 * Source: https://www.eplace.com.au/
 * Rebrand: 2020 - sharper logo design, green to navy blue transition
 */
export const ePlaceTheme: ThemeConfig = {
  id: 'eplace',
  name: 'ePlace Estate Agents',
  description: 'Professional navy blue theme for Place Estate Agents (Brisbane)',
  colors: {
    // Navy blue primary (ePlace brand color)
    primary: {
      50: '#f0f4ff',
      100: '#e0e8ff',
      200: '#c7d5fe',
      300: '#a5b9fc',
      400: '#8192f8',
      500: '#5f6af1',
      600: '#4447e5',
      700: '#3437ca',
      800: '#2d30a3',
      900: '#1a1f5e', // Core navy blue
      950: '#0f1333',
    },
    // Complementary teal/aqua (Brisbane coastal vibes)
    secondary: {
      50: '#f0fdfc',
      100: '#ccfbf7',
      200: '#99f6ef',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e',
    },
    // Warm coral accent (modern, approachable)
    accent: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316',
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407',
    },
    // Neutral grays (clean, professional)
    neutral: {
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
      950: '#020617',
    },
    // Success green
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    // Warning amber
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
      950: '#451a03',
    },
    // Error red
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
      950: '#450a0a',
    },
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
      serif: ['Georgia', 'Times New Roman', 'serif'],
    },
    headingWeight: 700,
    bodyWeight: 400,
  },
  branding: {
    logo: '/themes/eplace/logo.svg',
    logoLight: '/themes/eplace/logo-light.svg',
    logoDark: '/themes/eplace/logo-dark.svg',
  },
};
