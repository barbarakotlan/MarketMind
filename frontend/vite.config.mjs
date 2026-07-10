import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: './src/setupTests.js',
    css: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/index.jsx',
        'src/setupTests.js',
      ],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 65,
        branches: 55,
        functions: 60,
        lines: 68,
      },
    },
  },
});
