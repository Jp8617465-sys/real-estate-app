import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@realflow/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@realflow/business-logic': path.resolve(__dirname, '../../packages/business-logic/src'),
      '@realflow/integrations': path.resolve(__dirname, '../../packages/integrations/src'),
    },
  },
});
