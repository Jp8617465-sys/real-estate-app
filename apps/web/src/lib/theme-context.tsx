'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ThemeConfig, ClientThemeId } from '@realflow/shared';
import { getTheme } from '@realflow/shared';

type DarkMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  /** Brand colour theme (default / ePlace / …) */
  theme: ThemeConfig;
  themeId: ClientThemeId;
  setThemeId: (id: ClientThemeId) => void;
  /** Dark mode preference */
  darkMode: DarkMode;
  /** Whether the UI is currently rendered in dark mode */
  isDark: boolean;
  setDarkMode: (mode: DarkMode) => void;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeId?: ClientThemeId;
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children, defaultThemeId = 'default' }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ClientThemeId>(defaultThemeId);
  const [theme, setTheme] = useState<ThemeConfig>(() => getTheme(defaultThemeId));
  const [darkMode, setDarkModeState] = useState<DarkMode>('light');

  const isDark =
    darkMode === 'dark' || (darkMode === 'system' && systemPrefersDark());

  // Apply / remove 'dark' class on <html> whenever isDark changes
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Apply brand CSS variables whenever theme changes
  useEffect(() => {
    const newTheme = getTheme(themeId);
    setTheme(newTheme);
    const root = document.documentElement;

    Object.entries(newTheme.colors.primary).forEach(([key, value]) => {
      root.style.setProperty(`--color-primary-${key}`, value);
    });
    Object.entries(newTheme.colors.secondary).forEach(([key, value]) => {
      root.style.setProperty(`--color-secondary-${key}`, value);
    });
    Object.entries(newTheme.colors.accent).forEach(([key, value]) => {
      root.style.setProperty(`--color-accent-${key}`, value);
    });

    localStorage.setItem('realflow-theme', themeId);
  }, [themeId]);

  // Load persisted preferences on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem('realflow-theme');
    if (storedTheme && storedTheme !== themeId) {
      setThemeId(storedTheme as ClientThemeId);
    }

    const storedDark = localStorage.getItem('realflow-dark') as DarkMode | null;
    if (storedDark && ['light', 'dark', 'system'].includes(storedDark)) {
      setDarkModeState(storedDark);
    }

    // Re-render when system preference changes (only relevant in 'system' mode)
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      setDarkModeState((prev) => prev); // trigger isDark recomputation
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setDarkMode = (mode: DarkMode) => {
    setDarkModeState(mode);
    localStorage.setItem('realflow-dark', mode);
  };

  const toggleDark = () => {
    const next = isDark ? 'light' : 'dark';
    setDarkMode(next);
  };

  return (
    <ThemeContext.Provider
      value={{ theme, themeId, setThemeId, darkMode, isDark, setDarkMode, toggleDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
