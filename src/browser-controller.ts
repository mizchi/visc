import { chromium, firefox, webkit, Browser, Page, BrowserContext } from '@playwright/test';
import { UrlConfig, VisualCheckConfig } from './types.js';
import path from 'path';
import fs from 'fs/promises';

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(private config: VisualCheckConfig) {}

  /**
   * ブラウザを起動
   */
  async launch(): Promise<void> {
    const browserType = this.config.playwright?.browser ?? 'chromium';
    const headless = this.config.playwright?.headless ?? true;

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

    const contextOptions: any = {};
    
    if (this.config.playwright?.viewport) {
      contextOptions.viewport = this.config.playwright.viewport;
    }
    
    if (this.config.playwright?.device) {
      // デバイスプリセットを使用（例: 'iPhone 12'）
      const devices = {
        'iPhone 12': chromium.devices['iPhone 12'],
        'iPad': chromium.devices['iPad'],
        'Pixel 5': chromium.devices['Pixel 5'],
      };
      const device = devices[this.config.playwright.device as keyof typeof devices];
      if (device) {
        Object.assign(contextOptions, device);
      }
    }

    this.context = await this.browser.newContext(contextOptions);
  }

  /**
   * スクリーンショットを撮影
   */
  async captureScreenshot(urlConfig: UrlConfig): Promise<string> {
    if (!this.context) {
      throw new Error('Browser not launched');
    }

    const page = await this.context.newPage();
    
    try {
      // URLに移動
      const fullUrl = this.buildFullUrl(urlConfig.url);
      await page.goto(fullUrl, {
        waitUntil: urlConfig.waitFor?.networkIdle ? 'networkidle' : 'load',
        timeout: urlConfig.waitFor?.timeout ?? 30000,
      });

      // セレクタ待機
      if (urlConfig.waitFor?.selector) {
        await page.waitForSelector(urlConfig.waitFor.selector, {
          timeout: urlConfig.waitFor?.timeout ?? 30000,
        });
      }

      // 追加の待機時間
      if (urlConfig.waitFor?.timeout) {
        await page.waitForTimeout(urlConfig.waitFor.timeout);
      }

      // スクリーンショット前の処理
      await this.executeBeforeScreenshot(page, urlConfig);

      // スナップショットディレクトリを作成
      const snapshotDir = this.config.snapshotDir ?? './snapshots';
      await fs.mkdir(snapshotDir, { recursive: true });

      // スクリーンショットを撮影
      const screenshotPath = path.join(snapshotDir, `${urlConfig.name}-current.png`);
      const screenshotOptions: any = {
        path: screenshotPath,
        type: 'png',
      };

      if (urlConfig.screenshot?.fullPage !== undefined) {
        screenshotOptions.fullPage = urlConfig.screenshot.fullPage;
      }

      if (urlConfig.screenshot?.clip) {
        screenshotOptions.clip = urlConfig.screenshot.clip;
      }

      if (urlConfig.screenshot?.selector) {
        const element = await page.locator(urlConfig.screenshot.selector);
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
   * スクリーンショット前の処理を実行
   */
  private async executeBeforeScreenshot(page: Page, urlConfig: UrlConfig): Promise<void> {
    const beforeScreenshot = urlConfig.beforeScreenshot;
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
   * 完全なURLを構築
   */
  private buildFullUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const baseUrl = this.config.baseUrl ?? 'http://localhost:3000';
    return new URL(url, baseUrl).toString();
  }

  /**
   * ブラウザを閉じる
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
  }
}