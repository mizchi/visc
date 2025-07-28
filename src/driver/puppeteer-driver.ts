import type { Page as PuppeteerPage, Browser as PuppeteerBrowser, CoverageEntry } from 'puppeteer';
import { Driver, ViewportOptions, ScreenshotOptions } from './types.js';

export interface PuppeteerDriverOptions {
  page: PuppeteerPage;
  browser?: PuppeteerBrowser;
  viewport: ViewportOptions;
}

export interface CoverageReport {
  js: {
    usedBytes: number;
    totalBytes: number;
    percentage: number;
    entries: CoverageEntry[];
  };
  css: {
    usedBytes: number;
    totalBytes: number;
    percentage: number;
    entries: CoverageEntry[];
  };
}

export interface PuppeteerDriver extends Driver {
  startCoverage(): Promise<void>;
  stopCoverage(): Promise<CoverageReport>;
  setViewport(viewport: ViewportOptions): Promise<void>;
  getCoverageReport(): Promise<CoverageReport>;
}

export function createPuppeteerDriver(options: PuppeteerDriverOptions): PuppeteerDriver {
  const { page, browser, viewport: initialViewport } = options;
  let currentViewport = initialViewport;

  return {
    async goto(url: string): Promise<void> {
      await page.goto(url, { waitUntil: 'networkidle0' });
    },

    async screenshot(options?: ScreenshotOptions): Promise<Buffer> {
      const screenshotOptions: any = {
        fullPage: options?.fullPage ?? true
      };
      
      if (options?.path) {
        screenshotOptions.path = options.path;
      }

      return await page.screenshot(screenshotOptions);
    },

    async evaluate<T>(fn: () => T): Promise<T> {
      return await page.evaluate(fn);
    },

    async close(): Promise<void> {
      await page.close();
    },

    getViewport(): ViewportOptions {
      return currentViewport;
    },

    async setViewport(viewport: ViewportOptions): Promise<void> {
      await page.setViewport({
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1
      });
      currentViewport = viewport;
    },

    async startCoverage(): Promise<void> {
      await page.coverage.startJSCoverage();
      await page.coverage.startCSSCoverage();
    },

    async stopCoverage(): Promise<CoverageReport> {
      const [jsCoverage, cssCoverage] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage()
      ]);

      return {
        js: calculateCoverageStats(jsCoverage || []),
        css: calculateCoverageStats(cssCoverage || [])
      };
    },

    async getCoverageReport(): Promise<CoverageReport> {
      // 一時的に停止して現在のカバレッジを取得
      const [jsCoverage, cssCoverage] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage()
      ]);

      // カバレッジを再開
      await page.coverage.startJSCoverage();
      await page.coverage.startCSSCoverage();

      return {
        js: calculateCoverageStats(jsCoverage || []),
        css: calculateCoverageStats(cssCoverage || [])
      };
    }
  };
}

function calculateCoverageStats(entries: CoverageEntry[]): {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
  entries: CoverageEntry[];
} {
  if (!entries || entries.length === 0) {
    return {
      usedBytes: 0,
      totalBytes: 0,
      percentage: 100, // エントリーがない場合は100%とする（何もロードされていない）
      entries: []
    };
  }

  let usedBytes = 0;
  let totalBytes = 0;

  for (const entry of entries) {
    totalBytes += entry.text.length;
    
    // 使用されている範囲を計算
    const ranges = entry.ranges;
    for (const range of ranges) {
      usedBytes += range.end - range.start;
    }
  }

  const percentage = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

  return {
    usedBytes,
    totalBytes,
    percentage: Math.round(percentage * 100) / 100,
    entries
  };
}