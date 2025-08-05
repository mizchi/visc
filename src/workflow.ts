/**
 * High-level workflow utilities for visual testing
 * Pure functions that generate results without side effects
 */

import type { Page, Browser } from "puppeteer";
import {
  type VisualTreeAnalysis,
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
} from "./index.js";

// Types
export type Viewport = {
  name: string;
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
};

export type TestCase = {
  id: string;
  url: string;
  description?: string;
};

export type CaptureResult = {
  testCase: TestCase;
  viewport: Viewport;
  layout: VisualTreeAnalysis;
};

export type ComparisonResult = {
  testCase: TestCase;
  viewport: Viewport;
  comparison: {
    similarity: number;
    differences: number;
    addedElements: number;
    removedElements: number;
    hasIssues: boolean;
    raw: any;
  };
};

export type TestResult = {
  testCase: TestCase;
  captures: CaptureResult[];
  comparisons: ComparisonResult[];
  hasIssues: boolean;
};

export type CaptureOptions = {
  forceUpdate?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  waitForLCP?: boolean;
  additionalWait?: number; // Additional wait time after LCP in milliseconds
};

export type CompareOptions = {
  ignoreText?: boolean;
  threshold?: number;
  similarityThreshold?: number;
};

// Default options
const DEFAULT_COMPARE_OPTIONS: Required<CompareOptions> = {
  ignoreText: true,
  threshold: 5,
  similarityThreshold: 98,
};

// Capture layouts for all test cases
export async function* captureLayouts(
  testCases: TestCase[],
  viewports: Record<string, Viewport>,
  browser: Browser,
  previousResults: Map<string, Map<string, VisualTreeAnalysis>>,
  options: CaptureOptions = {}
): AsyncGenerator<CaptureResult> {
  for (const testCase of testCases) {
    const page = await browser.newPage();
    
    try {
      const previousLayouts = previousResults.get(testCase.id);
      
      for (const [viewportKey, viewport] of Object.entries(viewports)) {
        const previousLayout = previousLayouts?.get(viewportKey);
        
        // Use cached layout if available and not forced to update
        if (previousLayout && !options.forceUpdate) {
          yield {
            testCase,
            viewport,
            layout: previousLayout,
          };
        } else {
          // Capture new layout
          const layout = await captureLayout(page, testCase.url, viewport, options);
          yield {
            testCase,
            viewport,
            layout,
          };
        }
      }
    } finally {
      await page.close();
    }
  }
}

// Compare layouts between previous and current
export async function* compareLayouts(
  testCases: TestCase[],
  viewports: Record<string, Viewport>,
  currentLayouts: Map<string, Map<string, VisualTreeAnalysis>>,
  previousLayouts: Map<string, Map<string, VisualTreeAnalysis>>,
  options: CompareOptions = {}
): AsyncGenerator<ComparisonResult | TestResult> {
  const opts = { ...DEFAULT_COMPARE_OPTIONS, ...options };
  
  for (const testCase of testCases) {
    const currentTestLayouts = currentLayouts.get(testCase.id);
    const previousTestLayouts = previousLayouts.get(testCase.id);
    const comparisons: ComparisonResult[] = [];
    
    if (!currentTestLayouts || !previousTestLayouts) {
      continue;
    }
    
    for (const [viewportKey, viewport] of Object.entries(viewports)) {
      const currentLayout = currentTestLayouts.get(viewportKey);
      const previousLayout = previousTestLayouts.get(viewportKey);
      
      if (currentLayout && previousLayout) {
        const comparison = compareLayoutTrees(previousLayout, currentLayout, {
          threshold: opts.threshold,
          ignoreText: opts.ignoreText,
          ignoreElements: [],
        });

        const hasIssues = comparison.similarity < opts.similarityThreshold;
        const comparisonResult: ComparisonResult = {
          testCase,
          viewport,
          comparison: {
            similarity: comparison.similarity,
            differences: comparison.differences.length,
            addedElements: comparison.addedElements.length,
            removedElements: comparison.removedElements.length,
            hasIssues,
            raw: comparison,
          },
        };
        
        comparisons.push(comparisonResult);
        yield comparisonResult;
      }
    }
    
    // Yield test result after all comparisons for this test
    if (comparisons.length > 0) {
      const testResult: TestResult = {
        testCase,
        captures: [],
        comparisons,
        hasIssues: comparisons.some(c => c.comparison.hasIssues),
      };
      yield testResult;
    }
  }
}

// Pure function to capture layout
export async function captureLayout(
  page: Page,
  url: string,
  viewport: Viewport,
  options: CaptureOptions = {}
): Promise<VisualTreeAnalysis> {
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
  });
  await page.setUserAgent(viewport.userAgent);

  // Use provided waitUntil option or default to networkidle0
  await page.goto(url, { waitUntil: options.waitUntil || "networkidle0" });
  
  // Wait for LCP by default (unless explicitly disabled)
  if (options.waitForLCP !== false) {
    await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Fallback if LCP doesn't fire within 15 seconds
        setTimeout(resolve, 15000);
      });
    });
  }
  
  // Additional wait time if specified
  const additionalWait = options.additionalWait || 1000;
  await new Promise((resolve) => setTimeout(resolve, additionalWait));

  const rawData = await fetchRawLayoutData(page);
  const layout = await extractLayoutTree(rawData, {
    viewportOnly: true,
    groupingThreshold: 20,
    importanceThreshold: 10,
  });

  return layout;
}

// Helper to collect captures into a map
export function collectCaptures(
  captures: CaptureResult[],
  viewports: Record<string, Viewport>
): Map<string, Map<string, VisualTreeAnalysis>> {
  const result = new Map<string, Map<string, VisualTreeAnalysis>>();
  
  for (const capture of captures) {
    let testMap = result.get(capture.testCase.id);
    if (!testMap) {
      testMap = new Map();
      result.set(capture.testCase.id, testMap);
    }
    
    // Find the viewport key by matching width and height
    const viewportKey = Object.keys(viewports).find(key => 
      viewports[key].width === capture.viewport.width && 
      viewports[key].height === capture.viewport.height
    );
    
    if (viewportKey) {
      testMap.set(viewportKey, capture.layout);
    }
  }
  
  return result;
}

// Helper function to generate summary
export function generateSummary(results: TestResult[]): {
  timestamp: string;
  totalTests: number;
  completedTests: number;
  testsWithIssues: number;
  results: Array<{
    id: string;
    url: string;
    description?: string;
    hasIssues: boolean;
    captureCount: number;
    comparisonCount: number;
  }>;
} {
  return {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    completedTests: results.length,
    testsWithIssues: results.filter(r => r.hasIssues).length,
    results: results.map(r => ({
      id: r.testCase.id,
      url: r.testCase.url,
      description: r.testCase.description,
      hasIssues: r.hasIssues,
      captureCount: r.captures.length,
      comparisonCount: r.comparisons.length,
    })),
  };
}