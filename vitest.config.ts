import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    exclude: [
      'tests/layout/integration.test.ts', 
      'tests/proxy/**/*.test.ts',  // プロキシ関連のテストを除外
      'tests/runner/**/*.test.ts',  // ブラウザ統合テストを除外
      'node_modules/**'
    ],
  }
});