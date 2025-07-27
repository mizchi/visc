/**
 * Browser Controller
 * ブラウザの制御を行う基本クラス
 */

import { chromium, firefox, webkit, Browser, Page, BrowserContext, devices } from '@playwright/test';
import type { BrowserConfig, PageOptions } from './types.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * ブラウザを制御するクラス
 * 
 * @example
 * ```typescript
 * // 基本的な使い方
 * const browser = new BrowserController({ headless: true });
 * await browser.launch();
 * 
 * const screenshot = await browser.captureScreenshot({
 *   url: 'https://example.com',
 *   name: 'home',
 *   waitFor: { networkIdle: true }
 * });
 * 
 * await browser.close();
 * ```
 * 
 * @example
 * ```typescript
 * // デバイスエミュレーション
 * const browser = new BrowserController({ 
 *   device: 'iPhone 12',
 *   headless: false 
 * });
 * ```
 */
export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: BrowserConfig;
  
  constructor(config: BrowserConfig = {}) {
    this.config = {
      browser: 'chromium',
      headless: true,
      timeout: 30000,
      ...config
    };
  }
  
  /**
   * ブラウザを起動
   */
  async launch(): Promise<void> {
    const browserType = this.config.browser || 'chromium';
    const headless = this.config.headless ?? true;
    
    // ブラウザの選択
    switch (browserType) {
      case 'firefox':
        this.browser = await firefox.launch({ headless });
        break;
      case 'webkit':
        this.browser = await webkit.launch({ headless });
        break;
      default:
        this.browser = await chromium.launch({ headless });
    }
    
    // コンテキストの作成
    const contextOptions: any = {};
    
    if (this.config.viewport) {
      contextOptions.viewport = this.config.viewport;
    }
    
    if (this.config.device) {
      const device = devices[this.config.device];
      if (device) {
        Object.assign(contextOptions, device);
      }
    }
    
    this.context = await this.browser.newContext(contextOptions);
  }
  
  /**
   * スクリーンショットを撮影
   */
  async captureScreenshot(options: PageOptions): Promise<string> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    
    const page = await this.context.newPage();
    
    try {
      // ページに移動
      await page.goto(options.url, {
        waitUntil: options.waitFor?.networkIdle ? 'networkidle' : 'load',
        timeout: options.waitFor?.timeout || this.config.timeout
      });
      
      // セレクタ待機
      if (options.waitFor?.selector) {
        await page.waitForSelector(options.waitFor.selector, {
          timeout: options.waitFor?.timeout || this.config.timeout
        });
      }
      
      // スクリーンショット前の処理
      await this.executeBeforeScreenshot(page, options);
      
      // スクリーンショットのパスを決定
      const name = options.name || `screenshot-${Date.now()}`;
      const screenshotPath = path.join(process.cwd(), 'snapshots', `${name}.png`);
      
      // ディレクトリの作成
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      
      // スクリーンショットオプション
      const screenshotOptions: any = {
        path: screenshotPath,
        type: 'png',
        fullPage: options.screenshot?.fullPage ?? true
      };
      
      if (options.screenshot?.clip) {
        screenshotOptions.clip = options.screenshot.clip;
      }
      
      // スクリーンショットの撮影
      if (options.screenshot?.selector) {
        const element = await page.locator(options.screenshot.selector);
        await element.screenshot(screenshotOptions);
      } else {
        await page.screenshot(screenshotOptions);
      }
      
      return screenshotPath;
    } finally {
      await page.close();
    }
  }
  
  /**
   * 複数のページのスクリーンショットを撮影
   */
  async captureMultipleScreenshots(pages: PageOptions[]): Promise<string[]> {
    const results: string[] = [];
    
    for (const pageOptions of pages) {
      const path = await this.captureScreenshot(pageOptions);
      results.push(path);
    }
    
    return results;
  }
  
  /**
   * ページオブジェクトを取得（高度な操作用）
   */
  async getPage(url: string): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    
    const page = await this.context.newPage();
    await page.goto(url);
    return page;
  }
  
  /**
   * スクリーンショット前の処理を実行
   */
  private async executeBeforeScreenshot(page: Page, options: PageOptions): Promise<void> {
    const beforeScreenshot = options.beforeScreenshot;
    if (!beforeScreenshot) return;
    
    // JavaScriptを実行
    if (beforeScreenshot.script) {
      await page.evaluate(beforeScreenshot.script);
    }
    
    // 要素をクリック
    if (beforeScreenshot.click) {
      for (const selector of beforeScreenshot.click) {
        await page.click(selector);
      }
    }
    
    // 要素を非表示
    if (beforeScreenshot.hide) {
      for (const selector of beforeScreenshot.hide) {
        await page.locator(selector).evaluate(el => {
          (el as HTMLElement).style.display = 'none';
        });
      }
    }
    
    // スクロール
    if (beforeScreenshot.scrollTo) {
      await page.evaluate(({ x, y }) => {
        window.scrollTo(x, y);
      }, beforeScreenshot.scrollTo);
    }
  }
  
  /**
   * ブラウザを閉じる
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  
  /**
   * ブラウザが起動しているか
   */
  isLaunched(): boolean {
    return this.browser !== null && this.context !== null;
  }
}