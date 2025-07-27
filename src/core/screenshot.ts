/**
 * Core screenshot functionality
 * 最も基本的なスクリーンショット機能
 */

import { chromium } from '@playwright/test';
import type { ScreenshotOptions, ScreenshotResult } from './types.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * 指定されたURLのスクリーンショットを撮影
 * 
 * @example
 * ```typescript
 * // 最も簡単な使い方
 * const result = await captureScreenshot('https://example.com');
 * console.log(`Screenshot saved to: ${result.path}`);
 * 
 * // オプション付き
 * const result = await captureScreenshot('https://example.com', {
 *   outputPath: './screenshots/example.png',
 *   viewport: { width: 1280, height: 720 }
 * });
 * ```
 */
export async function captureScreenshot(
  url: string,
  options: Partial<ScreenshotOptions> = {}
): Promise<ScreenshotResult> {
  // URLが文字列の場合はオプションに含める
  const fullOptions: ScreenshotOptions = {
    url,
    fullPage: true,
    viewport: { width: 1280, height: 720 },
    ...options
  };
  
  // 出力パスの決定
  const outputPath = fullOptions.outputPath || 
    path.join(process.cwd(), 'screenshots', `screenshot-${Date.now()}.png`);
  
  // ディレクトリの作成
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });
  
  // ブラウザの起動
  const browser = await chromium.launch({ headless: true });
  
  try {
    const context = await browser.newContext({
      viewport: fullOptions.viewport
    });
    
    const page = await context.newPage();
    await page.goto(fullOptions.url, { waitUntil: 'networkidle' });
    
    // スクリーンショットの撮影
    await page.screenshot({
      path: outputPath,
      fullPage: fullOptions.fullPage
    });
    
    return {
      url: fullOptions.url,
      path: outputPath,
      timestamp: new Date(),
      viewport: fullOptions.viewport!
    };
  } finally {
    await browser.close();
  }
}

/**
 * 複数のURLのスクリーンショットを並列で撮影
 * 
 * @example
 * ```typescript
 * const results = await captureMultipleScreenshots([
 *   'https://example.com',
 *   'https://google.com',
 *   'https://github.com'
 * ]);
 * ```
 */
export async function captureMultipleScreenshots(
  urls: string[],
  options: Partial<ScreenshotOptions> = {}
): Promise<ScreenshotResult[]> {
  return Promise.all(
    urls.map(url => captureScreenshot(url, options))
  );
}