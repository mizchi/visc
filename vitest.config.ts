import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/layout/integration.test.ts', 'node_modules/**'], // Playwrightテストは除外
  }
});