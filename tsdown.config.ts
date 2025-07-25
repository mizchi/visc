import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'cli': './src/cli.ts',
    'layout/extractor': './src/layout/extractor.ts',
    'layout/semantic-analyzer': './src/layout/semantic-analyzer.ts',
    'layout/comparator': './src/layout/comparator.ts',
    'layout/assertions': './src/layout/assertions.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  dts: {
    resolve: true,
    entry: {
      'index': './src/index.ts',
      'layout/extractor': './src/layout/extractor.ts',
      'layout/semantic-analyzer': './src/layout/semantic-analyzer.ts',
      'layout/comparator': './src/layout/comparator.ts',
      'layout/assertions': './src/layout/assertions.ts',
    }
  },
  sourcemap: true,
  external: [
    '@playwright/test',
    'commander',
    'pixelmatch',
    'pngjs',
    'chalk',
    'ora',
    'lighthouse',
    'fs',
    'fs/promises',
    'path',
    'url',
    'child_process'
  ],
  shims: false,
  unbundle: true,
  splitting: false,
  outDir: './dist'
});