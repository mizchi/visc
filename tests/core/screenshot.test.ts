import { describe, it, expect, vi, beforeEach } from 'vitest';
import { captureScreenshot, captureMultipleScreenshots } from '../../src/core/screenshot.js';
import type { Browser } from '@playwright/test';

// Playwrightのモック
vi.mock('@playwright/test', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          screenshot: vi.fn()
        })
      }),
      close: vi.fn()
    })
  }
}));

describe('Core API - Screenshot', () => {
  describe('captureScreenshot', () => {
    it('指定されたURLのスクリーンショットを撮影する', async () => {
      const result = await captureScreenshot('https://example.com');
      
      expect(result).toMatchObject({
        url: 'https://example.com',
        path: expect.stringContaining('screenshots/screenshot-'),
        timestamp: expect.any(Date),
        viewport: {
          width: 1280,
          height: 720
        }
      });
    });

    it('カスタムオプションを適用する', async () => {
      const result = await captureScreenshot('https://example.com', {
        outputPath: './test-screenshots/test.png',
        viewport: { width: 1920, height: 1080 },
        fullPage: false
      });
      
      expect(result.path).toBe('./test-screenshots/test.png');
      expect(result.viewport).toEqual({ width: 1920, height: 1080 });
    });
  });

  describe('captureMultipleScreenshots', () => {
    it('複数のURLのスクリーンショットを並列で撮影する', async () => {
      const urls = [
        'https://example.com',
        'https://google.com',
        'https://github.com'
      ];
      
      const results = await captureMultipleScreenshots(urls);
      
      expect(results).toHaveLength(3);
      expect(results[0].url).toBe('https://example.com');
      expect(results[1].url).toBe('https://google.com');
      expect(results[2].url).toBe('https://github.com');
    });
  });
});