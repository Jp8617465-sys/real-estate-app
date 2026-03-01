'use client';

import { useTheme } from '@/lib/theme-context';
import { getAllThemes } from '@realflow/shared';

export function ThemeSwitcher() {
  const { themeId, setThemeId } = useTheme();
  const themes = getAllThemes();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">Client Theme</h3>
      <p className="mb-4 text-xs text-gray-600">
        Select a client theme to personalize the interface
      </p>
      <div className="space-y-2">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setThemeId(theme.id)}
            className={`w-full rounded-md border px-4 py-3 text-left transition-all ${
              themeId === theme.id
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500 ring-offset-1'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{theme.name}</div>
                <div className="mt-1 text-xs text-gray-500">{theme.description}</div>
              </div>
              <div className="ml-4 flex gap-1">
                <div
                  className="h-6 w-6 rounded border border-gray-200"
                  style={{ backgroundColor: theme.colors.primary[500] }}
                  title="Primary"
                />
                <div
                  className="h-6 w-6 rounded border border-gray-200"
                  style={{ backgroundColor: theme.colors.secondary[500] }}
                  title="Secondary"
                />
                <div
                  className="h-6 w-6 rounded border border-gray-200"
                  style={{ backgroundColor: theme.colors.accent[500] }}
                  title="Accent"
                />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
