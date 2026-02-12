'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ThemeConfig, ClientThemeId } from '@realflow/shared';
import { getTheme } from '@realflow/shared';

interface ThemeContextType {
  theme: ThemeConfig;
  themeId: ClientThemeId;
  setThemeId: (id: ClientThemeId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeId?: ClientThemeId;
}

export function ThemeProvider({ children, defaultThemeId = 'default' }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ClientThemeId>(defaultThemeId);
  const [theme, setTheme] = useState<ThemeConfig>(() => getTheme(defaultThemeId));

  useEffect(() => {
    const newTheme = getTheme(themeId);
    setTheme(newTheme);

    // Apply theme CSS variables to document root
    const root = document.documentElement;

    // Set primary colors as CSS variables
    Object.entries(newTheme.colors.primary).forEach(([key, value]) => {
      root.style.setProperty(`--color-primary-${key}`, value);
    });

    // Set secondary colors
    Object.entries(newTheme.colors.secondary).forEach(([key, value]) => {
      root.style.setProperty(`--color-secondary-${key}`, value);
    });

    // Set accent colors
    Object.entries(newTheme.colors.accent).forEach(([key, value]) => {
      root.style.setProperty(`--color-accent-${key}`, value);
    });

    // Store theme ID in localStorage for persistence
    localStorage.setItem('realflow-theme', themeId);
  }, [themeId]);

  // Load theme from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('realflow-theme');
    if (stored && stored !== themeId) {
      setThemeId(stored as ClientThemeId);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, themeId, setThemeId }}>
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
