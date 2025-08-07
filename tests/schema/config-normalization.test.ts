import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateConfig } from '../../src/schema/config.js';

describe('Config Normalization', () => {
  // Mock console.warn
  const originalWarn = console.warn;
  beforeEach(() => {
    console.warn = vi.fn();
  });
  afterEach(() => {
    console.warn = originalWarn;
  });

  it('should accept values between 0 and 1 as-is', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test',
        url: 'https://example.com'
      }],
      compareOptions: {
        threshold: 0.05,
        similarityThreshold: 0.98
      }
    };

    const result = validateConfig(config);
    expect(result.compareOptions?.threshold).toBe(0.05);
    expect(result.compareOptions?.similarityThreshold).toBe(0.98);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should normalize percentage values (1-100) to 0-1 range with warning', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test',
        url: 'https://example.com'
      }],
      compareOptions: {
        threshold: 5,
        similarityThreshold: 98
      }
    };

    const result = validateConfig(config);
    expect(result.compareOptions?.threshold).toBe(0.05);
    expect(result.compareOptions?.similarityThreshold).toBe(0.98);
    expect(console.warn).toHaveBeenCalledWith(
      '⚠️  compareOptions.threshold value 5 appears to be a percentage. Normalizing to 0.05'
    );
    expect(console.warn).toHaveBeenCalledWith(
      '⚠️  compareOptions.similarityThreshold value 98 appears to be a percentage. Normalizing to 0.98'
    );
  });

  it('should normalize test case specific thresholds', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test1',
        url: 'https://example.com',
        compareOptions: {
          threshold: 10,
          similarityThreshold: 95
        }
      }],
      compareOptions: {
        threshold: 0.05,
        similarityThreshold: 0.98
      }
    };

    const result = validateConfig(config);
    // Global options should remain unchanged
    expect(result.compareOptions?.threshold).toBe(0.05);
    expect(result.compareOptions?.similarityThreshold).toBe(0.98);
    
    // Test case specific options should be normalized
    expect(result.testCases[0].compareOptions?.threshold).toBe(0.10);
    expect(result.testCases[0].compareOptions?.similarityThreshold).toBe(0.95);
    
    expect(console.warn).toHaveBeenCalledWith(
      '⚠️  testCase[test1].compareOptions.threshold value 10 appears to be a percentage. Normalizing to 0.1'
    );
    expect(console.warn).toHaveBeenCalledWith(
      '⚠️  testCase[test1].compareOptions.similarityThreshold value 95 appears to be a percentage. Normalizing to 0.95'
    );
  });

  it('should throw error for values over 100', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test',
        url: 'https://example.com'
      }],
      compareOptions: {
        threshold: 101,
        similarityThreshold: 98
      }
    };

    expect(() => validateConfig(config)).toThrow(
      'compareOptions.threshold value 101 is out of range. Must be between 0-1 (ratio) or 1-100 (percentage)'
    );
  });

  it('should throw error for test case values over 100', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test1',
        url: 'https://example.com',
        compareOptions: {
          threshold: 5,
          similarityThreshold: 150
        }
      }]
    };

    expect(() => validateConfig(config)).toThrow(
      'testCase[test1].compareOptions.similarityThreshold value 150 is out of range. Must be between 0-1 (ratio) or 1-100 (percentage)'
    );
  });

  it('should handle undefined values correctly', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test',
        url: 'https://example.com'
      }],
      compareOptions: {
        ignoreText: true
        // threshold and similarityThreshold are undefined
      }
    };

    const result = validateConfig(config);
    expect(result.compareOptions?.threshold).toBeUndefined();
    expect(result.compareOptions?.similarityThreshold).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('should accept exactly 100 as percentage', () => {
    const config = {
      version: '1.0',
      viewports: {
        desktop: { name: 'Desktop', width: 1280, height: 800 }
      },
      testCases: [{
        id: 'test',
        url: 'https://example.com'
      }],
      compareOptions: {
        threshold: 100,
        similarityThreshold: 100
      }
    };

    const result = validateConfig(config);
    expect(result.compareOptions?.threshold).toBe(1.0);
    expect(result.compareOptions?.similarityThreshold).toBe(1.0);
    expect(console.warn).toHaveBeenCalledWith(
      '⚠️  compareOptions.threshold value 100 appears to be a percentage. Normalizing to 1'
    );
    expect(console.warn).toHaveBeenCalledWith(
      '⚠️  compareOptions.similarityThreshold value 100 appears to be a percentage. Normalizing to 1'
    );
  });
});