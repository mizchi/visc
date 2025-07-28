import { Page } from '@playwright/test';
import { Driver, ViewportOptions, ScreenshotOptions } from './types.js';

export interface PlaywrightDriverOptions {
  page: Page;
  viewport: ViewportOptions;
}

export function createPlaywrightDriver(options: PlaywrightDriverOptions): Driver {
  const { page, viewport } = options;

  return {
    async goto(url: string): Promise<void> {
      await page.goto(url, { waitUntil: 'networkidle' });
    },

    async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
      return await page.screenshot(options);
    },

    async evaluate<T>(fn: () => T): Promise<T> {
      return await page.evaluate(fn);
    },

    async close(): Promise<void> {
      await page.close();
    },

    getViewport(): ViewportOptions {
      return viewport;
    }
  };
}