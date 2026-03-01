import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dynamic theme colors using CSS variables
        primary: {
          50: 'var(--color-primary-50, #eff6ff)',
          100: 'var(--color-primary-100, #dbeafe)',
          200: 'var(--color-primary-200, #bfdbfe)',
          300: 'var(--color-primary-300, #93c5fd)',
          400: 'var(--color-primary-400, #60a5fa)',
          500: 'var(--color-primary-500, #3b82f6)',
          600: 'var(--color-primary-600, #2563eb)',
          700: 'var(--color-primary-700, #1d4ed8)',
          800: 'var(--color-primary-800, #1e40af)',
          900: 'var(--color-primary-900, #1e3a8a)',
          950: 'var(--color-primary-950, #172554)',
        },
        secondary: {
          50: 'var(--color-secondary-50, #f0f9ff)',
          100: 'var(--color-secondary-100, #e0f2fe)',
          200: 'var(--color-secondary-200, #bae6fd)',
          300: 'var(--color-secondary-300, #7dd3fc)',
          400: 'var(--color-secondary-400, #38bdf8)',
          500: 'var(--color-secondary-500, #0ea5e9)',
          600: 'var(--color-secondary-600, #0284c7)',
          700: 'var(--color-secondary-700, #0369a1)',
          800: 'var(--color-secondary-800, #075985)',
          900: 'var(--color-secondary-900, #0c4a6e)',
          950: 'var(--color-secondary-950, #082f49)',
        },
        accent: {
          50: 'var(--color-accent-50, #fef2f2)',
          100: 'var(--color-accent-100, #fee2e2)',
          200: 'var(--color-accent-200, #fecaca)',
          300: 'var(--color-accent-300, #fca5a5)',
          400: 'var(--color-accent-400, #f87171)',
          500: 'var(--color-accent-500, #ef4444)',
          600: 'var(--color-accent-600, #dc2626)',
          700: 'var(--color-accent-700, #b91c1c)',
          800: 'var(--color-accent-800, #991b1b)',
          900: 'var(--color-accent-900, #7f1d1d)',
          950: 'var(--color-accent-950, #450a0a)',
        },
        // Legacy brand alias (points to primary)
        brand: {
          50: 'var(--color-primary-50, #eff6ff)',
          100: 'var(--color-primary-100, #dbeafe)',
          200: 'var(--color-primary-200, #bfdbfe)',
          300: 'var(--color-primary-300, #93c5fd)',
          400: 'var(--color-primary-400, #60a5fa)',
          500: 'var(--color-primary-500, #3b82f6)',
          600: 'var(--color-primary-600, #2563eb)',
          700: 'var(--color-primary-700, #1d4ed8)',
          800: 'var(--color-primary-800, #1e40af)',
          900: 'var(--color-primary-900, #1e3a8a)',
          950: 'var(--color-primary-950, #172554)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
