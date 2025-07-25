/**
 * ブラウザランナーの共通型定義
 */

import type { LayoutAnalysisResult } from "../layout/extractor.js";

export interface BrowserContext {
  id: string;
  type: 'playwright' | 'puppeteer';
}

export interface PageContext {
  id: string;
  url: string;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  quality?: number;
  type?: 'png' | 'jpeg';
  omitBackground?: boolean;
}

export interface WaitOptions {
  timeout?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'networkidle0' | 'networkidle2';
}

export interface NetworkConditions {
  offline?: boolean;
  downloadThroughput?: number;
  uploadThroughput?: number;
  latency?: number;
}

export interface CookieOptions {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface EvaluateOptions {
  timeout?: number;
}

/**
 * ブラウザランナーの抽象インターフェース
 */
export interface BrowserRunner {
  /**
   * ランナーの種類
   */
  readonly type: 'playwright' | 'puppeteer';

  /**
   * ブラウザを起動
   */
  launch(options?: {
    headless?: boolean;
    devtools?: boolean;
    args?: string[];
    executablePath?: string;
    timeout?: number;
  }): Promise<BrowserContext>;

  /**
   * ブラウザを閉じる
   */
  close(context: BrowserContext): Promise<void>;

  /**
   * 新しいページを作成
   */
  newPage(context: BrowserContext, options?: {
    viewport?: ViewportSize;
    userAgent?: string;
    locale?: string;
    timezoneId?: string;
    geolocation?: { latitude: number; longitude: number; accuracy?: number };
    permissions?: string[];
  }): Promise<PageContext>;

  /**
   * ページを閉じる
   */
  closePage(page: PageContext): Promise<void>;

  /**
   * URLに移動
   */
  goto(page: PageContext, url: string, options?: WaitOptions): Promise<void>;

  /**
   * スクリーンショットを撮影
   */
  screenshot(page: PageContext, options?: ScreenshotOptions): Promise<Buffer>;

  /**
   * レイアウト情報を抽出
   */
  extractLayout(page: PageContext): Promise<LayoutAnalysisResult>;

  /**
   * JavaScriptを実行
   */
  evaluate<T = any>(
    page: PageContext,
    script: string | (() => T),
    options?: EvaluateOptions
  ): Promise<T>;

  /**
   * 要素が表示されるまで待機
   */
  waitForSelector(
    page: PageContext,
    selector: string,
    options?: {
      visible?: boolean;
      hidden?: boolean;
      timeout?: number;
    }
  ): Promise<void>;

  /**
   * クリック
   */
  click(page: PageContext, selector: string, options?: {
    button?: 'left' | 'right' | 'middle';
    clickCount?: number;
    delay?: number;
  }): Promise<void>;

  /**
   * テキスト入力
   */
  typeText(page: PageContext, selector: string, text: string, options?: {
    delay?: number;
  }): Promise<void>;

  /**
   * ビューポートサイズを設定
   */
  setViewportSize(page: PageContext, size: ViewportSize): Promise<void>;

  /**
   * ユーザーエージェントを設定
   */
  setUserAgent(page: PageContext, userAgent: string): Promise<void>;

  /**
   * Cookieを設定
   */
  setCookies(page: PageContext, cookies: CookieOptions[]): Promise<void>;

  /**
   * Cookieをクリア
   */
  clearCookies(page: PageContext): Promise<void>;

  /**
   * ローカルストレージをクリア
   */
  clearLocalStorage(page: PageContext): Promise<void>;

  /**
   * ネットワーク条件を設定
   */
  setNetworkConditions(page: PageContext, conditions: NetworkConditions): Promise<void>;

  /**
   * HTTPヘッダーを設定
   */
  setExtraHTTPHeaders(page: PageContext, headers: Record<string, string>): Promise<void>;

  /**
   * 現在のURLを取得
   */
  getCurrentUrl(page: PageContext): Promise<string>;

  /**
   * タイトルを取得
   */
  getTitle(page: PageContext): Promise<string>;

  /**
   * 待機
   */
  wait(ms: number): Promise<void>;

  /**
   * リロード
   */
  reload(page: PageContext, options?: WaitOptions): Promise<void>;

  /**
   * 戻る
   */
  goBack(page: PageContext, options?: WaitOptions): Promise<void>;

  /**
   * 進む
   */
  goForward(page: PageContext, options?: WaitOptions): Promise<void>;

  /**
   * クリーンアップ
   */
  cleanup?(): Promise<void>;
}

/**
 * ランナーファクトリー
 */
export interface BrowserRunnerFactory {
  create(type: 'playwright' | 'puppeteer'): BrowserRunner;
}