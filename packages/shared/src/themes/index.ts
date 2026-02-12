import type { ThemeConfig, ClientThemeId } from '../types/theme';
import { defaultTheme } from './default';
import { ePlaceTheme } from './eplace';

/**
 * Theme registry for RealFlow
 * Add new client themes here
 */
export const themes: Record<ClientThemeId, ThemeConfig> = {
  default: defaultTheme,
  eplace: ePlaceTheme,
};

/**
 * Get theme by ID
 * Falls back to default theme if not found
 */
export function getTheme(themeId: ClientThemeId): ThemeConfig {
  return themes[themeId] || themes.default;
}

/**
 * Get all available themes
 */
export function getAllThemes(): ThemeConfig[] {
  return Object.values(themes);
}

/**
 * Check if theme exists
 */
export function themeExists(themeId: string): boolean {
  return themeId in themes;
}

export { defaultTheme, ePlaceTheme };
export * from '../types/theme';
