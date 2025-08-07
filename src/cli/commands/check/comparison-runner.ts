/**
 * Comparison runner for visual regression tests
 * Handles layout comparison and difference detection
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import type { ViscConfig } from "../../config.js";
import { CacheStorage } from "../../cache-storage.js";
import { getEffectiveCaptureOptions, getEffectiveCompareOptions, logMergedOptions } from "../../../config/merge.js";
import type { CaptureResult, TestResult } from "../../../workflow.js";
import { captureLayout, compareLayouts, collectCaptures } from "../../../workflow.js";
import type { VisualTreeAnalysis } from "../../../types.js";
import { executeWithConcurrency, renderProgressBar, clearLine, log } from "./utils.js";
import { EnhancedProgressDisplay } from "../../ui/enhanced-progress.js";

export interface CompareOptions {
  parallelConcurrency?: number;
  interval?: number;
  onlyFailed?: boolean;
}

interface CompareContext {
  log: (message: string) => void;
  progressDisplay: EnhancedProgressDisplay | null;
  renderProgressBar: (current: number, total: number, label?: string) => void;
  clearLine: () => void;
}

/**
 * Run comparison phase for all test cases
 * @param config Configuration for the visual regression tests
 * @param storage Cache storage instance
 * @param previousResults Previous baseline layouts
 * @param options Comparison options
 * @param context Comparison context with logging and progress display
 */
export async function runCompare(
  config: ViscConfig,
  storage: CacheStorage,
  previousResults: Map<string, Map<string, VisualTreeAnalysis>>,
  options: CompareOptions = {},
  context: CompareContext
): Promise<TestResult[]> {
  const { log: contextLog, progressDisplay, renderProgressBar: contextRenderProgress, clearLine: contextClearLine } = context;
  
  contextLog(`📊 Compare Phase\n`);

  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;
  const totalSteps = config.testCases.length * Object.keys(viewports).length;
  const parallelConcurrency = options.parallelConcurrency || 1;
  const interval = options.interval || 300;

  // Capture fresh layouts for comparison
  const captures = await captureFreshLayouts(
    config,
    storage,
    {
      parallelConcurrency,
      interval,
      totalSteps
    },
    context
  );

  const currentLayouts = collectCaptures(captures, viewports);

  // Process comparisons
  const results = await processComparisons(
    config,
    storage,
    currentLayouts,
    previousResults,
    options,
    {
      totalSteps,
      viewports
    },
    context
  );

  return results;
}

/**
 * Capture fresh layouts for comparison
 */
async function captureFreshLayouts(
  config: ViscConfig,
  storage: CacheStorage,
  options: {
    parallelConcurrency: number;
    interval: number;
    totalSteps: number;
  },
  context: CompareContext
): Promise<CaptureResult[]> {
  const { log: contextLog, renderProgressBar: contextRenderProgress, clearLine: contextClearLine } = context;
  const { parallelConcurrency, interval, totalSteps } = options;
  
  const browser = await puppeteer.launch(config.browserOptions);
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;
  const captures: CaptureResult[] = [];
  let currentStep = 0;

  contextLog(
    `Capturing current layouts${
      parallelConcurrency > 1 ? ` (parallel: ${parallelConcurrency})` : ""
    }${
      parallelConcurrency === 1 && interval > 0
        ? ` (interval: ${interval}ms)`
        : ""
    }...\n`
  );

  try {
    if (parallelConcurrency === 1) {
      // Sequential capture
      const result = await captureSequential(
        config,
        browser,
        storage,
        { interval, currentStep, totalSteps },
        context
      );
      captures.push(...result.captures);
      currentStep = result.currentStep;
    } else {
      // Parallel capture
      const result = await captureParallel(
        config,
        browser,
        storage,
        parallelConcurrency,
        context
      );
      captures.push(...result);
      currentStep = totalSteps;
      contextRenderProgress(currentStep, totalSteps, "");
    }

    contextClearLine();
    contextLog(`✅ Captured ${captures.length} current layouts\n`);
  } finally {
    await browser.close();
  }

  return captures;
}

/**
 * Sequential capture for comparison
 */
async function captureSequential(
  config: ViscConfig,
  browser: Browser,
  storage: CacheStorage,
  options: {
    interval: number;
    currentStep: number;
    totalSteps: number;
  },
  context: CompareContext
): Promise<{ captures: CaptureResult[]; currentStep: number }> {
  const { renderProgressBar: contextRenderProgress } = context;
  const captures: CaptureResult[] = [];
  let { currentStep } = options;
  const { interval, totalSteps } = options;
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;

  for (const testCase of config.testCases) {
    const page = await browser.newPage();

    try {
      const captureOptions = {
        ...getEffectiveCaptureOptions(
          testCase,
          config.captureOptions,
          config.compareOptions as any
        ),
        forceUpdate: true
      };
      logMergedOptions(testCase.id, captureOptions, 'capture');

      for (const [, viewport] of Object.entries(viewports)) {
        currentStep++;
        const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
        contextRenderProgress(currentStep, totalSteps, label);

        const layout = await captureWithErrorHandling(
          page,
          testCase,
          viewport,
          captureOptions
        );

        await storage.writeSnapshot(testCase.id, viewport, layout, "current");
        captures.push({ testCase, viewport, layout });

        if (interval > 0 && currentStep < totalSteps) {
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      }
    } finally {
      await page.close();
    }
  }

  return { captures, currentStep };
}

/**
 * Parallel capture for comparison
 */
async function captureParallel(
  config: ViscConfig,
  browser: Browser,
  storage: CacheStorage,
  parallelConcurrency: number,
  context: CompareContext
): Promise<CaptureResult[]> {
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;
  const tasks: Array<() => Promise<CaptureResult[]>> = [];

  for (const testCase of config.testCases) {
    tasks.push(async () => {
      const taskCaptures: CaptureResult[] = [];
      const page = await browser.newPage();

      try {
        const captureOptions = {
          ...getEffectiveCaptureOptions(
            testCase,
            config.captureOptions,
            config.compareOptions as any
          ),
          forceUpdate: true
        };
        logMergedOptions(testCase.id, captureOptions, 'capture');

        for (const [, viewport] of Object.entries(viewports)) {
          const layout = await captureWithErrorHandling(
            page,
            testCase,
            viewport,
            captureOptions
          );

          await storage.writeSnapshot(testCase.id, viewport, layout, "current");
          taskCaptures.push({ testCase, viewport, layout });
        }
      } finally {
        await page.close();
      }

      return taskCaptures;
    });
  }

  const results = await executeWithConcurrency(tasks, parallelConcurrency);
  return results.flat();
}

/**
 * Capture layout with error handling
 */
async function captureWithErrorHandling(
  page: Page,
  testCase: any,
  viewport: any,
  captureOptions: any
): Promise<VisualTreeAnalysis> {
  try {
    return await captureLayout(page, testCase.url, viewport, captureOptions);
  } catch (error: any) {
    console.error(
      `⚠️ Error capturing ${testCase.id} @ ${viewport.width}x${viewport.height}: ${error.message}`
    );
    
    // Return empty layout on error
    return {
      url: testCase.url,
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
 * Process layout comparisons
 */
async function processComparisons(
  config: ViscConfig,
  storage: CacheStorage,
  currentLayouts: Map<string, Map<string, VisualTreeAnalysis>>,
  previousResults: Map<string, Map<string, VisualTreeAnalysis>>,
  options: CompareOptions,
  metadata: {
    totalSteps: number;
    viewports: Record<string, any>;
  },
  context: CompareContext
): Promise<TestResult[]> {
  const { log: contextLog, renderProgressBar: contextRenderProgress, clearLine: contextClearLine } = context;
  const { totalSteps, viewports } = metadata;
  const results: TestResult[] = [];
  let currentStep = 0;

  contextLog(`Comparing layouts...\n`);

  // Load calibration data if available
  const calibrationData = await storage.readCalibration();

  for (const testCase of config.testCases) {
    // Get compare options with calibration
    const compareOptions = await getCompareOptionsWithCalibration(
      testCase,
      config,
      calibrationData
    );

    const testCurrentLayouts = new Map();
    testCurrentLayouts.set(testCase.id, currentLayouts.get(testCase.id));

    const testPreviousLayouts = new Map();
    testPreviousLayouts.set(testCase.id, previousResults.get(testCase.id));

    for await (const result of compareLayouts(
      [testCase],
      viewports,
      testCurrentLayouts,
      testPreviousLayouts,
      compareOptions
    )) {
      if ("comparison" in result) {
        currentStep++;
        const { testCase, viewport, comparison } = result;

        const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
        contextRenderProgress(
          currentStep,
          totalSteps,
          `${label} (${comparison.similarity.toFixed(0)}%)`
        );

        // Save comparison results
        await saveComparisonResults(
          storage,
          testCase,
          viewport,
          comparison,
          viewports,
          previousResults,
          currentLayouts,
          options
        );
      } else {
        results.push(result);
      }
    }
  }

  contextClearLine();
  contextLog(`✅ Compared ${currentStep} layouts\n`);

  return results;
}

/**
 * Get compare options with calibration settings
 */
async function getCompareOptionsWithCalibration(
  testCase: any,
  config: ViscConfig,
  calibrationData: any
): Promise<any> {
  let compareOptions = getEffectiveCompareOptions(
    testCase,
    config.compareOptions,
    config.compareOptions
  ) || {};
  
  logMergedOptions(testCase.id, compareOptions, 'compare');
  
  // Apply calibration settings if available
  if (calibrationData?.results && compareOptions?.useVisualGroups) {
    const testCalibration = calibrationData.results[testCase.id];
    if (testCalibration) {
      const viewportKey = Object.keys(testCalibration)[0];
      const calibrationSettings = testCalibration[viewportKey]?.settings;
      
      if (calibrationSettings) {
        console.log(
          `  🔧 Using calibrated thresholds for ${testCase.id} (confidence: ${testCalibration[viewportKey].confidence}%)`
        );
        compareOptions = {
          ...compareOptions,
          threshold: calibrationSettings.positionTolerance || compareOptions.threshold,
          similarityThreshold: calibrationSettings.minSimilarity || compareOptions.similarityThreshold,
        };
      }
    }
  }

  return compareOptions;
}

/**
 * Save comparison results to storage
 */
async function saveComparisonResults(
  storage: CacheStorage,
  testCase: any,
  viewport: any,
  comparison: any,
  viewports: Record<string, any>,
  previousResults: Map<string, Map<string, VisualTreeAnalysis>>,
  currentLayouts: Map<string, Map<string, VisualTreeAnalysis>>,
  options: CompareOptions
): Promise<void> {
  const viewportKey = Object.keys(viewports).find(
    (key) => viewports[key] === viewport
  );
  
  const previousLayout = previousResults.get(testCase.id)?.get(viewportKey!);
  const currentLayout = currentLayouts.get(testCase.id)?.get(viewportKey!);

  if (previousLayout && currentLayout) {
    await storage.writeComparison(
      testCase.id,
      viewport,
      comparison.raw,
      previousLayout,
      currentLayout,
      { onlyFailed: options.onlyFailed }
    );
  }
}