# Client Themes Guide

RealFlow supports client-specific theming to personalize the interface based on client branding. This guide explains how to use and extend the theme system.

## Overview

The theme system allows RealFlow to dynamically switch between different color palettes and branding based on the client. This is particularly useful for white-labeling or creating customized experiences for different real estate agencies.

## Current Themes

### 1. Default Theme
- **ID:** `default`
- **Description:** The standard RealFlow brand theme
- **Primary Color:** Modern blue (#3b82f6)
- **Use Case:** Default for all non-branded clients

### 2. ePlace Theme
- **ID:** `eplace`
- **Description:** Professional navy blue theme for Place Estate Agents (Brisbane)
- **Primary Color:** Navy blue (#1a1f5e)
- **Secondary Color:** Coastal teal (#14b8a6)
- **Accent Color:** Warm coral (#f97316)
- **Brand Research:** Based on ePlace's 2020 rebrand featuring navy blue and contemporary design
- **Source:** https://www.eplace.com.au/

## Using Themes

### In React Components

```tsx
'use client';

import { useTheme } from '@/lib/theme-context';

export function MyComponent() {
  const { theme, themeId, setThemeId } = useTheme();

  return (
    <div>
      <p>Current theme: {theme.name}</p>
      <button onClick={() => setThemeId('eplace')}>
        Switch to ePlace theme
      </button>
    </div>
  );
}
```

### With Tailwind CSS

The theme system uses CSS variables that Tailwind automatically picks up:

```tsx
<button className="bg-primary-500 text-white hover:bg-primary-600">
  Primary Button
</button>

<div className="border-secondary-300 text-secondary-700">
  Secondary styled content
</div>

<span className="text-accent-600">
  Accent text
</span>
```

### Theme Switcher Component

Use the built-in `ThemeSwitcher` component in settings:

```tsx
import { ThemeSwitcher } from '@/components/theme-switcher';

export function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <ThemeSwitcher />
    </div>
  );
}
```

## Creating a New Client Theme

### Step 1: Create Theme File

Create a new file in `packages/shared/src/themes/` (e.g., `my-client.ts`):

```typescript
import type { ThemeConfig } from '../types/theme';

export const myClientTheme: ThemeConfig = {
  id: 'my-client',
  name: 'My Client Name',
  description: 'Brief description of the theme',
  colors: {
    primary: {
      50: '#...',
      100: '#...',
      // ... complete color scale
      900: '#...',
      950: '#...',
    },
    secondary: { /* ... */ },
    accent: { /* ... */ },
    neutral: { /* ... */ },
    success: { /* ... */ },
    warning: { /* ... */ },
    error: { /* ... */ },
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
    },
    headingWeight: 700,
    bodyWeight: 400,
  },
  branding: {
    logo: '/themes/my-client/logo.svg',
    logoLight: '/themes/my-client/logo-light.svg',
    logoDark: '/themes/my-client/logo-dark.svg',
  },
};
```

### Step 2: Register Theme

Add your theme to `packages/shared/src/themes/index.ts`:

```typescript
import { myClientTheme } from './my-client';

export const themes: Record<ClientThemeId, ThemeConfig> = {
  default: defaultTheme,
  eplace: ePlaceTheme,
  'my-client': myClientTheme, // Add your theme here
};

export { myClientTheme };
```

### Step 3: Update Type (Optional)

If using TypeScript strictly, update the `ClientThemeId` type in `packages/shared/src/types/theme.ts`:

```typescript
export type ClientThemeId = 'default' | 'eplace' | 'my-client';
```

## Color Palette Generation

### Tools & Resources

1. **Color Scale Generators:**
   - [Tailwind Color Palette Generator](https://uicolors.app/create)
   - [Coolors](https://coolors.co/)
   - [Adobe Color](https://color.adobe.com/)

2. **From Brand Color:**
   - Input your client's brand color (e.g., #1a1f5e for ePlace navy)
   - Generate a complete scale from 50 (lightest) to 950 (darkest)
   - Ensure sufficient contrast for accessibility (WCAG AA minimum)

3. **Color Roles:**
   - **Primary:** Main brand color (buttons, links, key UI)
   - **Secondary:** Supporting color (secondary actions, borders)
   - **Accent:** Call-to-action, highlights, notifications
   - **Neutral:** Text, backgrounds, subtle UI elements
   - **Success/Warning/Error:** Semantic colors (status messages, validation)

## Research Workflow

When creating a theme for a real-world client:

1. **Website Analysis:**
   - Visit the client's website
   - Extract brand colors using browser DevTools
   - Note typography choices (fonts, weights)
   - Capture design aesthetic (modern, traditional, luxurious, etc.)

2. **Brand Guidelines:**
   - Request official brand guidelines if available
   - Document primary, secondary, and accent colors
   - Note any color usage rules

3. **Competitive Analysis:**
   - Review similar agencies in the market
   - Ensure theme stands out while remaining professional
   - Consider industry color psychology

4. **Implementation:**
   - Create complete color scales for each brand color
   - Test contrast ratios for accessibility
   - Validate on real UI components
   - Get client approval before production use

## Testing Themes

### Manual Testing

1. Switch to the new theme using `ThemeSwitcher`
2. Navigate through all major pages
3. Check all component states (hover, active, disabled)
4. Test in light and dark environments
5. Verify text contrast and readability

### Automated Testing

```bash
npm run lint   # Check for color accessibility issues
npm run build  # Ensure theme doesn't break build
```

## Best Practices

1. **Color Accessibility:**
   - Ensure text has 4.5:1 contrast ratio minimum (WCAG AA)
   - Large text (18pt+) can use 3:1 ratio
   - Test with tools like [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

2. **Consistency:**
   - Use the full color scale (50-950)
   - Maintain similar lightness levels across themes
   - Keep neutral colors consistent unless brand-specific

3. **Performance:**
   - Themes load instantly using CSS variables
   - No runtime overhead for color switching
   - LocalStorage persists theme choice

4. **Branding Assets:**
   - Store logos in `public/themes/[client-id]/`
   - Provide light and dark variants
   - Use SVG format for scalability

## Client Theme Mapping

For production, map clients to themes in your database or config:

```typescript
const clientThemeMap: ClientThemeMapping[] = [
  { clientId: 'org_abc123', themeId: 'eplace' },
  { clientId: 'org_def456', themeId: 'default' },
];
```

Load theme based on authenticated user's organization:

```tsx
function AppWrapper() {
  const { user } = useAuth();
  const themeId = user?.organization?.themeId || 'default';

  return (
    <ThemeProvider defaultThemeId={themeId}>
      <App />
    </ThemeProvider>
  );
}
```

## Troubleshooting

**Theme not applying:**
- Check browser console for errors
- Verify CSS variables are set in DevTools
- Clear localStorage and refresh

**Colors look wrong:**
- Ensure Tailwind classes use `primary-*`, `secondary-*`, `accent-*`
- Check for hardcoded color values (avoid hex codes in components)
- Rebuild Tailwind CSS

**Theme not persisting:**
- Check localStorage for `realflow-theme` key
- Ensure ThemeProvider is mounted
- Verify no conflicting theme logic

## Future Enhancements

- [ ] Dark mode support per theme
- [ ] Typography customization (font families)
- [ ] Custom CSS injection per theme
- [ ] Theme preview in admin panel
- [ ] Automated color contrast validation
- [ ] Theme export/import for easy sharing

## Support

For questions or issues with theming:
- Check this documentation
- Review existing theme files as examples
- Contact the RealFlow development team
