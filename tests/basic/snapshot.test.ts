import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SnapshotManager, SnapshotComparator } from '../../src/basic/snapshot/index.js';
import fs from 'fs/promises';
import path from 'path';

// fs/promisesのモック
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    copyFile: vi.fn(),
    access: vi.fn(),
    readdir: vi.fn().mockResolvedValue(['home-baseline.png', 'about-baseline.png']),
    unlink: vi.fn(),
    rm: vi.fn()
  }
}));

// compareImagesのモック
vi.mock('../../src/core/compare.js', () => ({
  compareImages: vi.fn().mockResolvedValue({
    match: true,
    difference: 0,
    diffPixels: 0
  })
}));

describe('Basic API - SnapshotManager', () => {
  let manager: SnapshotManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // 相対パスを使用してテスト
    manager = new SnapshotManager('./test-snapshots');
  });

  describe('update', () => {
    it('ベースラインスナップショットを更新する', async () => {
      await manager.update('home', './screenshot.png');
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('test-snapshots'),
        { recursive: true }
      );
      expect(fs.copyFile).toHaveBeenCalledWith(
        './screenshot.png',
        expect.stringContaining('test-snapshots/home-baseline.png')
      );
    });
  });

  describe('compare', () => {
    it('ベースラインと比較する', async () => {
      const result = await manager.compare('home', './current.png');
      
      expect(result).toMatchObject({
        match: true,
        difference: 0,
        diffPixels: 0,
        baselinePath: expect.stringContaining('test-snapshots/home-baseline.png')
      });
    });

    it('ベースラインが存在しない場合エラーを投げる', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
      
      await expect(manager.compare('new', './current.png')).rejects.toThrow(
        'Baseline not found for "new". Run update() first.'
      );
    });

    it('差分画像を生成する', async () => {
      const { compareImages } = await import('../../src/core/compare.js');
      
      await manager.compare('home', './current.png', {
        generateDiff: true,
        threshold: 0.2
      });
      
      expect(compareImages).toHaveBeenCalledWith(
        expect.stringContaining('test-snapshots/home-baseline.png'),
        './current.png',
        {
          threshold: 0.2,
          generateDiff: true,
          diffPath: expect.stringContaining('test-snapshots/home-diff.png')
        }
      );
    });
  });

  describe('hasBaseline', () => {
    it('ベースラインが存在する場合trueを返す', async () => {
      const result = await manager.hasBaseline('home');
      expect(result).toBe(true);
    });

    it('ベースラインが存在しない場合falseを返す', async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
      const result = await manager.hasBaseline('new');
      expect(result).toBe(false);
    });
  });

  describe('listBaselines', () => {
    it('すべてのベースラインをリストする', async () => {
      const baselines = await manager.listBaselines();
      expect(baselines).toEqual(['home', 'about']);
    });

    it('ディレクトリが存在しない場合空配列を返す', async () => {
      vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('ENOENT'));
      const baselines = await manager.listBaselines();
      expect(baselines).toEqual([]);
    });
  });

  describe('deleteBaseline', () => {
    it('ベースラインを削除する', async () => {
      await manager.deleteBaseline('home');
      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test-snapshots/home-baseline.png')
      );
    });

    it('ファイルが存在しない場合エラーを投げない', async () => {
      const error: any = new Error('ENOENT');
      error.code = 'ENOENT';
      vi.mocked(fs.unlink).mockRejectedValueOnce(error);
      
      await expect(manager.deleteBaseline('notexist')).resolves.not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('すべてのスナップショットを削除する', async () => {
      await manager.clearAll();
      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('test-snapshots'), 
        {
          recursive: true,
          force: true
        }
      );
    });
  });
});

describe('Basic API - SnapshotComparator', () => {
  let comparator: SnapshotComparator;

  beforeEach(() => {
    vi.clearAllMocks();
    comparator = new SnapshotComparator('./test-snapshots');
  });

  describe('batchCompare', () => {
    it('複数のスナップショットを一括比較する', async () => {
      const snapshots = [
        { name: 'home', currentPath: './home-current.png' },
        { name: 'about', currentPath: './about-current.png' }
      ];
      
      const results = await comparator.batchCompare(snapshots);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        name: 'home',
        passed: true,
        result: {
          match: true,
          difference: 0
        }
      });
    });

    it('失敗時に停止オプションが動作する', async () => {
      const { compareImages } = await import('../../src/core/compare.js');
      vi.mocked(compareImages).mockResolvedValueOnce({
        match: false,
        difference: 0.5,
        diffPixels: 100
      });
      
      const snapshots = [
        { name: 'home', currentPath: './home-current.png' },
        { name: 'about', currentPath: './about-current.png' }
      ];
      
      const results = await comparator.batchCompare(snapshots, {
        stopOnFailure: true
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].passed).toBe(false);
    });
  });

  describe('summarize', () => {
    it('比較結果のサマリーを生成する', () => {
      const results = [
        {
          name: 'home',
          result: { match: true, difference: 0, diffPixels: 0, baselinePath: '' },
          passed: true
        },
        {
          name: 'about',
          result: { match: false, difference: 0.1, diffPixels: 50, baselinePath: '', diffPath: './diff.png' },
          passed: false
        }
      ];
      
      const summary = comparator.summarize(results);
      
      expect(summary).toEqual({
        total: 2,
        passed: 1,
        failed: 1,
        passRate: 0.5,
        failures: [{
          name: 'about',
          difference: 0.1,
          diffPath: './diff.png'
        }]
      });
    });
  });

  describe('generateReport', () => {
    it('レポートを生成する', () => {
      const results = [
        {
          name: 'home',
          result: { match: true, difference: 0, diffPixels: 0, baselinePath: '' },
          passed: true
        },
        {
          name: 'about',
          result: { match: false, difference: 0.1, diffPixels: 50, baselinePath: '' },
          passed: false
        }
      ];
      
      const report = comparator.generateReport(results);
      
      expect(report).toContain('# Visual Regression Test Report');
      expect(report).toContain('Total: 2');
      expect(report).toContain('Passed: 1');
      expect(report).toContain('Failed: 1');
      expect(report).toContain('Pass Rate: 50.00%');
      expect(report).toContain('✅ home: PASSED');
      expect(report).toContain('❌ about: FAILED (10.00% difference)');
    });
  });
});