import { chromium, firefox, webkit, Browser, BrowserContext, Page, BrowserType } from '@playwright/test';

export type BrowserName = 'chromium' | 'firefox' | 'webkit';

export interface BrowserOptions {
  headless?: boolean;
  slowMo?: number;
  devtools?: boolean;
  args?: string[];
}

export interface ContextOptions {
  viewport?: { width: number; height: number };
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
  permissions?: string[];
  geolocation?: { latitude: number; longitude: number };
  colorScheme?: 'light' | 'dark' | 'no-preference';
  reducedMotion?: 'reduce' | 'no-preference';
  forcedColors?: 'active' | 'none';
}

/**
 * ブラウザを起動
 */
export async function launchBrowser(
  browserName: BrowserName = 'chromium',
  options: BrowserOptions = {}
): Promise<Browser> {
  const browsers: Record<BrowserName, BrowserType> = {
    chromium,
    firefox,
    webkit
  };

  const browser = browsers[browserName];
  if (!browser) {
    throw new Error(`Unknown browser: ${browserName}`);
  }

  return await browser.launch({
    headless: options.headless ?? true,
    slowMo: options.slowMo,
    devtools: options.devtools,
    args: options.args
  });
}

/**
 * ブラウザコンテキストを作成
 */
export async function createContext(
  browser: Browser,
  options: ContextOptions = {}
): Promise<BrowserContext> {
  return await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 720 },
    userAgent: options.userAgent,
    locale: options.locale,
    timezoneId: options.timezoneId,
    permissions: options.permissions,
    geolocation: options.geolocation,
    colorScheme: options.colorScheme,
    reducedMotion: options.reducedMotion,
    forcedColors: options.forcedColors
  });
}

/**
 * ページを作成
 */
export async function createPage(context: BrowserContext): Promise<Page> {
  return await context.newPage();
}

/**
 * ページに移動
 */
export async function navigateTo(
  page: Page,
  url: string,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
  } = {}
): Promise<void> {
  await page.goto(url, {
    waitUntil: options.waitUntil ?? 'networkidle',
    timeout: options.timeout
  });
}

/**
 * スクリーンショットを撮影
 */
export async function takeScreenshot(
  page: Page,
  options: {
    path?: string;
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
    quality?: number;
    type?: 'png' | 'jpeg';
  } = {}
): Promise<Buffer> {
  return await page.screenshot({
    path: options.path,
    fullPage: options.fullPage ?? true,
    clip: options.clip,
    quality: options.quality,
    type: options.type ?? 'png'
  });
}

/**
 * ページでJavaScriptを実行
 */
export async function evaluate<T>(
  page: Page,
  fn: () => T
): Promise<T> {
  return await page.evaluate(fn);
}

/**
 * ページを閉じる
 */
export async function closePage(page: Page): Promise<void> {
  await page.close();
}

/**
 * コンテキストを閉じる
 */
export async function closeContext(context: BrowserContext): Promise<void> {
  await context.close();
}

/**
 * ブラウザを閉じる
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}