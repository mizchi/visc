/**
 * ブラウザランナーの基底クラス
 */

import type { 
  BrowserRunner,
  BrowserContext,
  PageContext,
  ViewportSize,
  ScreenshotOptions,
  WaitOptions,
  NetworkConditions,
  CookieOptions,
  EvaluateOptions
} from "./types.js";
import type { LayoutAnalysisResult } from "../layout/extractor.js";
import { extractSemanticLayoutScript } from "../layout/semantic-analyzer.js";

export abstract class BaseBrowserRunner implements BrowserRunner {
  abstract readonly type: 'playwright' | 'puppeteer';
  
  protected contexts: Map<string, any> = new Map();
  protected pages: Map<string, any> = new Map();
  private idCounter = 0;

  protected generateId(): string {
    return `${this.type}-${++this.idCounter}`;
  }

  abstract launch(options?: {
    headless?: boolean;
    devtools?: boolean;
    args?: string[];
    executablePath?: string;
    timeout?: number;
  }): Promise<BrowserContext>;

  abstract close(context: BrowserContext): Promise<void>;

  abstract newPage(context: BrowserContext, options?: {
    viewport?: ViewportSize;
    userAgent?: string;
    locale?: string;
    timezoneId?: string;
    geolocation?: { latitude: number; longitude: number; accuracy?: number };
    permissions?: string[];
  }): Promise<PageContext>;

  abstract closePage(page: PageContext): Promise<void>;

  abstract goto(page: PageContext, url: string, options?: WaitOptions): Promise<void>;

  abstract screenshot(page: PageContext, options?: ScreenshotOptions): Promise<Buffer>;

  abstract evaluate<T = any>(
    page: PageContext,
    script: string | (() => T),
    options?: EvaluateOptions
  ): Promise<T>;

  abstract waitForSelector(
    page: PageContext,
    selector: string,
    options?: {
      visible?: boolean;
      hidden?: boolean;
      timeout?: number;
    }
  ): Promise<void>;

  abstract click(page: PageContext, selector: string, options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
  }): Promise<void>;

  abstract typeText(page: PageContext, selector: string, text: string, options?: {
    delay?: number;
  }): Promise<void>;

  abstract setViewportSize(page: PageContext, size: ViewportSize): Promise<void>;

  abstract setUserAgent(page: PageContext, userAgent: string): Promise<void>;

  abstract setCookies(page: PageContext, cookies: CookieOptions[]): Promise<void>;

  abstract clearCookies(page: PageContext): Promise<void>;

  abstract clearLocalStorage(page: PageContext): Promise<void>;

  abstract setNetworkConditions(page: PageContext, conditions: NetworkConditions): Promise<void>;

  abstract setExtraHTTPHeaders(page: PageContext, headers: Record<string, string>): Promise<void>;

  abstract getCurrentUrl(page: PageContext): Promise<string>;

  abstract getTitle(page: PageContext): Promise<string>;

  abstract reload(page: PageContext, options?: WaitOptions): Promise<void>;

  abstract goBack(page: PageContext, options?: WaitOptions): Promise<void>;

  abstract goForward(page: PageContext, options?: WaitOptions): Promise<void>;

  /**
   * レイアウト情報を抽出（共通実装）
   */
  async extractLayout(page: PageContext): Promise<LayoutAnalysisResult> {
    try {
      const layoutData = await this.evaluate(page, extractSemanticLayoutScript);
      const url = await this.getCurrentUrl(page);
      
      if (!layoutData || typeof layoutData !== 'object') {
        throw new Error(`Invalid layout data received: ${JSON.stringify(layoutData)}`);
      }
      
      return {
        ...layoutData,
        url,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error in extractLayout:', error);
      throw error;
    }
  }

  /**
   * 待機（共通実装）
   */
  async wait(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }


  /**
   * コンテキストの取得
   */
  protected getContext(context: BrowserContext): any {
    const ctx = this.contexts.get(context.id);
    if (!ctx) {
      throw new Error(`Context not found: ${context.id}`);
    }
    return ctx;
  }

  /**
   * ページの取得
   */
  protected getPage(page: PageContext): any {
    const p = this.pages.get(page.id);
    if (!p) {
      throw new Error(`Page not found: ${page.id}`);
    }
    return p;
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    // すべてのページを閉じる
    for (const [id, page] of this.pages) {
      try {
        await this.closePage({ id, url: '' });
      } catch (error) {
        console.error(`Failed to close page ${id}:`, error);
      }
    }

    // すべてのコンテキストを閉じる
    for (const [id] of this.contexts) {
      try {
        await this.close({ id, type: this.type });
      } catch (error) {
        console.error(`Failed to close context ${id}:`, error);
      }
    }

    this.pages.clear();
    this.contexts.clear();
  }
}