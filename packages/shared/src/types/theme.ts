/**
 * Theme configuration types for RealFlow
 * Supports client-specific branding and personalization
 */

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface ThemeColors {
  primary: ColorScale;
  secondary: ColorScale;
  accent: ColorScale;
  neutral: ColorScale;
  success: ColorScale;
  warning: ColorScale;
  error: ColorScale;
}

export interface ThemeTypography {
  fontFamily: {
    sans: string[];
    serif?: string[];
    mono?: string[];
  };
  headingWeight: number;
  bodyWeight: number;
}

export interface ThemeBranding {
  logo?: string;
  logoLight?: string;
  logoDark?: string;
  favicon?: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  branding?: ThemeBranding;
  customCSS?: string;
}

export type ClientThemeId = 'default' | 'eplace' | string;

export interface ClientThemeMapping {
  clientId: string;
  themeId: ClientThemeId;
}
