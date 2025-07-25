/**
 * Playwright用のブラウザランナー実装
 */

import { chromium, type Browser, type BrowserContext as PWContext, type Page } from "playwright";
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

export class PlaywrightRunner extends BaseBrowserRunner {
  readonly type = 'playwright' as const;
  private browsers: Map<string, Browser> = new Map();

  async launch(options?: {
    headless?: boolean;
    devtools?: boolean;
    args?: string[];
    executablePath?: string;
    timeout?: number;
  }): Promise<BrowserContext> {
    const browser = await chromium.launch({
      headless: options?.headless ?? true,
      devtools: options?.devtools,
      args: options?.args,
      executablePath: options?.executablePath,
      timeout: options?.timeout,
    });

    const id = this.generateId();
    this.browsers.set(id, browser);

    const context = await browser.newContext();
    this.contexts.set(id, context);

    return { id, type: this.type };
  }

  async close(context: BrowserContext): Promise<void> {
    const ctx = this.getContext(context) as PWContext;
    await ctx.close();
    
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
    const ctx = this.getContext(context) as PWContext;
    
    // Playwrightではコンテキスト作成時にオプションを指定するため、
    // 新しいコンテキストを作成する必要がある場合
    if (options && Object.keys(options).length > 0) {
      const browser = this.browsers.get(context.id);
      if (!browser) {
        throw new Error(`Browser not found for context: ${context.id}`);
      }

      const newContext = await browser.newContext({
        viewport: options.viewport,
        userAgent: options.userAgent,
        locale: options.locale,
        timezoneId: options.timezoneId,
        geolocation: options.geolocation,
        permissions: options.permissions,
      });

      // 新しいコンテキストで置き換え
      await ctx.close();
      this.contexts.set(context.id, newContext);
      
      const page = await newContext.newPage();
      const pageId = this.generateId();
      this.pages.set(pageId, page);
      
      return { id: pageId, url: page.url() };
    }

    const page = await ctx.newPage();
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
    
    let waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'load';
    if (options?.waitUntil) {
      if (options.waitUntil === 'networkidle0' || options.waitUntil === 'networkidle2') {
        waitUntil = 'networkidle';
      } else if (options.waitUntil === 'networkidle') {
        waitUntil = 'networkidle';
      } else {
        waitUntil = options.waitUntil;
      }
    }

    await p.goto(url, {
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async screenshot(page: PageContext, options?: ScreenshotOptions): Promise<Buffer> {
    const p = this.getPage(page) as Page;
    
    return await p.screenshot({
      fullPage: options?.fullPage,
      clip: options?.clip,
      quality: options?.quality,
      type: options?.type,
      omitBackground: options?.omitBackground,
    });
  }

  async evaluate<T = any>(
    page: PageContext,
    script: string | (() => T),
    options?: EvaluateOptions
  ): Promise<T> {
    const p = this.getPage(page) as Page;
    
    // タイムアウト設定
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
      // デフォルトタイムアウトに戻す
      if (options?.timeout) {
        p.setDefaultTimeout(30000);
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
      state: options?.hidden ? 'hidden' : options?.visible ? 'visible' : 'attached',
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
    await p.setViewportSize(size);
  }

  async setUserAgent(page: PageContext, userAgent: string): Promise<void> {
    // Playwrightではページレベルでユーザーエージェントを変更できないため、
    // コンテキストレベルで設定する必要がある
    const p = this.getPage(page) as Page;
    const context = p.context();
    
    // 新しいページを作成して置き換える必要がある
    await p.close();
    
    const newPage = await context.newPage();
    await newPage.route('**/*', async route => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          'User-Agent': userAgent,
        },
      });
    });
    
    this.pages.set(page.id, newPage);
  }

  async setCookies(page: PageContext, cookies: CookieOptions[]): Promise<void> {
    const p = this.getPage(page) as Page;
    const context = p.context();
    
    await context.addCookies(cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
    })));
  }

  async clearCookies(page: PageContext): Promise<void> {
    const p = this.getPage(page) as Page;
    const context = p.context();
    await context.clearCookies();
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
    const context = p.context();
    
    // CDP sessionを使用してネットワーク条件を設定
    const client = await context.newCDPSession(p);
    
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
    
    let waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'load';
    if (options?.waitUntil && options.waitUntil !== 'networkidle0' && options.waitUntil !== 'networkidle2') {
      waitUntil = options.waitUntil === 'networkidle' ? 'networkidle' : options.waitUntil;
    }

    await p.reload({
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async goBack(page: PageContext, options?: WaitOptions): Promise<void> {
    const p = this.getPage(page) as Page;
    
    let waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'load';
    if (options?.waitUntil && options.waitUntil !== 'networkidle0' && options.waitUntil !== 'networkidle2') {
      waitUntil = options.waitUntil === 'networkidle' ? 'networkidle' : options.waitUntil;
    }

    await p.goBack({
      waitUntil,
      timeout: options?.timeout,
    });
  }

  async goForward(page: PageContext, options?: WaitOptions): Promise<void> {
    const p = this.getPage(page) as Page;
    
    let waitUntil: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' = 'load';
    if (options?.waitUntil && options.waitUntil !== 'networkidle0' && options.waitUntil !== 'networkidle2') {
      waitUntil = options.waitUntil === 'networkidle' ? 'networkidle' : options.waitUntil;
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