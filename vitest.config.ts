import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [
    // Type mismatch between vitest's bundled vite types and project vite types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required type assertion for plugin compatibility
    react() as any
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  setupFiles: [path.resolve(__dirname, './src/test/setup.ts')],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
