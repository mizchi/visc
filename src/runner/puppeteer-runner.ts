/**
 * Puppeteer用のブラウザランナー実装
 */

import puppeteer, { type Browser, type Page, type Protocol, type PuppeteerLifeCycleEvent } from "puppeteer";
import { BaseBrowserRunner } from "./base-runner.js";
import type {
  BrowserContext,
  PageContext,
  ViewportSize,
  ScreenshotOptions,
  WaitOptions,
  NetworkConditions,
  CookieOptions,
  EvaluateOptions
} from "./types.js";

export class PuppeteerRunner extends BaseBrowserRunner {
  readonly type = 'puppeteer' as const;
  private browsers: Map<string, Browser> = new Map();

  async launch(options?: {
    headless?: boolean;
    devtools?: boolean;
    args?: string[];
    executablePath?: string;
    timeout?: number;
  }): Promise<BrowserContext> {
    const browser = await puppeteer.launch({
      headless: options?.headless ?? true,
      devtools: options?.devtools,
      args: options?.args,
      executablePath: options?.executablePath,
      timeout: options?.timeout,
    });

    const id = this.generateId();
    this.browsers.set(id, browser);
    this.contexts.set(id, browser);

    return { id, type: this.type };
  }

  async close(context: BrowserContext): Promise<void> {
    const browser = this.browsers.get(context.id);
    if (browser) {
      await browser.close();
      this.browsers.delete(context.id);
    }
    this.contexts.delete(context.id);
  }

  async newPage(context: BrowserContext, options?: {
    viewport?: ViewportSize;
    userAgent?: string;
    locale?: string;
    timezoneId?: string;
    geolocation?: { latitude: number; longitude: number; accuracy?: number };
    permissions?: string[];
  }): Promise<PageContext> {
    const browser = this.getContext(context) as Browser;
    const page = await browser.newPage();

    // ビューポート設定
    if (options?.viewport) {
      await page.setViewport(options.viewport);
    }

    // ユーザーエージェント設定
    if (options?.userAgent) {
      await page.setUserAgent(options.userAgent);
    }

    // ロケール設定
    if (options?.locale) {
      await page.setExtraHTTPHeaders({
        'Accept-Language': options.locale,
      });
    }

    // タイムゾーン設定
    if (options?.timezoneId) {
      await page.evaluateOnNewDocument((timezoneId) => {
        // タイムゾーンをオーバーライド
        const originalDate = Date;
        // @ts-ignore
        Date = new Proxy(originalDate, {
          construct(target: any, args: any[]) {
            const instance = new target(...args);
            // タイムゾーンの調整ロジックをここに実装
            return instance;
          },
        });
        // @ts-ignore
        Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
          construct(target: any, [locales, options]: any[]) {
            return new target(locales, { ...options, timeZone: timezoneId });
          },
        });
      }, options.timezoneId);
    }

    // ジオロケーション設定
    if (options?.geolocation) {
      // @ts-ignore - Puppeteerの型定義に含まれていない可能性
      const context = page.target().browserContext();
      await context.overridePermissions(page.url() || 'about:blank', ['geolocation']);
      await page.setGeolocation(options.geolocation);
    }

    // パーミッション設定
    if (options?.permissions) {
      // @ts-ignore
      const context = page.target().browserContext();
      await context.overridePermissions(page.url() || 'about:blank', options.permissions as any);
    }

    const pageId = this.generateId();
    this.pages.set(pageId, page);

    return { id: pageId, url: page.url() };
  }

  async closePage(page: PageContext): Promise<void> {
    const p = this.getPage(page) as Page;
    await p.close();
    this.pages.delete(page.id);
  }

  async goto(page: PageContext, url: string, options?: WaitOptions): Promise<void> {
    const p = this.getPage(page) as Page;
    
    let waitUntil: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[] = 'load';
    if (options?.waitUntil) {
      if (options.waitUntil === 'networkidle') {
        waitUntil = 'networkidle2';
      } else {
        waitUntil = options.waitUntil as PuppeteerLifeCycleEvent;
      }
    }

    await p.goto(url, {
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async screenshot(page: PageContext, options?: ScreenshotOptions): Promise<Buffer> {
    const p = this.getPage(page) as Page;
    
    const screenshotOptions: Parameters<Page['screenshot']>[0] = {
      fullPage: options?.fullPage,
      clip: options?.clip,
      quality: options?.quality,
      type: options?.type,
      omitBackground: options?.omitBackground,
    };

    const result = await p.screenshot(screenshotOptions);
    
    // Puppeteerは文字列またはBufferを返す可能性がある
    if (typeof result === 'string') {
      return Buffer.from(result, 'base64');
    }
    
    return result as Buffer;
  }

  async evaluate<T = any>(
    page: PageContext,
    script: string | (() => T),
    options?: EvaluateOptions
  ): Promise<T> {
    const p = this.getPage(page) as Page;
    
    // タイムアウト設定
    const originalTimeout = p.getDefaultTimeout();
    if (options?.timeout) {
      p.setDefaultTimeout(options.timeout);
    }

    try {
      if (typeof script === 'string') {
        // 文字列の場合はそのまま評価（後方互換性のため）
        return await p.evaluate((code: string) => eval(code) as T, script);
      }
      
      return await p.evaluate(script);
    } finally {
      // タイムアウトを元に戻す
      if (options?.timeout) {
        p.setDefaultTimeout(originalTimeout);
      }
    }
  }

  async waitForSelector(
    page: PageContext,
    selector: string,
    options?: {
      visible?: boolean;
      hidden?: boolean;
      timeout?: number;
    }
  ): Promise<void> {
    const p = this.getPage(page) as Page;
    
    await p.waitForSelector(selector, {
      visible: options?.visible,
      hidden: options?.hidden,
      timeout: options?.timeout,
    });
  }

  async click(page: PageContext, selector: string, options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
  }): Promise<void> {
    const p = this.getPage(page) as Page;
    
    await p.click(selector, {
      button: options?.button,
      clickCount: options?.clickCount,
      delay: options?.delay,
    });
  }

  async typeText(page: PageContext, selector: string, text: string, options?: {
    delay?: number;
  }): Promise<void> {
    const p = this.getPage(page) as Page;
    
    await p.type(selector, text, {
      delay: options?.delay,
    });
  }

  async setViewportSize(page: PageContext, size: ViewportSize): Promise<void> {
    const p = this.getPage(page) as Page;
    await p.setViewport(size);
  }

  async setUserAgent(page: PageContext, userAgent: string): Promise<void> {
    const p = this.getPage(page) as Page;
    await p.setUserAgent(userAgent);
  }

  async setCookies(page: PageContext, cookies: CookieOptions[]): Promise<void> {
    const p = this.getPage(page) as Page;
    
    const puppeteerCookies = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite as any,
    }));
    
    await p.setCookie(...puppeteerCookies);
  }

  async clearCookies(page: PageContext): Promise<void> {
    const p = this.getPage(page) as Page;
    const client = await p.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
  }

  async clearLocalStorage(page: PageContext): Promise<void> {
    const p = this.getPage(page) as Page;
    
    await p.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async setNetworkConditions(page: PageContext, conditions: NetworkConditions): Promise<void> {
    const p = this.getPage(page) as Page;
    const client = await p.target().createCDPSession();
    
    await client.send('Network.emulateNetworkConditions', {
      offline: conditions.offline ?? false,
      downloadThroughput: conditions.downloadThroughput ?? -1,
      uploadThroughput: conditions.uploadThroughput ?? -1,
      latency: conditions.latency ?? 0,
    });
  }

  async setExtraHTTPHeaders(page: PageContext, headers: Record<string, string>): Promise<void> {
    const p = this.getPage(page) as Page;
    await p.setExtraHTTPHeaders(headers);
  }

  async getCurrentUrl(page: PageContext): Promise<string> {
    const p = this.getPage(page) as Page;
    return p.url();
  }

  async getTitle(page: PageContext): Promise<string> {
    const p = this.getPage(page) as Page;
    return await p.title();
  }

  async reload(page: PageContext, options?: WaitOptions): Promise<void> {
    const p = this.getPage(page) as Page;
    
    let waitUntil: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[] = 'load';
    if (options?.waitUntil) {
      if (options.waitUntil === 'networkidle') {
        waitUntil = 'networkidle2';
      } else {
        waitUntil = options.waitUntil as PuppeteerLifeCycleEvent;
      }
    }

    await p.reload({
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async goBack(page: PageContext, options?: WaitOptions): Promise<void> {
    const p = this.getPage(page) as Page;
    
    let waitUntil: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[] = 'load';
    if (options?.waitUntil) {
      if (options.waitUntil === 'networkidle') {
        waitUntil = 'networkidle2';
      } else {
        waitUntil = options.waitUntil as PuppeteerLifeCycleEvent;
      }
    }

    await p.goBack({
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async goForward(page: PageContext, options?: WaitOptions): Promise<void> {
    const p = this.getPage(page) as Page;
    
    let waitUntil: PuppeteerLifeCycleEvent | PuppeteerLifeCycleEvent[] = 'load';
    if (options?.waitUntil) {
      if (options.waitUntil === 'networkidle') {
        waitUntil = 'networkidle2';
      } else {
        waitUntil = options.waitUntil as PuppeteerLifeCycleEvent;
      }
    }

    await p.goForward({
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async cleanup(): Promise<void> {
    // ブラウザを閉じる
    for (const [id, browser] of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        console.error(`Failed to close browser ${id}:`, error);
      }
    }
    this.browsers.clear();
    
    await super.cleanup();
  }
}