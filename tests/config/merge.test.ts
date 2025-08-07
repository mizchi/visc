import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  mergeCaptureOptions, 
  mergeCompareOptions, 
  getEffectiveCaptureOptions,
  getEffectiveCompareOptions,
  getEffectiveRetryCount
} from '../../src/config/merge.js';
import type { CaptureOptions, CompareOptions, TestCaseConfig } from '../../src/schema/config.js';

describe('Config Merge Utilities', () => {
  describe('mergeCaptureOptions', () => {
    it('should merge options with proper priority', () => {
      const globalOptions: CaptureOptions = {
        waitUntil: 'networkidle0',
        waitForLCP: true,
        additionalWait: 1000,
        networkBlocks: ['**/analytics.js']
      };

      const phaseOptions: CaptureOptions = {
        waitUntil: 'networkidle2',
        additionalWait: 2000,
        networkBlocks: ['**/ads.js']
      };

      const testCaseOptions: CaptureOptions = {
        additionalWait: 3000,
        timeout: 60000
      };

      const result = mergeCaptureOptions(globalOptions, phaseOptions, testCaseOptions);

      expect(result).toEqual({
        waitUntil: 'networkidle2', // From phase
        waitForLCP: true, // From global (not overridden)
        additionalWait: 3000, // From test case (highest priority)
        networkBlocks: ['**/ads.js'], // From phase (arrays are replaced)
        timeout: 60000 // From test case
      });
    });

    it('should handle undefined values correctly', () => {
      const globalOptions: CaptureOptions = {
        waitUntil: 'load',
        waitForLCP: false
      };

      const result = mergeCaptureOptions(globalOptions, undefined, undefined);
      expect(result).toEqual(globalOptions);
    });

    it('should replace arrays, not merge them', () => {
      const globalOptions: CaptureOptions = {
        networkBlocks: ['**/global1.js', '**/global2.js']
      };

      const testCaseOptions: CaptureOptions = {
        networkBlocks: ['**/test.js']
      };

      const result = mergeCaptureOptions(globalOptions, undefined, testCaseOptions);
      expect(result?.networkBlocks).toEqual(['**/test.js']);
    });

    it('should deep merge nested objects', () => {
      const globalOptions: CaptureOptions = {
        overrides: {
          'pattern1': 'file1.js',
          'pattern2': 'file2.js'
        }
      };

      const testCaseOptions: CaptureOptions = {
        overrides: {
          'pattern2': 'override2.js', // Override
          'pattern3': 'file3.js' // Add new
        }
      };

      const result = mergeCaptureOptions(globalOptions, undefined, testCaseOptions);
      expect(result?.overrides).toEqual({
        'pattern1': 'file1.js', // From global
        'pattern2': 'override2.js', // Overridden by test case
        'pattern3': 'file3.js' // Added by test case
      });
    });
  });

  describe('mergeCompareOptions', () => {
    it('should merge compare options with proper priority', () => {
      const globalOptions: CompareOptions = {
        ignoreText: true,
        threshold: 0.05,
        similarityThreshold: 0.98,
        useVisualGroups: false
      };

      const phaseOptions: CompareOptions = {
        threshold: 0.10,
        useVisualGroups: true
      };

      const testCaseOptions: CompareOptions = {
        similarityThreshold: 0.95,
        ignoreText: false
      };

      const result = mergeCompareOptions(globalOptions, phaseOptions, testCaseOptions);

      expect(result).toEqual({
        ignoreText: false, // From test case
        threshold: 0.10, // From phase
        similarityThreshold: 0.95, // From test case
        useVisualGroups: true // From phase
      });
    });
  });

  describe('getEffectiveCaptureOptions', () => {
    it('should get effective options for a test case', () => {
      const testCase: TestCaseConfig = {
        id: 'test1',
        url: 'https://example.com',
        captureOptions: {
          additionalWait: 5000
        }
      };

      const globalOptions: CaptureOptions = {
        waitUntil: 'networkidle0',
        additionalWait: 1000
      };

      const phaseOptions: CaptureOptions = {
        waitForLCP: false
      };

      const result = getEffectiveCaptureOptions(testCase, globalOptions, phaseOptions);

      expect(result).toEqual({
        waitUntil: 'networkidle0', // From global
        waitForLCP: false, // From phase
        additionalWait: 5000 // From test case
      });
    });

    it('should handle test case without options', () => {
      const testCase: TestCaseConfig = {
        id: 'test2',
        url: 'https://example.com'
      };

      const globalOptions: CaptureOptions = {
        waitUntil: 'load'
      };

      const result = getEffectiveCaptureOptions(testCase, globalOptions, undefined);
      expect(result).toEqual(globalOptions);
    });
  });

  describe('getEffectiveCompareOptions', () => {
    it('should get effective compare options', () => {
      const testCase: TestCaseConfig = {
        id: 'test1',
        url: 'https://example.com',
        compareOptions: {
          threshold: 0.15
        }
      };

      const globalOptions: CompareOptions = {
        ignoreText: true,
        threshold: 0.05,
        similarityThreshold: 0.98
      };

      const result = getEffectiveCompareOptions(testCase, globalOptions, globalOptions);

      expect(result).toEqual({
        ignoreText: true,
        threshold: 0.15, // Overridden by test case
        similarityThreshold: 0.98
      });
    });
  });

  describe('getEffectiveRetryCount', () => {
    it('should return test case retry count if set', () => {
      const testCase: TestCaseConfig = {
        id: 'test1',
        url: 'https://example.com',
        retry: 3
      };

      const result = getEffectiveRetryCount(testCase, 1);
      expect(result).toBe(3);
    });

    it('should return global retry count if test case not set', () => {
      const testCase: TestCaseConfig = {
        id: 'test2',
        url: 'https://example.com'
      };

      const result = getEffectiveRetryCount(testCase, 2);
      expect(result).toBe(2);
    });

    it('should return 0 if neither is set', () => {
      const testCase: TestCaseConfig = {
        id: 'test3',
        url: 'https://example.com'
      };

      const result = getEffectiveRetryCount(testCase, undefined);
      expect(result).toBe(0);
    });
  });

  describe('Three-level inheritance', () => {
    it('should properly handle global → phase → test case inheritance', () => {
      const testCase: TestCaseConfig = {
        id: 'complex-test',
        url: 'https://example.com',
        captureOptions: {
          timeout: 120000, // Test-specific
          networkBlocks: ['**/test-specific.js']
        },
        compareOptions: {
          similarityThreshold: 0.90 // Test-specific
        }
      };

      const globalCaptureOptions: CaptureOptions = {
        waitUntil: 'networkidle0',
        waitForLCP: true,
        additionalWait: 1000,
        timeout: 30000,
        networkBlocks: ['**/global-analytics.js']
      };

      const phaseCaptureOptions: CaptureOptions = {
        waitForLCP: false, // Override global
        additionalWait: 2000, // Override global
        overrides: {
          '**/*.css': './phase-override.css'
        }
      };

      const globalCompareOptions: CompareOptions = {
        ignoreText: true,
        threshold: 0.05,
        similarityThreshold: 0.98,
        useVisualGroups: true
      };

      const phaseCompareOptions: CompareOptions = {
        threshold: 0.10, // Override global
        networkBlocks: ['**/compare-block.js']
      };

      // Get effective capture options
      const effectiveCaptureOptions = getEffectiveCaptureOptions(
        testCase,
        globalCaptureOptions,
        phaseCaptureOptions
      );

      expect(effectiveCaptureOptions).toEqual({
        waitUntil: 'networkidle0', // From global
        waitForLCP: false, // From phase (overrides global)
        additionalWait: 2000, // From phase (overrides global)
        timeout: 120000, // From test case (overrides all)
        networkBlocks: ['**/test-specific.js'], // From test case (replaces all)
        overrides: {
          '**/*.css': './phase-override.css' // From phase
        }
      });

      // Get effective compare options
      const effectiveCompareOptions = getEffectiveCompareOptions(
        testCase,
        globalCompareOptions,
        phaseCompareOptions
      );

      expect(effectiveCompareOptions).toEqual({
        ignoreText: true, // From global
        threshold: 0.10, // From phase (overrides global)
        similarityThreshold: 0.90, // From test case (overrides all)
        useVisualGroups: true, // From global
        networkBlocks: ['**/compare-block.js'] // From phase
      });
    });
  });
});