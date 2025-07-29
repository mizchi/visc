import { describe, test, expect, afterEach } from 'vitest';
import { PlaywrightRunner } from '../../src/browser/runners/playwright.js';
import type { BrowserContext, PageContext } from '../../src/browser/runners/types.js';

describe('PlaywrightRunner', { timeout: 20000 }, () => {
  let runner: PlaywrightRunner;
  let browserContext: BrowserContext | null = null;
  let pageContext: PageContext | null = null;

  afterEach(async () => {
    // クリーンアップ
    if (pageContext && runner) {
      await runner.closePage(pageContext).catch(() => {});
    }
    if (browserContext && runner) {
      await runner.close(browserContext).catch(() => {});
    }
    if (runner) {
      await runner.cleanup().catch(() => {});
    }
  });

  test('ブラウザの起動と終了', async () => {
    runner = new PlaywrightRunner();
    
    browserContext = await runner.launch({ headless: true });
    expect(browserContext).toBeDefined();
    expect(browserContext.type).toBe('playwright');
    
    await runner.close(browserContext);
    browserContext = null;
  });

  test('ページの作成と操作', async () => {
    runner = new PlaywrightRunner();
    browserContext = await runner.launch({ headless: true });
    
    // ページ作成
    pageContext = await runner.newPage(browserContext);
    expect(pageContext).toBeDefined();
    expect(pageContext.id).toBeDefined();
    
    // URLへの移動
    await runner.goto(pageContext, 'https://example.com');
    const url = await runner.getCurrentUrl(pageContext);
    expect(url).toBe('https://example.com/');
    
    // タイトル取得
    const title = await runner.getTitle(pageContext);
    expect(title).toBe('Example Domain');
  });

  test('スクリーンショットの撮影', async () => {
    runner = new PlaywrightRunner();
    browserContext = await runner.launch({ headless: true });
    pageContext = await runner.newPage(browserContext);
    
    await runner.goto(pageContext, 'https://example.com');
    
    const screenshot = await runner.screenshot(pageContext);
    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.length).toBeGreaterThan(0);
  });

  test('JavaScript評価', async () => {
    runner = new PlaywrightRunner();
    browserContext = await runner.launch({ headless: true });
    pageContext = await runner.newPage(browserContext);
    
    await runner.goto(pageContext, 'https://example.com');
    
    // 関数での評価
    const result1 = await runner.evaluate(pageContext, () => document.title);
    expect(result1).toBe('Example Domain');
    
    // 文字列での評価（現在は未サポート）
    // const result2 = await runner.evaluate(pageContext, 'return window.location.href');
    // expect(result2).toBe('https://example.com/');
  });

  test('ビューポートサイズの設定', async () => {
    runner = new PlaywrightRunner();
    browserContext = await runner.launch({ headless: true });
    pageContext = await runner.newPage(browserContext, {
      viewport: { width: 800, height: 600 }
    });
    
    const size = await runner.evaluate(pageContext, () => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    expect(size.width).toBe(800);
    expect(size.height).toBe(600);
    
    // サイズ変更
    await runner.setViewportSize(pageContext, { width: 1024, height: 768 });
    
    const newSize = await runner.evaluate(pageContext, () => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    
    expect(newSize.width).toBe(1024);
    expect(newSize.height).toBe(768);
  });

  test.skip('Cookie操作', async () => {
    runner = new PlaywrightRunner();
    browserContext = await runner.launch({ headless: true });
    pageContext = await runner.newPage(browserContext);
    
    await runner.goto(pageContext, 'https://example.com');
    
    // Cookie設定
    await runner.setCookies(pageContext, [{
      name: 'testCookie',
      value: 'testValue',
      domain: 'example.com',
      path: '/'
    }]);
    
    const cookies = await runner.evaluate(pageContext, () => document.cookie);
    expect(cookies).toContain('testCookie=testValue');
    
    // Cookie削除
    await runner.clearCookies(pageContext);
    
    const clearedCookies = await runner.evaluate(pageContext, () => document.cookie);
    expect(clearedCookies).not.toContain('testCookie');
  });

  test('待機処理', async () => {
    runner = new PlaywrightRunner();
    
    const start = Date.now();
    await runner.wait(100);
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeGreaterThanOrEqual(95); // 若干の誤差を許容
    expect(elapsed).toBeLessThan(150);
  });
});