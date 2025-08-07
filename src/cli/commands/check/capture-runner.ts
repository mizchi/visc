/**
 * Capture runner for visual regression tests
 * Handles screenshot capture and layout extraction
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import type { ViscConfig } from "../../config.js";
import { CacheStorage } from "../../cache-storage.js";
import { getEffectiveCaptureOptions, getEffectiveRetryCount, logMergedOptions } from "../../../config/merge.js";
import type { CaptureResult, TestResult } from "../../../workflow.js";
import { captureLayout, captureLayoutMatrix } from "../../../workflow.js";
import { EnhancedProgressDisplay } from "../../ui/enhanced-progress.js";
import { executeWithConcurrency, executeWithRetry } from "./utils.js";

export interface CaptureOptions {
  forceUpdate?: boolean;
  parallelConcurrency?: number;
  interval?: number;
  retry?: number;
}

interface CaptureContext {
  log: (message: string) => void;
  progressDisplay: EnhancedProgressDisplay | null;
  renderProgressBar: (current: number, total: number, label?: string) => void;
  clearLine: () => void;
}

/**
 * Run capture phase for all test cases
 * @param config Configuration for the visual regression tests
 * @param storage Cache storage instance
 * @param options Capture options
 * @param context Capture context with logging and progress display
 */
export async function runCapture(
  config: ViscConfig,
  storage: CacheStorage,
  options: CaptureOptions,
  context: CaptureContext
): Promise<CaptureResult[]> {
  const { log, progressDisplay, renderProgressBar, clearLine } = context;
  const browser = await puppeteer.launch(config.browserOptions);
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;
  
  try {
    const previousResults = options.forceUpdate
      ? new Map()
      : await storage.loadAllBaselines(config.testCases, viewports);

    const captures: CaptureResult[] = [];
    const totalSteps = config.testCases.length * Object.keys(config.viewports).length;
    let currentStep = 0;
    const parallelConcurrency = options.parallelConcurrency || 1;
    const interval = options.interval || 300;

    // Display phase information
    displayPhaseInfo(progressDisplay, parallelConcurrency, interval);

    // Initialize tasks for TUI mode
    if (progressDisplay) {
      initializeProgressTasks(config, viewports, progressDisplay);
    }

    if (parallelConcurrency === 1) {
      // Sequential execution
      const result = await captureSequential(
        config, 
        browser, 
        storage, 
        previousResults, 
        options, 
        { 
          currentStep, 
          totalSteps, 
          interval,
          log,
          progressDisplay,
          renderProgressBar 
        }
      );
      captures.push(...result.captures);
      currentStep = result.currentStep;
    } else {
      // Parallel execution
      const result = await captureParallel(
        config,
        browser,
        storage,
        previousResults,
        options,
        parallelConcurrency,
        { log, progressDisplay }
      );
      captures.push(...result);
      currentStep = totalSteps;
      renderProgressBar(currentStep, totalSteps, "");
    }

    clearLine();
    const message = `✅ Captured ${captures.length} layouts`;
    if (progressDisplay) {
      progressDisplay.log(message);
    } else {
      console.log(`${message}\n`);
    }

    return captures;
  } finally {
    await browser.close();
  }
}

/**
 * Display phase information
 */
function displayPhaseInfo(
  progressDisplay: EnhancedProgressDisplay | null,
  parallelConcurrency: number,
  interval: number
) {
  const phaseInfo = `Capture Phase${
    parallelConcurrency > 1 ? ` (parallel: ${parallelConcurrency})` : ""
  }${
    parallelConcurrency === 1 && interval > 0 ? ` (interval: ${interval}ms)` : ""
  }`;

  if (progressDisplay) {
    progressDisplay.setPhase(phaseInfo, '📥');
  } else {
    console.log(`📥 ${phaseInfo}\n`);
  }
}

/**
 * Initialize progress tasks for TUI mode
 */
function initializeProgressTasks(
  config: ViscConfig,
  viewports: Record<string, any>,
  progressDisplay: EnhancedProgressDisplay
) {
  for (const testCase of config.testCases) {
    for (const [viewportKey, viewport] of Object.entries(viewports)) {
      const taskId = `${testCase.id}-${viewportKey}`;
      const label = `${testCase.id} @ ${viewport.width}x${viewport.height}`;
      progressDisplay.addTask({
        id: taskId,
        label,
        status: 'pending'
      });
    }
  }
}

/**
 * Sequential capture execution
 */
async function captureSequential(
  config: ViscConfig,
  browser: Browser,
  storage: CacheStorage,
  previousResults: Map<string, Map<string, any>>,
  options: CaptureOptions,
  context: {
    currentStep: number;
    totalSteps: number;
    interval: number;
    log: (message: string) => void;
    progressDisplay: EnhancedProgressDisplay | null;
    renderProgressBar: (current: number, total: number, label?: string) => void;
  }
): Promise<{ captures: CaptureResult[]; currentStep: number }> {
  const captures: CaptureResult[] = [];
  let { currentStep } = context;
  const { totalSteps, interval, log, progressDisplay, renderProgressBar } = context;
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;

  for (const testCase of config.testCases) {
    const page = await browser.newPage();

    try {
      const captureOptions = getEffectiveCaptureOptions(
        testCase,
        config.captureOptions,
        config.captureOptions
      );
      logMergedOptions(testCase.id, captureOptions, 'capture');

      const previousLayouts = previousResults.get(testCase.id);

      // Process cached and new viewports
      const { cachedCaptures, viewportsToCapture } = processCachedViewports(
        viewports,
        previousLayouts,
        testCase,
        options.forceUpdate || false,
        progressDisplay
      );
      
      captures.push(...cachedCaptures);

      // Capture new viewports if needed
      if (Object.keys(viewportsToCapture).length > 0) {
        const newCaptures = await captureViewports(
          page,
          testCase,
          viewportsToCapture,
          captureOptions,
          storage,
          options,
          config,
          {
            currentStep,
            totalSteps,
            log,
            progressDisplay,
            renderProgressBar
          }
        );
        captures.push(...newCaptures.captures);
        currentStep = newCaptures.currentStep;
      } else {
        // Update progress for cached viewports
        currentStep += cachedCaptures.length;
        if (!progressDisplay) {
          renderProgressBar(currentStep, totalSteps, `${testCase.id} (all cached)`);
        }
      }

      // Add interval between test cases
      if (interval > 0 && currentStep < totalSteps) {
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
    } finally {
      await page.close();
    }
  }

  return { captures, currentStep };
}

/**
 * Parallel capture execution
 */
async function captureParallel(
  config: ViscConfig,
  browser: Browser,
  storage: CacheStorage,
  previousResults: Map<string, Map<string, any>>,
  options: CaptureOptions,
  parallelConcurrency: number,
  context: {
    log: (message: string) => void;
    progressDisplay: EnhancedProgressDisplay | null;
  }
): Promise<CaptureResult[]> {
  const { log, progressDisplay } = context;
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;
  const tasks: Array<() => Promise<CaptureResult[]>> = [];

  for (const testCase of config.testCases) {
    tasks.push(async () => {
      const taskCaptures: CaptureResult[] = [];
      const page = await browser.newPage();

      try {
        const captureOptions = getEffectiveCaptureOptions(
          testCase,
          config.captureOptions,
          config.captureOptions
        );
        logMergedOptions(testCase.id, captureOptions, 'capture');

        const previousLayouts = previousResults.get(testCase.id);

        for (const [viewportKey, viewport] of Object.entries(viewports)) {
          const previousLayout = previousLayouts?.get(viewportKey);

          if (previousLayout && !options.forceUpdate) {
            taskCaptures.push({
              testCase,
              viewport,
              layout: previousLayout,
            });
          } else {
            const taskId = `${testCase.id}-${viewportKey}`;
            let layout;
            
            const retryCount = getEffectiveRetryCount(testCase, config.retry) || options.retry || 0;
            
            try {
              layout = await executeWithRetry(
                async () => {
                  return await captureLayout(
                    page,
                    testCase.url,
                    viewport,
                    {
                      ...captureOptions,
                      onStateChange: progressDisplay ? (state) => {
                        progressDisplay?.updateTaskState(taskId, state as any);
                      } : undefined
                    }
                  );
                },
                retryCount,
                (attempt, error) => {
                  log(`⚠️ Retry ${attempt}/${retryCount} for ${testCase.id} @ ${viewport.width}x${viewport.height}: ${error.message}`);
                }
              );
            } catch (error: any) {
              console.error(`⚠️ Error capturing ${testCase.id} @ ${viewport.width}x${viewport.height} after ${retryCount} retries: ${error.message}`);
              layout = createEmptyLayout(testCase.url, viewport);
            }
            
            await storage.writeSnapshot(testCase.id, viewport, layout, "baseline");

            if (options.forceUpdate) {
              await storage.writeOutput(testCase.id, viewport, layout);
            }

            taskCaptures.push({ testCase, viewport, layout });
          }
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
 * Process cached viewports and determine which need capturing
 */
function processCachedViewports(
  viewports: Record<string, any>,
  previousLayouts: Map<string, any> | undefined,
  testCase: any,
  forceUpdate: boolean,
  progressDisplay: EnhancedProgressDisplay | null
) {
  const cachedCaptures: CaptureResult[] = [];
  const viewportsToCapture: Record<string, any> = {};

  for (const [viewportKey, viewport] of Object.entries(viewports)) {
    const previousLayout = previousLayouts?.get(viewportKey);
    const taskId = `${testCase.id}-${viewportKey}`;
    
    if (previousLayout && !forceUpdate) {
      if (progressDisplay) {
        progressDisplay.updateTask(taskId, { 
          status: 'completed', 
          message: 'using cache' 
        });
      }
      cachedCaptures.push({
        testCase,
        viewport,
        layout: previousLayout,
      });
    } else {
      viewportsToCapture[viewportKey] = viewport;
    }
  }

  return { cachedCaptures, viewportsToCapture };
}

/**
 * Capture viewports with error handling
 */
async function captureViewports(
  page: Page,
  testCase: any,
  viewportsToCapture: Record<string, any>,
  captureOptions: any,
  storage: CacheStorage,
  options: CaptureOptions,
  config: ViscConfig,
  context: {
    currentStep: number;
    totalSteps: number;
    log: (message: string) => void;
    progressDisplay: EnhancedProgressDisplay | null;
    renderProgressBar: (current: number, total: number, label?: string) => void;
  }
): Promise<{ captures: CaptureResult[]; currentStep: number }> {
  const captures: CaptureResult[] = [];
  let { currentStep } = context;
  const { totalSteps, log, progressDisplay, renderProgressBar } = context;
  const viewports = config.viewports as Record<string, import("../../../workflow.js").Viewport>;

  let layoutMatrix;
  const retryCount = getEffectiveRetryCount(testCase, config.retry) || options.retry || 0;
  
  try {
    layoutMatrix = await executeWithRetry(
      async () => {
        return await captureLayoutMatrix(
          page,
          testCase.url,
          viewportsToCapture,
          {
            ...captureOptions,
            onStateChange: progressDisplay ? (state) => {
              for (const viewportKey of Object.keys(viewportsToCapture)) {
                const taskId = `${testCase.id}-${viewportKey}`;
                progressDisplay?.updateTaskState(taskId, state as any);
              }
            } : undefined
          }
        );
      },
      retryCount,
      (attempt, error) => {
        log(`⚠️ Retry ${attempt}/${retryCount} for ${testCase.id}: ${error.message}`);
      }
    );
  } catch (error: any) {
    console.error(`⚠️ Error capturing layouts for ${testCase.id} after ${retryCount} retries: ${error.message}`);
    layoutMatrix = new Map();
    for (const [viewportKey, viewport] of Object.entries(viewportsToCapture)) {
      layoutMatrix.set(viewportKey, createEmptyLayout(testCase.url, viewport));
    }
  }
  
  for (const [viewportKey, layout] of layoutMatrix.entries()) {
    const viewport = viewports[viewportKey];
    const taskId = `${testCase.id}-${viewportKey}`;
    currentStep++;
    
    const action = options.forceUpdate ? "updating baseline" : "creating baseline";
    const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
    
    if (progressDisplay) {
      progressDisplay.startTask(taskId, action);
    } else {
      renderProgressBar(currentStep, totalSteps, `${label} (${action}...)`);
    }
    
    await storage.writeSnapshot(testCase.id, viewport, layout, "baseline");

    if (options.forceUpdate) {
      await storage.writeOutput(testCase.id, viewport, layout);
    }

    captures.push({ testCase, viewport, layout });
    
    if (progressDisplay) {
      progressDisplay.completeTask(taskId, 'captured');
    }
  }

  return { captures, currentStep };
}

/**
 * Create an empty layout for error cases
 */
function createEmptyLayout(url: string, viewport: any) {
  return {
    url,
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