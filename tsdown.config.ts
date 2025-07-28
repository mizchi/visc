import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    'index': './src/index.ts',
    'cli': './src/cli.ts',
    // Core API
    'core/index': './src/core/index.ts',
    'core/screenshot': './src/core/screenshot.ts',
    'core/compare': './src/core/compare.ts',
    'core/types': './src/core/types.ts',
    // Basic API
    'basic/index': './src/basic/index.ts',
    'basic/browser/index': './src/basic/browser/index.ts',
    'basic/browser/controller': './src/basic/browser/controller.ts',
    'basic/browser/types': './src/basic/browser/types.ts',
    'basic/snapshot/index': './src/basic/snapshot/index.ts',
    'basic/snapshot/manager': './src/basic/snapshot/manager.ts',
    'basic/snapshot/comparator': './src/basic/snapshot/comparator.ts',
    'basic/config/index': './src/basic/config/index.ts',
    'basic/config/loader': './src/basic/config/loader.ts',
    'basic/config/validator': './src/basic/config/validator.ts',
    'basic/config/types': './src/basic/config/types.ts',
    // Legacy exports
    'layout/extractor': './src/layout/extractor.ts',
    'layout/semantic-analyzer': './src/layout/semantic-analyzer.ts',
    'layout/comparator': './src/layout/comparator.ts',
    'layout/assertions': './src/layout/assertions.ts',
    // Assertion API
    'assertion/index': './src/assertion/index.ts',
    'assertion/visual': './src/assertion/visual.ts',
    'assertion/semantic-svg': './src/assertion/semantic-svg.ts',
    // Driver API
    'driver/index': './src/driver/index.ts',
    'driver/types': './src/driver/types.ts',
    'driver/playwright-driver': './src/driver/playwright-driver.ts',
    // Layout API
    'layout/semantic-layout': './src/layout/semantic-layout.ts',
    // I/O API
    'io/index': './src/io/index.ts',
    'io/file': './src/io/file.ts',
    'io/image': './src/io/image.ts',
    'io/browser': './src/io/browser.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node18',
  clean: true,
  dts: {
    resolve: true,
    entry: {
      'index': './src/index.ts',
      // Core API
      'core/index': './src/core/index.ts',
      // Basic API
      'basic/index': './src/basic/index.ts',
      'basic/browser/index': './src/basic/browser/index.ts',
      'basic/snapshot/index': './src/basic/snapshot/index.ts',
      'basic/config/index': './src/basic/config/index.ts',
      // Legacy exports
      'layout/extractor': './src/layout/extractor.ts',
      'layout/semantic-analyzer': './src/layout/semantic-analyzer.ts',
      'layout/comparator': './src/layout/comparator.ts',
      'layout/assertions': './src/layout/assertions.ts',
      // Assertion API
      'assertion/index': './src/assertion/index.ts',
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
  shims: true,
  unbundle: true,
  splitting: false,
  outDir: './dist'
});