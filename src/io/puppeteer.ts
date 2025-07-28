import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';

export interface PuppeteerLaunchOptions extends LaunchOptions {
  viewport?: { width: number; height: number };
}

/**
 * Puppeteerブラウザを起動
 */
export async function launchPuppeteer(options: PuppeteerLaunchOptions = {}): Promise<Browser> {
  return await puppeteer.launch({
    headless: options.headless ?? true,
    args: options.args ?? ['--no-sandbox', '--disable-setuid-sandbox'],
    ...options
  });
}

/**
 * Puppeteerページを作成
 */
export async function createPuppeteerPage(browser: Browser, viewport?: { width: number; height: number }): Promise<Page> {
  const page = await browser.newPage();
  
  if (viewport) {
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1
    });
  }

  return page;
}

/**
 * Puppeteerブラウザを閉じる
 */
export async function closePuppeteer(browser: Browser): Promise<void> {
  await browser.close();
}