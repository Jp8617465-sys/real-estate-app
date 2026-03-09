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
        external: ['react-native', /react-native\//],
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@realflow/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@realflow/business-logic': path.resolve(__dirname, '../../packages/business-logic/src'),
      'react-native': path.resolve(__dirname, './src/__mocks__/react-native.ts'),
    },
  },
});
