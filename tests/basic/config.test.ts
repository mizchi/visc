import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConfigLoader, ConfigValidator } from '../../src/config/index.js';
import fs from 'fs/promises';

// fs/promisesのモック
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn()
  }
}));

describe('Basic API - ConfigLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('fromFile', () => {
    it('JSONファイルから設定を読み込む', async () => {
      const mockConfig = {
        baseUrl: 'https://example.com',
        snapshotDir: './snapshots',
        urls: [{ name: 'home', url: '/' }]
      };
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      
      const config = await ConfigLoader.fromFile('./config.json');
      
      expect(config).toMatchObject(mockConfig);
      expect(fs.readFile).toHaveBeenCalledWith('./config.json', 'utf-8');
    });

    it('デフォルト値とマージする', async () => {
      const mockConfig = {
        baseUrl: 'https://example.com'
      };
      
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
      
      const config = await ConfigLoader.fromFile('./config.json', {
        browser: { headless: false }
      });
      
      expect(config.baseUrl).toBe('https://example.com');
      expect(config.browser?.headless).toBe(false);
      expect(config.snapshotDir).toBe('./snapshots'); // デフォルト値
    });

    it('ファイルが存在しない場合エラーを投げる', async () => {
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);
      
      await expect(ConfigLoader.fromFile('./notexist.json')).rejects.toThrow(
        'Configuration file not found: ./notexist.json'
      );
    });

    it('無効なJSONの場合エラーを投げる', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');
      
      await expect(ConfigLoader.fromFile('./invalid.json')).rejects.toThrow(
        'Invalid JSON in configuration file: ./invalid.json'
      );
    });
  });

  describe('fromEnv', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('環境変数から設定を読み込む', () => {
      process.env.VISUAL_CHECKER_BASE_URL = 'https://test.com';
      process.env.VISUAL_CHECKER_SNAPSHOT_DIR = './test-snapshots';
      process.env.VISUAL_CHECKER_BROWSER_TYPE = 'firefox';
      process.env.VISUAL_CHECKER_HEADLESS = 'true';
      process.env.VISUAL_CHECKER_THRESHOLD = '0.2';
      
      const config = ConfigLoader.fromEnv();
      
      expect(config).toEqual({
        baseUrl: 'https://test.com',
        snapshotDir: './test-snapshots',
        browser: {
          browser: 'firefox',
          headless: true
        },
        comparison: {
          threshold: 0.2
        }
      });
    });
  });

  describe('findConfigFile', () => {
    it('設定ファイルを探す', async () => {
      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error('not found')) // /project/src/visual-checker.config.json
        .mockRejectedValueOnce(new Error('not found')) // /project/src/configs/visual-checker.config.json
        .mockResolvedValueOnce(undefined); // /project/visual-checker.config.json
      
      const path = await ConfigLoader.findConfigFile('/project/src');
      
      expect(path).toBe('/project/visual-checker.config.json');
    });

    it('configsディレクトリも確認する', async () => {
      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error('not found')) // /project/visual-checker.config.json
        .mockResolvedValueOnce(undefined); // /project/configs/visual-checker.config.json
      
      const path = await ConfigLoader.findConfigFile('/project');
      
      expect(path).toBe('/project/configs/visual-checker.config.json');
    });

    it('見つからない場合nullを返す', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('not found'));
      
      const path = await ConfigLoader.findConfigFile('/');
      
      expect(path).toBeNull();
    });
  });
});

describe('Basic API - ConfigValidator', () => {
  let validator: ConfigValidator;

  beforeEach(() => {
    validator = new ConfigValidator();
  });

  describe('validate', () => {
    it('有効な設定を検証する', () => {
      const config = {
        baseUrl: 'https://example.com',
        urls: [
          { name: 'home', url: '/' },
          { name: 'about', url: '/about' }
        ],
        browser: {
          browser: 'chromium' as const,
          viewport: { width: 1280, height: 720 }
        },
        comparison: {
          threshold: 0.1
        }
      };
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('URLリストのエラーを検出する', () => {
      const config = {
        urls: [
          { url: '/' }, // nameがない
          { name: 'about' } // urlがない
        ] as any
      };
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('urls[0].name is required');
      expect(result.errors).toContain('urls[1].url is required');
    });

    it('ブラウザ設定のエラーを検出する', () => {
      const config = {
        browser: {
          browser: 'invalid' as any,
          viewport: { width: -1, height: 0 },
          timeout: -1000
        }
      };
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('browser.browser must be one of: chromium, firefox, webkit');
      expect(result.errors).toContain('browser.viewport must have positive width and height');
      expect(result.errors).toContain('browser.timeout must be positive');
    });

    it('比較設定のエラーを検出する', () => {
      const config = {
        comparison: {
          threshold: 1.5
        }
      };
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('comparison.threshold must be between 0 and 1');
    });

    it('警告を生成する', () => {
      const config = {
        urls: [{ name: 'home', url: '/' }],
        browser: { headless: false },
        comparison: { threshold: 0.8 }
      };
      
      const result = validator.validate(config);
      
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('baseUrl is not set, will use default: http://localhost:3000');
      expect(result.warnings).toContain('Running in headed mode may be slower');
      expect(result.warnings).toContain('High threshold value may miss visual changes');
    });
  });

  describe('normalize', () => {
    it('設定値を正規化する', () => {
      const config = {
        baseUrl: 'https://example.com',
        snapshotDir: 'snapshots\\windows\\path',
        comparison: {
          diffDir: 'diffs\\path'
        },
        urls: [
          { name: 'home', url: 'index.html' }
        ]
      };
      
      const normalized = validator.normalize(config);
      
      expect(normalized.baseUrl).toBe('https://example.com/');
      expect(normalized.snapshotDir).toBe('snapshots/windows/path');
      expect(normalized.comparison?.diffDir).toBe('diffs/path');
      expect(normalized.urls?.[0].url).toBe('/index.html');
    });
  });
});