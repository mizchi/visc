/**
 * Configuration merging utilities for hierarchical settings
 * Priority: Test Case > Compare/Capture Phase > Global
 */

import type { CaptureOptions, CompareOptions, TestCaseConfig } from '../schema/config.js';

/**
 * Deep merge two objects, with the second object overriding the first
 * Arrays are replaced, not merged
 */
function deepMerge<T extends Record<string, any>>(
  base: T | undefined,
  override: T | undefined
): T | undefined {
  if (!base && !override) return undefined;
  if (!base) return override;
  if (!override) return base;

  const result = { ...base } as T;

  for (const key in override) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (overrideValue === undefined) {
      // Keep base value if override is undefined
      continue;
    }

    if (overrideValue === null) {
      // Explicitly null values override
      result[key] = null as any;
    } else if (Array.isArray(overrideValue)) {
      // Arrays are replaced, not merged
      result[key] = overrideValue;
    } else if (typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
      // Recursively merge objects
      if (typeof baseValue === 'object' && !Array.isArray(baseValue) && baseValue !== null) {
        result[key] = deepMerge(baseValue, overrideValue) as T[Extract<keyof T, string>];
      } else {
        result[key] = overrideValue;
      }
    } else {
      // Primitive values are replaced
      result[key] = overrideValue;
    }
  }

  return result;
}

/**
 * Merge capture options with proper inheritance
 * Priority: Test Case > Phase-specific > Global
 */
export function mergeCaptureOptions(
  globalOptions?: CaptureOptions,
  phaseOptions?: CaptureOptions,
  testCaseOptions?: CaptureOptions
): CaptureOptions | undefined {
  // Start with global options
  let merged = globalOptions;
  
  // Merge phase-specific options (if different from global)
  if (phaseOptions && phaseOptions !== globalOptions) {
    merged = deepMerge(merged, phaseOptions);
  }
  
  // Merge test case specific options
  if (testCaseOptions) {
    merged = deepMerge(merged, testCaseOptions);
  }
  
  return merged;
}

/**
 * Merge compare options with proper inheritance
 * Priority: Test Case > Phase-specific > Global
 */
export function mergeCompareOptions(
  globalOptions?: CompareOptions,
  phaseOptions?: CompareOptions,
  testCaseOptions?: CompareOptions
): CompareOptions | undefined {
  // Start with global options
  let merged = globalOptions;
  
  // Merge phase-specific options (if different from global)
  if (phaseOptions && phaseOptions !== globalOptions) {
    merged = deepMerge(merged, phaseOptions);
  }
  
  // Merge test case specific options
  if (testCaseOptions) {
    merged = deepMerge(merged, testCaseOptions);
  }
  
  return merged;
}

/**
 * Get effective capture options for a test case
 * Considers global, phase-specific, and test case specific settings
 */
export function getEffectiveCaptureOptions(
  testCase: TestCaseConfig,
  globalCaptureOptions?: CaptureOptions,
  phaseCaptureOptions?: CaptureOptions
): CaptureOptions | undefined {
  return mergeCaptureOptions(
    globalCaptureOptions,
    phaseCaptureOptions,
    testCase.captureOptions
  );
}

/**
 * Get effective compare options for a test case
 * Considers global, phase-specific, and test case specific settings
 */
export function getEffectiveCompareOptions(
  testCase: TestCaseConfig,
  globalCompareOptions?: CompareOptions,
  phaseCompareOptions?: CompareOptions
): CompareOptions | undefined {
  return mergeCompareOptions(
    globalCompareOptions,
    phaseCompareOptions,
    testCase.compareOptions
  );
}

/**
 * Get effective retry count for a test case
 * Priority: Test Case > Global
 */
export function getEffectiveRetryCount(
  testCase: TestCaseConfig,
  globalRetry?: number
): number {
  return testCase.retry ?? globalRetry ?? 0;
}

/**
 * Helper to log merged options for debugging
 */
export function logMergedOptions(
  testCaseId: string,
  effectiveOptions: CaptureOptions | CompareOptions | undefined,
  type: 'capture' | 'compare'
): void {
  if (process.env.DEBUG_CONFIG) {
    console.log(`\n📋 Effective ${type} options for test case "${testCaseId}":`);
    console.log(JSON.stringify(effectiveOptions, null, 2));
  }
}