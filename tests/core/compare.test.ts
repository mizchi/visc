import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compareImages, compareMultipleImages } from '../../src/core/compare.js';
import fs from 'fs';
import { PNG } from 'pngjs';

// pngjsのモック
vi.mock('pngjs', () => {
  class MockPNG {
    data = new Uint8ClampedArray(100);
    width = 10;
    height = 10;
    
    pack() {
      return this;
    }
    
    pipe(stream: any) {
      if (stream && stream.on) {
        // Write streamの場合、finishイベントを発火
        setTimeout(() => {
          const finishCallback = stream.on.mock.calls.find((call: any) => call[0] === 'finish')?.[1];
          if (finishCallback) {
            finishCallback();
          }
        }, 0);
      }
      return stream;
    }
    
    on(event: string, callback: Function) {
      if (event === 'parsed') {
        setTimeout(() => callback.call(this), 0);
      }
      return this;
    }
    
    emit(event: string) {
      if (event === 'parsed') {
        const callback = this.on.bind(this);
        if (callback) {
          callback('parsed', function() {});
        }
      }
    }
  }
  
  return {
    PNG: MockPNG
  };
});

// pixelmatchのモック
vi.mock('pixelmatch', () => ({
  default: vi.fn().mockReturnValue(0) // 0 = 完全一致
}));

// fsのモック
vi.mock('fs', () => {
  const mockReadStream = {
    pipe: vi.fn().mockImplementation(function(target) {
      setTimeout(() => {
        if (target && target.emit) {
          target.emit('parsed');
        }
      }, 0);
      return target;
    })
  };

  const mockWriteStream = {
    on: vi.fn().mockImplementation(function(event, callback) {
      if (event === 'finish') {
        setTimeout(callback, 0);
      }
      return this;
    })
  };

  return {
    default: {
      createReadStream: vi.fn().mockReturnValue(mockReadStream),
      createWriteStream: vi.fn().mockReturnValue(mockWriteStream),
      mkdirSync: vi.fn()
    }
  };
});

describe('Core API - Compare', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('compareImages', () => {
    it('2つの画像を比較して結果を返す', async () => {
      const result = await compareImages('image1.png', 'image2.png');
      
      expect(result).toMatchObject({
        match: true,
        difference: 0,
        diffPixels: 0
      });
    });

    it('差分がある場合は差分画像を生成する', async () => {
      const pixelmatch = await import('pixelmatch');
      vi.mocked(pixelmatch.default).mockReturnValueOnce(10); // 10ピクセルの差分
      
      const result = await compareImages('image1.png', 'image2.png', {
        generateDiff: true,
        diffPath: './diff.png'
      });
      
      expect(result).toMatchObject({
        match: false,
        difference: 0.1, // 10 / (10 * 10)
        diffPixels: 10,
        diffPath: './diff.png'
      });
    });

    it('しきい値を考慮する', async () => {
      const result = await compareImages('image1.png', 'image2.png', {
        threshold: 0.5
      });
      
      expect(result.match).toBe(true);
    });
  });

  describe('compareMultipleImages', () => {
    it('複数の画像ペアを比較する', async () => {
      const pairs = [
        { before: 'v1/home.png', after: 'v2/home.png' },
        { before: 'v1/about.png', after: 'v2/about.png' }
      ];
      
      const results = await compareMultipleImages(pairs);
      
      expect(results).toHaveLength(2);
      expect(results[0].pair).toEqual(pairs[0]);
      expect(results[0].result.match).toBe(true);
      expect(results[1].pair).toEqual(pairs[1]);
      expect(results[1].result.match).toBe(true);
    });
  });
});