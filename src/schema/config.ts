/**
 * Zod schema for visc configuration
 */

import { z } from 'zod';

// Viewport configuration schema
export const ViewportConfigSchema = z.object({
  name: z.string().describe('Name of the viewport'),
  width: z.number().positive().int().describe('Width in pixels'),
  height: z.number().positive().int().describe('Height in pixels'),
  deviceScaleFactor: z.number().positive().optional().describe('Device scale factor (default: 1)'),
  userAgent: z.string().optional().describe('Custom user agent string'),
});

// Wait until options
export const WaitUntilSchema = z.enum([
  'load',
  'domcontentloaded',
  'networkidle0',
  'networkidle2',
]).describe('When to consider the page loaded');

// Capture options schema
export const CaptureOptionsSchema = z.object({
  waitUntil: WaitUntilSchema.optional(),
  waitForLCP: z.boolean().optional().describe('Wait for Largest Contentful Paint'),
  additionalWait: z.number().min(0).optional().describe('Additional wait time in milliseconds'),
  timeout: z.number().min(0).optional().describe('Navigation timeout in milliseconds (default: 30000)'),
  overrides: z.record(z.string()).optional().describe('CSS selector overrides for specific elements'),
  networkBlocks: z.array(z.string()).optional().describe('URLs or patterns to block during capture'),
}).optional();

// Compare options schema
export const CompareOptionsSchema = z.object({
  ignoreText: z.boolean().optional().describe('Ignore text differences'),
  threshold: z.number().min(0).max(1).optional().describe('Similarity threshold (0-1)'),
  similarityThreshold: z.number().min(0).max(1).optional().describe('Element similarity threshold (0-1)'),
  overrides: z.record(z.string()).optional().describe('CSS selector overrides for comparison'),
  networkBlocks: z.array(z.string()).optional().describe('URLs or patterns to block during comparison'),
  useVisualGroups: z.boolean().optional().describe('Use visual group comparison instead of element-level'),
}).optional();

// Test case configuration schema
export const TestCaseConfigSchema = z.object({
  id: z.string().describe('Unique identifier for the test case'),
  url: z.string().url().describe('URL to test'),
  description: z.string().optional().describe('Description of the test case'),
  captureOptions: CaptureOptionsSchema.describe('Override capture options for this test case'),
  compareOptions: CompareOptionsSchema.describe('Override compare options for this test case'),
  retry: z.number().int().min(0).max(10).optional().describe('Number of retries for this test case (default: 0)'),
});

// Calibration options schema
export const CalibrationOptionsSchema = z.object({
  enabled: z.boolean().optional().describe('Enable auto-calibration on first run'),
  samples: z.number().positive().int().optional().describe('Number of samples to take for calibration (default: 3)'),
  strictness: z.enum(['low', 'medium', 'high']).optional().describe('Calibration strictness level'),
}).optional();

// Browser options schema
export const BrowserOptionsSchema = z.object({
  headless: z.boolean().optional().describe('Run browser in headless mode'),
  args: z.array(z.string()).optional().describe('Additional browser launch arguments'),
}).optional();

// Output options schema
export const OutputOptionsSchema = z.object({
  onlyFailed: z.boolean().optional().describe('Output SVG only for failed tests'),
  format: z.enum(['flat', 'nested']).optional().describe('Output directory structure (default: flat)'),
}).optional();

// Main configuration schema
export const ViscConfigSchema = z.object({
  // Meta information
  $schema: z.string().optional().describe('JSON Schema reference'),
  version: z.string().optional().describe('Configuration version for future compatibility'),
  
  // Directories
  cacheDir: z.string().optional().describe('Cache directory (default: .visc/cache)'),
  outputDir: z.string().optional().describe('Output directory for results (default: .visc/output)'),
  
  // Core configuration
  viewports: z.record(ViewportConfigSchema).describe('Viewport configurations keyed by viewport ID'),
  testCases: z.array(TestCaseConfigSchema).describe('List of test cases to run'),
  
  // Global options (can be overridden per test case)
  captureOptions: CaptureOptionsSchema.describe('Global capture options'),
  compareOptions: CompareOptionsSchema.describe('Global compare options'),
  retry: z.number().int().min(0).max(10).optional().describe('Default number of retries for all test cases (default: 0)'),
  
  // Additional options
  calibrationOptions: CalibrationOptionsSchema.describe('Calibration settings for initial setup'),
  browserOptions: BrowserOptionsSchema.describe('Browser launch options'),
  outputOptions: OutputOptionsSchema.describe('Output format and filtering options'),
});

// Export types
export type ViewportConfig = z.infer<typeof ViewportConfigSchema>;
export type TestCaseConfig = z.infer<typeof TestCaseConfigSchema>;
export type ViscConfig = z.infer<typeof ViscConfigSchema>;
export type CaptureOptions = z.infer<typeof CaptureOptionsSchema>;
export type CompareOptions = z.infer<typeof CompareOptionsSchema>;
export type CalibrationOptions = z.infer<typeof CalibrationOptionsSchema>;
export type BrowserOptions = z.infer<typeof BrowserOptionsSchema>;
export type OutputOptions = z.infer<typeof OutputOptionsSchema>;

// Validation function
export function validateConfig(config: unknown): ViscConfig {
  return ViscConfigSchema.parse(config);
}

// Safe validation function
export function safeValidateConfig(config: unknown): { success: true; data: ViscConfig } | { success: false; error: z.ZodError } {
  const result = ViscConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}