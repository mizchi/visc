/**
 * Configuration types for visc check command
 */

export type ViewportConfig = {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  userAgent?: string;
};

export type TestCaseConfig = {
  id: string;
  url: string;
  description?: string;
  // Override capture options for specific test case
  captureOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    waitForLCP?: boolean;
    additionalWait?: number;
    timeout?: number;
    overrides?: Record<string, string>;
    networkBlocks?: string[];
  };
  // Override compare options for specific test case
  compareOptions?: {
    ignoreText?: boolean;
    threshold?: number;
    similarityThreshold?: number;
    overrides?: Record<string, string>;
    networkBlocks?: string[];
    useVisualGroups?: boolean;
  };
};

export type ViscConfig = {
  // Version for future compatibility
  version?: string;

  // Cache directory (default: .visc/cache)
  cacheDir?: string;

  // Output directory for results (default: .visc/output)
  outputDir?: string;

  // Viewports to test
  viewports: Record<string, ViewportConfig>;

  // Test cases
  testCases: TestCaseConfig[];

  // Global capture options (can be overridden per test case)
  captureOptions?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    waitForLCP?: boolean;
    additionalWait?: number;
    timeout?: number;
    overrides?: Record<string, string>;
    networkBlocks?: string[];
  };

  // Global compare options (can be overridden per test case)
  compareOptions?: {
    ignoreText?: boolean;
    threshold?: number;
    similarityThreshold?: number;
    overrides?: Record<string, string>;
    networkBlocks?: string[];
    useVisualGroups?: boolean; // Use visual group comparison instead of element-level
  };

  // Calibration options for initial setup
  calibrationOptions?: {
    enabled?: boolean; // Enable auto-calibration on first run
    samples?: number; // Number of samples to take for calibration (default: 3)
    strictness?: "low" | "medium" | "high"; // Calibration strictness
  };

  // Browser options
  browserOptions?: {
    headless?: boolean;
    args?: string[];
  };
};

// Default config values
export const DEFAULT_CONFIG: Partial<ViscConfig> = {
  version: "1.0",
  cacheDir: ".visc/cache",
  outputDir: ".visc/output",
  captureOptions: {
    waitUntil: "networkidle2",
    waitForLCP: true,
    additionalWait: 500,
    timeout: 30000,
  },
  compareOptions: {
    ignoreText: true,
    threshold: 5,
    similarityThreshold: 98,
    useVisualGroups: true,
  },
  calibrationOptions: {
    enabled: true,
    samples: 3,
    strictness: "medium",
  },
  browserOptions: {
    headless: true,
  },
};
