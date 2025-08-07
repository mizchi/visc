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
import { compareVisualNodeGroups } from "./layout/visual-comparator.js";
import type { ThresholdConfig } from "./types.js";
import { evaluateThresholds } from "./threshold-evaluator.js";

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
  screenshotPath?: string;
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
    thresholdEvaluation?: ReturnType<typeof evaluateThresholds>; // New: threshold evaluation results
  };
  currentLayout?: VisualTreeAnalysis; // For semantic detection
  previousLayout?: VisualTreeAnalysis; // For semantic detection
  screenshotPaths?: {
    expected?: string;
    actual?: string;
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
  overrides?: Record<string, string>;
  networkBlocks?: string[];
  onStateChange?: (state: 'requesting' | 'waiting-lcp' | 'extracting' | 'completed') => void;
  
  // Additional options for captureLayoutMatrix
  requestOverrides?: Record<string, {
    status?: number;
    headers?: Record<string, string>;
    body?: string;
  }>;
  waitForNavigation?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  timeout?: number;
  executeScript?: string;
  waitForContent?: boolean;
  captureFullPage?: boolean;
  
  // Screenshot options
  saveScreenshots?: boolean;
  screenshotFormat?: 'png' | 'jpeg';
  screenshotQuality?: number; // 0-100 for JPEG
  screenshotDir?: string;
};

export type CompareOptions = {
  ignoreText?: boolean;
  threshold?: number;
  similarityThreshold?: number;
  useVisualGroups?: boolean;
  thresholdConfig?: ThresholdConfig; // New: absolute threshold configuration
};

// Default options
const DEFAULT_COMPARE_OPTIONS: Required<CompareOptions> = {
  ignoreText: true,
  threshold: 5,
  similarityThreshold: 98,
  useVisualGroups: true,
  thresholdConfig: undefined as any, // Will be set when used
};

// Capture layouts for all test cases
export async function* captureLayouts(
  testCases: TestCase[],
  viewports: Record<string, Viewport>,
  browser: Browser,
  previousResults: Map<string, Map<string, VisualTreeAnalysis>>,
  options: CaptureOptions & { forceUpdate?: boolean } = {}
): AsyncGenerator<CaptureResult, void, unknown> {
  for (const testCase of testCases) {
    const page = await browser.newPage();
    
    try {
      const previousLayouts = previousResults.get(testCase.id);
      
      // Check if we need to capture any viewport for this test case
      const viewportsToCapture: Record<string, Viewport> = {};
      const cachedLayouts: Array<{ key: string; layout: VisualTreeAnalysis }> = [];
      
      for (const [viewportKey, viewport] of Object.entries(viewports)) {
        const previousLayout = previousLayouts?.get(viewportKey);
        
        // Use cached layout if available and not forced to update
        if (previousLayout && !options.forceUpdate) {
          cachedLayouts.push({ key: viewportKey, layout: previousLayout });
        } else {
          viewportsToCapture[viewportKey] = viewport;
        }
      }
      
      // Yield cached layouts immediately
      for (const { key, layout } of cachedLayouts) {
        yield {
          testCase,
          viewport: viewports[key],
          layout,
        };
      }
      
      // If there are viewports to capture, capture them all at once
      if (Object.keys(viewportsToCapture).length > 0) {
        const capturedLayouts = await captureLayoutMatrix(page, testCase.url, viewportsToCapture, options);
        
        for (const [viewportKey, layout] of capturedLayouts.entries()) {
          yield {
            testCase,
            viewport: viewports[viewportKey],
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
        // Use visual group comparison if enabled and available
        let comparison;
        let differences = 0;
        let addedElements = 0;
        let removedElements = 0;
        
        if (opts.useVisualGroups && previousLayout.visualNodeGroups && currentLayout.visualNodeGroups) {
          // Use semantic group-based comparison (more stable and meaningful)
          // This compares visual groups rather than individual elements
          const groupComparison = compareVisualNodeGroups(previousLayout, currentLayout);
          comparison = groupComparison;
          differences = groupComparison.differences.length;
          addedElements = groupComparison.addedGroups.length;
          removedElements = groupComparison.removedGroups.length;
        } else {
          // Fall back to raw element-level comparison
          // This compares individual DOM elements
          comparison = compareLayoutTrees(previousLayout, currentLayout, {
            threshold: opts.threshold,
            ignoreText: opts.ignoreText,
            ignoreElements: [],
          });
          differences = comparison.differences.length;
          addedElements = comparison.addedElements.length;
          removedElements = comparison.removedElements.length;
        }

        // Evaluate against thresholds if configured
        let thresholdEvaluation;
        // Convert similarity threshold to percentage if needed (0-1 to 0-100)
        const similarityThresholdPercent = opts.similarityThreshold <= 1 
          ? opts.similarityThreshold * 100 
          : opts.similarityThreshold;
        let hasIssues = comparison.similarity < similarityThresholdPercent;
        
        if (opts.thresholdConfig) {
          // Convert comparison differences to VisualDifference format for evaluation
          const visualDifferences: any[] = [];
          
          // Check if it's a group comparison result
          const groupComparison = comparison as any;
          if (groupComparison.addedGroups) {
            groupComparison.addedGroups.forEach((group: any) => {
              visualDifferences.push({ type: 'added' as const, path: '', element: group });
            });
          }
          if (groupComparison.removedGroups) {
            groupComparison.removedGroups.forEach((group: any) => {
              visualDifferences.push({ type: 'removed' as const, path: '', previousElement: group });
            });
          }
          if (groupComparison.differences) {
            groupComparison.differences.forEach((diff: any) => {
              visualDifferences.push({
                type: (diff.type || 'modified') as any,
                path: '',
                element: diff.group || diff.element,
                positionDiff: diff.positionDiff,
                sizeDiff: diff.sizeDiff,
                similarity: diff.similarity
              });
            });
          }
          
          thresholdEvaluation = evaluateThresholds(
            opts.thresholdConfig,
            visualDifferences,
            comparison.similarity,
            currentLayout,
            previousLayout
          );
          
          // Override hasIssues based on threshold evaluation
          hasIssues = hasIssues || !thresholdEvaluation.passed;
        }
        
        const comparisonResult: ComparisonResult = {
          testCase,
          viewport,
          comparison: {
            similarity: comparison.similarity,
            differences,
            addedElements,
            removedElements,
            hasIssues,
            raw: comparison,
            thresholdEvaluation,
          },
          currentLayout,
          previousLayout,
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

  // Set up request interception if overrides or networkBlocks are provided
  const needsInterception = (options.overrides && Object.keys(options.overrides).length > 0) || 
                          (options.networkBlocks && options.networkBlocks.length > 0);
  
  if (needsInterception) {
    // Pre-import modules to avoid async issues
    const fs = await import('fs/promises');
    const path = await import('path');
    
    await page.setRequestInterception(true);
    
    page.on('request', async (request) => {
      const url = request.url();
      
      try {
        // Check if URL should be blocked
        if (options.networkBlocks) {
          for (const blockPattern of options.networkBlocks) {
            const escapedPattern = blockPattern
              .replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*')
              .replace(/\?/g, '.');
            const regex = new RegExp(escapedPattern);
            
            if (regex.test(url)) {
              await request.abort();
              return;
            }
          }
        }
        
        // Check if URL matches any override pattern
        if (options.overrides) {
          for (const [pattern, replacement] of Object.entries(options.overrides)) {
            // Convert glob pattern to regex
            // Escape special regex characters except * and ?
            const escapedPattern = pattern
              .replace(/[.+^${}()|[\]\\]/g, '\\$&')
              .replace(/\*/g, '.*')
              .replace(/\?/g, '.');
            const regex = new RegExp(escapedPattern);
            
            if (regex.test(url)) {
              // If replacement is a local file path, read and respond with its content
              if (replacement.startsWith('./') || replacement.startsWith('/')) {
                try {
                  const content = await fs.readFile(path.resolve(replacement), 'utf-8');
                  const contentType = replacement.endsWith('.css') ? 'text/css' : 
                                     replacement.endsWith('.js') ? 'application/javascript' : 
                                     'text/plain';
                  
                  await request.respond({
                    status: 200,
                    contentType,
                    body: content,
                  });
                  return;
                } catch (error) {
                  console.error(`Failed to read override file ${replacement}:`, error);
                  // Fall through to continue normally
                }
              } else {
                // Redirect to another URL
                await request.continue({ url: replacement });
                return;
              }
            }
          }
        }
        
        // Continue normally if no override matches
        await request.continue();
      } catch (error) {
        // If there's any error, try to continue the request
        try {
          await request.continue();
        } catch (continueError) {
          // Request was already handled, ignore
        }
      }
    });
  }

  // Notify state: requesting
  options.onStateChange?.('requesting');
  
  // Use provided waitUntil option or default to networkidle2
  try {
    await page.goto(url, { 
      waitUntil: options.waitUntil || "networkidle2",
      timeout: options.timeout || 30000
    });
  } catch (error: any) {
    // Handle navigation timeout errors but continue with data extraction
    if (error.name === 'TimeoutError') {
      console.warn(`Navigation timeout for ${url}, continuing with data extraction...`);
    } else {
      // Re-throw non-timeout errors
      throw error;
    }
  }
  
  // Notify state: waiting-lcp
  options.onStateChange?.('waiting-lcp');
  
  // Wait for LCP by default (unless explicitly disabled)
  if (options.waitForLCP !== false) {
    try {
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
    } catch (error) {
      console.warn('Failed to wait for LCP, continuing...', error);
    }
  }
  
  // Additional wait time if specified
  const additionalWait = options.additionalWait !== undefined ? options.additionalWait : 500;
  await new Promise((resolve) => setTimeout(resolve, additionalWait));

  // Notify state: extracting
  options.onStateChange?.('extracting');

  try {
    const rawData = await fetchRawLayoutData(page);
    const layout = await extractLayoutTree(rawData, {
      viewportOnly: !options.captureFullPage, // Use fullPage option to control viewport
      groupingThreshold: 20,
      importanceThreshold: 10,
    });

    // Notify state: completed
    options.onStateChange?.('completed');

    return layout;
  } catch (error) {
    console.error('Failed to extract layout data:', error);
    // Return a minimal layout structure to allow the process to continue
    options.onStateChange?.('completed');
    return {
      url: url,
      timestamp: new Date().toISOString(),
      elements: [],
      statistics: {
        totalElements: 0,
        visibleElements: 0,
        interactiveElements: 0,
        textElements: 0,
        imageElements: 0,
        averageDepth: 0,
        maxDepth: 0
      },
      viewport: {
        width: viewport.width,
        height: viewport.height,
        scrollX: 0,
        scrollY: 0
      },
      visualNodeGroups: []
    };
  }
}

/**
 * Capture layouts for multiple viewports in a single browser session
 * More efficient than calling captureLayout multiple times
 */
export async function captureLayoutMatrix(
  page: Page,
  url: string,
  viewports: Record<string, Viewport>,
  options: CaptureOptions = {}
): Promise<Map<string, VisualTreeAnalysis>> {
  const results = new Map<string, VisualTreeAnalysis>();
  
  // Prepare viewport data for the matrix function
  const viewportArray = Object.entries(viewports).map(([key, viewport]) => ({
    key,
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    userAgent: viewport.userAgent,
  }));

  // Request interception is already handled in captureLayout function
  // No need to set up additional interception here

  // Navigate to URL
  try {
    await page.goto(url, {
      waitUntil: options.waitForNavigation || options.waitUntil || "networkidle2",
      timeout: options.timeout || 30000,
    });
  } catch (error: any) {
    // Handle navigation timeout errors but continue with data extraction
    if (error.name === 'TimeoutError') {
      console.warn(`Navigation timeout for ${url}, continuing with data extraction...`);
    } else {
      // Re-throw non-timeout errors
      throw error;
    }
  }

  // Execute any custom script if provided
  if (options.executeScript) {
    await page.evaluate(options.executeScript);
  }

  // Capture layout data for all viewports
  try {
    const { fetchRawLayoutDataViewportMatrix } = await import("./browser/puppeteer.js");
    const rawDataMap = await fetchRawLayoutDataViewportMatrix(page, viewportArray, {
      waitForContent: options.waitForContent,
      captureFullPage: options.captureFullPage,
    });

    // Process each viewport's raw data
    for (const [key, rawData] of rawDataMap.entries()) {
      try {
        const layout = await extractLayoutTree(rawData, {
          viewportOnly: !options.captureFullPage, // Use fullPage option to control viewport
          groupingThreshold: 20,
          importanceThreshold: 10,
        });
        results.set(key, layout);
      } catch (error) {
        console.error(`Failed to extract layout for viewport ${key}:`, error);
        // Set a minimal layout structure for this viewport
        const viewport = viewports[key];
        results.set(key, {
          url: url,
          timestamp: new Date().toISOString(),
          elements: [],
          statistics: {
            totalElements: 0,
            visibleElements: 0,
            interactiveElements: 0,
            textElements: 0,
            imageElements: 0,
            averageDepth: 0,
            maxDepth: 0
          },
          viewport: {
            width: viewport.width,
            height: viewport.height,
            scrollX: 0,
            scrollY: 0
          },
          visualNodeGroups: []
        });
      }
    }
  } catch (error) {
    console.error('Failed to capture layout data:', error);
    // Return empty results for all viewports
    for (const [key, viewport] of Object.entries(viewports)) {
      results.set(key, {
        url: url,
        timestamp: new Date().toISOString(),
        elements: [],
        statistics: {
          totalElements: 0,
          visibleElements: 0,
          interactiveElements: 0,
          textElements: 0,
          imageElements: 0,
          averageDepth: 0,
          maxDepth: 0
        },
        viewport: {
          width: viewport.width,
          height: viewport.height,
          scrollX: 0,
          scrollY: 0
        },
        visualNodeGroups: []
      });
    }
  }

  return results;
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