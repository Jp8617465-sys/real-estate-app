import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    server: {
      deps: {
        inline: ['@testing-library/react', '@testing-library/jest-dom'],
      },
    },
  },
  resolve: {
    alias: {
      'react': path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      '@': path.resolve(__dirname, './src'),
      '@realflow/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@realflow/business-logic': path.resolve(__dirname, '../../packages/business-logic/src'),
      '@realflow/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
