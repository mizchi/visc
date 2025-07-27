import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserController } from '../../src/basic/browser/controller.js';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// vi.mockはトップレベルで宣言し、ファクトリー関数内でモックを定義
vi.mock('@playwright/test', () => {
  const mockPage = {
    goto: vi.fn(),
    screenshot: vi.fn(),
    close: vi.fn(),
    waitForSelector: vi.fn(),
    evaluate: vi.fn(),
    click: vi.fn(),
    locator: vi.fn().mockReturnValue({
      evaluate: vi.fn(),
      screenshot: vi.fn()
    })
  };

  const mockContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn()
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockContext),
    close: vi.fn()
  };

  return {
    chromium: {
      launch: vi.fn().mockResolvedValue(mockBrowser)
    },
    firefox: {
      launch: vi.fn().mockResolvedValue(mockBrowser)
    },
    webkit: {
      launch: vi.fn().mockResolvedValue(mockBrowser)
    },
    devices: {
      'iPhone 12': {
        viewport: { width: 390, height: 844 },
        userAgent: 'iPhone'
      }
    },
    // モックオブジェクトへの参照を追加（テスト内でアクセスするため）
    _mockBrowser: mockBrowser,
    _mockContext: mockContext,
    _mockPage: mockPage
  };
});

// モックオブジェクトへのグローバル参照を設定
let mockBrowser: any;
let mockContext: any;
let mockPage: any;

beforeEach(async () => {
  const playwright = await import('@playwright/test');
  mockBrowser = (playwright as any)._mockBrowser;
  mockContext = (playwright as any)._mockContext;
  mockPage = (playwright as any)._mockPage;
});

describe('Basic API - BrowserController', () => {
  let browser: BrowserController;

  beforeEach(async () => {
    vi.clearAllMocks();
    const playwright = await import('@playwright/test');
    mockBrowser = (playwright as any)._mockBrowser;
    mockContext = (playwright as any)._mockContext;
    mockPage = (playwright as any)._mockPage;
    browser = new BrowserController({ headless: true });
  });

  describe('launch', () => {
    it('ブラウザを起動する', async () => {
      await browser.launch();
      expect(browser.isLaunched()).toBe(true);
    });

    it('指定されたブラウザタイプを使用する', async () => {
      const firefoxBrowser = new BrowserController({ 
        browser: 'firefox',
        headless: false 
      });
      await firefoxBrowser.launch();
      
      const { firefox } = await import('@playwright/test');
      expect(firefox.launch).toHaveBeenCalledWith({ headless: false });
    });

    it('デバイスエミュレーションを適用する', async () => {
      const mobileBrowser = new BrowserController({ 
        device: 'iPhone 12'
      });
      await mobileBrowser.launch();
      
      expect(mockBrowser.newContext).toHaveBeenCalledWith(
        expect.objectContaining({
          viewport: { width: 390, height: 844 },
          userAgent: 'iPhone'
        })
      );
    });
  });

  describe('captureScreenshot', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('スクリーンショットを撮影する', async () => {
      const path = await browser.captureScreenshot({
        url: 'https://example.com',
        name: 'test'
      });
      
      expect(path).toContain('snapshots/test.png');
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'load',
        timeout: 30000
      });
      expect(mockPage.screenshot).toHaveBeenCalled();
    });

    it('待機条件を適用する', async () => {
      await browser.captureScreenshot({
        url: 'https://example.com',
        name: 'test',
        waitFor: {
          selector: '.loaded',
          networkIdle: true,
          timeout: 5000
        }
      });
      
      expect(mockPage.goto).toHaveBeenCalledWith('https://example.com', {
        waitUntil: 'networkidle',
        timeout: 5000
      });
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loaded', {
        timeout: 5000
      });
    });

    it('スクリーンショット前の処理を実行する', async () => {
      await browser.captureScreenshot({
        url: 'https://example.com',
        name: 'test',
        beforeScreenshot: {
          script: 'console.log("test")',
          click: ['button'],
          hide: ['.ads'],
          scrollTo: { x: 0, y: 100 }
        }
      });
      
      expect(mockPage.evaluate).toHaveBeenCalledWith('console.log("test")');
      expect(mockPage.click).toHaveBeenCalledWith('button');
      expect(mockPage.locator).toHaveBeenCalledWith('.ads');
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        { x: 0, y: 100 }
      );
    });

    it('特定要素のスクリーンショットを撮影する', async () => {
      await browser.captureScreenshot({
        url: 'https://example.com',
        name: 'test',
        screenshot: {
          selector: 'header'
        }
      });
      
      expect(mockPage.locator).toHaveBeenCalledWith('header');
      const locator = mockPage.locator();
      expect(locator.screenshot).toHaveBeenCalled();
    });
  });

  describe('captureMultipleScreenshots', () => {
    beforeEach(async () => {
      await browser.launch();
    });

    it('複数のページのスクリーンショットを撮影する', async () => {
      const pages = [
        { url: 'https://example.com', name: 'home' },
        { url: 'https://example.com/about', name: 'about' }
      ];
      
      const results = await browser.captureMultipleScreenshots(pages);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toContain('home.png');
      expect(results[1]).toContain('about.png');
    });
  });

  describe('close', () => {
    it('ブラウザを閉じる', async () => {
      await browser.launch();
      await browser.close();
      
      expect(browser.isLaunched()).toBe(false);
      expect(mockContext.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});