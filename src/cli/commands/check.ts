/**
 * Check command implementation
 * Runs visual regression tests based on configuration file
 */

import puppeteer from "puppeteer";
import * as fs from "fs/promises";
import * as path from "path";
import { stdout } from "process";
import {
  captureLayout,
  compareLayouts,
  collectCaptures,
  generateSummary,
  type CaptureResult,
  type TestResult,
} from "../../workflow.js";
import { CacheStorage } from "../cache-storage.js";
import type { ViscConfig } from "../config.js";
import { DEFAULT_CONFIG } from "../config.js";
import { calibrateComparisonSettings } from "../../layout/calibrator.js";
import type { VisualTreeAnalysis } from "../../types.js";
import { EnhancedProgressDisplay } from "../ui/enhanced-progress.js";

// Progress display instance
let progressDisplay: EnhancedProgressDisplay | null = null;

// Progress bar helpers
function renderProgressBar(current: number, total: number, label: string = "") {
  if (progressDisplay) {
    progressDisplay.showProgress(label, current, total);
  } else {
    const width = 30;
    const percent = Math.floor((current / total) * 100);
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;

    const bar = `[${"█".repeat(filled)}${" ".repeat(empty)}]`;
    const progress = `${current}/${total}`;

    stdout.write(`\r${bar} ${progress} ${percent}% ${label}`);

    if (current === total) {
      stdout.write("\n");
    }
  }
}

function clearLine() {
  stdout.write("\r" + " ".repeat(80) + "\r");
}

function log(message: string) {
  if (progressDisplay) {
    progressDisplay.log(message);
  } else {
    console.log(message);
  }
}

// Execute tasks with concurrency limit
async function executeWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      executing.splice(0, executing.findIndex((p) => p !== promise) + 1);
    }
  }

  await Promise.all(executing);
  return results;
}

// Execute a function with retry logic
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < retries) {
        if (onRetry) {
          onRetry(attempt + 1, error);
        }
        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

// Generate JSON summary from test results
function generateJSONSummary(results: TestResult[]): any {
  const totalTests = results.length;
  const testsWithIssues = results.filter(r => r.hasIssues).length;
  const totalComparisons = results.reduce((sum, r) => sum + r.comparisons.length, 0);
  const failedComparisons = results.reduce(
    (sum, r) => sum + r.comparisons.filter(c => c.comparison.hasIssues).length,
    0
  );

  return {
    timestamp: new Date().toISOString(),
    totalTests,
    testsWithIssues,
    totalComparisons,
    failedComparisons,
    tests: results.map(r => ({
      id: r.testCase.id,
      url: r.testCase.url,
      hasIssues: r.hasIssues,
      comparisons: r.comparisons.map(c => ({
        viewport: `${c.viewport.width}x${c.viewport.height}`,
        similarity: c.comparison.similarity,
        hasIssues: c.comparison.hasIssues,
        differences: c.comparison.differences,
        addedElements: c.comparison.addedElements,
        removedElements: c.comparison.removedElements
      }))
    }))
  };
}

// Run calibration for initial setup
async function runCalibration(
  config: ViscConfig,
  storage: CacheStorage
): Promise<void> {
  log(`🔧 Running calibration to analyze layout stability...
`);

  const browser = await puppeteer.launch(config.browserOptions);
  const viewports = config.viewports as Record<
    string,
    import("../../workflow.js").Viewport
  >;

  try {
    // Take multiple samples for each test case
    const samples = config.calibrationOptions?.samples || 3;
    const strictness = config.calibrationOptions?.strictness || "medium";
    
    // Load existing calibration data if it exists
    const existingCalibration = await storage.readCalibration();
    const calibrationResults: Record<string, any> = existingCalibration?.results || {};
    
    for (const testCase of config.testCases) {
      log(`📊 Analyzing ${testCase.id}...`);
      const page = await browser.newPage();
      calibrationResults[testCase.id] = {};
      
      try {
        const captureOptions = {
          ...config.captureOptions,
          ...testCase.captureOptions,
        };
        
        // Import the matrix capture function
        const { captureLayoutMatrix } = await import("../../workflow.js");
        
        // Collect samples for all viewports at once
        const allSamples: Map<string, VisualTreeAnalysis[]> = new Map();
        
        // Initialize sample arrays for each viewport
        for (const viewportKey of Object.keys(viewports)) {
          allSamples.set(viewportKey, []);
        }
        
        // Capture multiple samples for all viewports
        for (let i = 0; i < samples; i++) {
          if (i > 0) {
            await page.reload();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between samples
          }
          
          log(`  - Sample ${i + 1}/${samples}`);
          
          // Capture all viewports at once
          let layoutsForAllViewports;
          try {
            layoutsForAllViewports = await captureLayoutMatrix(
              page,
              testCase.url,
              viewports,
              captureOptions
            );
          } catch (error: any) {
            log(`  ⚠️ Error capturing layouts: ${error.message}`);
            // Create empty layouts for all viewports on error
            layoutsForAllViewports = new Map();
            for (const [viewportKey, viewport] of Object.entries(viewports)) {
              layoutsForAllViewports.set(viewportKey, {
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
              });
            }
          }
          
          // Add each viewport's layout to its sample array
          for (const [viewportKey, layout] of layoutsForAllViewports.entries()) {
            allSamples.get(viewportKey)!.push(layout);
            
            if (progressDisplay) {
              const viewport = viewports[viewportKey];
              progressDisplay.showCalibration(testCase.id, `${viewport.width}x${viewport.height}`, i + 1, samples);
            } else {
              process.stdout.write(".");
            }
          }
        }
        
        log(" ✓");
        
        // Calculate calibration settings for each viewport
        for (const [viewportKey, layoutSamples] of allSamples.entries()) {
          const viewport = viewports[viewportKey];
          log(`  - ${viewport.width}x${viewport.height}: Calculating calibration...`);
          
          const calibration = calibrateComparisonSettings(layoutSamples, { strictness });
          
          // Store calibration results per test case and viewport
          calibrationResults[testCase.id][viewportKey] = {
            settings: calibration.settings,
            confidence: calibration.confidence,
            sampleCount: samples,
            timestamp: new Date().toISOString(),
          };
        }
      } finally {
        await page.close();
      }
    }
    
    // Save all calibration results (merging with existing data)
    await storage.writeCalibration({
      version: "1.0",
      strictness,
      results: calibrationResults,
      timestamp: new Date().toISOString(),
    });
    
    const newTestCases = config.testCases.length;
    const totalTestCases = Object.keys(calibrationResults).length;
    
    if (newTestCases < totalTestCases) {
      log(`
✅ Calibration completed successfully!`);
      log(`📊 Added ${newTestCases} new test cases (${totalTestCases} total) across ${Object.keys(viewports).length} viewports
`);
    } else {
      log(`
✅ Calibration completed successfully!`);
      log(`📊 Analyzed ${totalTestCases} test cases across ${Object.keys(viewports).length} viewports
`);
    }
  } finally {
    await browser.close();
  }
}

// Load and validate config
async function loadConfig(configPath: string): Promise<ViscConfig> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    const rawConfig = JSON.parse(content);
    
    // Import validation function from schema
    const { validateConfig } = await import("../../schema/config.js");
    
    // Validate config with Zod schema
    const validatedConfig = validateConfig(rawConfig);

    // Merge with defaults and ensure all viewports have required fields
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...validatedConfig,
      captureOptions: {
        ...DEFAULT_CONFIG.captureOptions,
        ...validatedConfig.captureOptions,
      },
      compareOptions: {
        ...DEFAULT_CONFIG.compareOptions,
        ...validatedConfig.compareOptions,
      },
      browserOptions: {
        ...DEFAULT_CONFIG.browserOptions,
        ...validatedConfig.browserOptions,
      },
    } as ViscConfig;

    // Ensure all viewports have required fields with defaults
    for (const key in mergedConfig.viewports) {
      const viewport = mergedConfig.viewports[key];
      mergedConfig.viewports[key] = {
        ...viewport,
        deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
        userAgent: viewport.userAgent ?? "",
      };
    }

    return mergedConfig;
  } catch (error) {
    // Check if it's a Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as any;
      const issues = zodError.issues.map((issue: any) => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      throw new Error(`Invalid configuration in ${configPath}:\n${issues}`);
    }
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}

// Capture phase
async function runCapture(
  config: ViscConfig,
  storage: CacheStorage,
  options: {
    forceUpdate?: boolean;
    parallelConcurrency?: number;
    interval?: number;
    retry?: number;
  }
): Promise<CaptureResult[]> {
  const browser = await puppeteer.launch(config.browserOptions);
  const viewports = config.viewports as Record<
    string,
    import("../../workflow.js").Viewport
  >;
  const previousResults = options.forceUpdate
    ? new Map()
    : await storage.loadAllBaselines(config.testCases, viewports);

  const captures: CaptureResult[] = [];
  const totalSteps =
    config.testCases.length * Object.keys(config.viewports).length;
  let currentStep = 0;
  const parallelConcurrency = options.parallelConcurrency || 1;
  const interval = options.interval || 300;

  if (progressDisplay) {
    progressDisplay.setPhase(
      `Capture Phase${
        parallelConcurrency > 1 ? ` (parallel: ${parallelConcurrency})` : ""
      }${
        parallelConcurrency === 1 && interval > 0
          ? ` (interval: ${interval}ms)`
          : ""
      }`,
      '📥'
    );
  } else {
    console.log(
      `📥 Capture Phase${
        parallelConcurrency > 1 ? ` (parallel: ${parallelConcurrency})` : ""
      }${
        parallelConcurrency === 1 && interval > 0
          ? ` (interval: ${interval}ms)`
          : ""
      }\n`
    );
  }

  // Initialize tasks for TUI mode
  if (progressDisplay) {
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

  try {
    if (parallelConcurrency === 1) {
      // Sequential execution (original logic)
      for (const testCase of config.testCases) {
        const page = await browser.newPage();

        try {
          // Merge global and test-specific options
          const captureOptions = {
            ...config.captureOptions,
            ...testCase.captureOptions,
            overrides:
              testCase.captureOptions?.overrides ||
              config.captureOptions?.overrides,
            networkBlocks:
              testCase.captureOptions?.networkBlocks ||
              config.captureOptions?.networkBlocks,
          };

          const previousLayouts = previousResults.get(testCase.id);

          // Import the matrix capture function
          const { captureLayoutMatrix } = await import("../../workflow.js");
          
          // Check which viewports need to be captured
          const viewportsToCapture: Record<string, any> = {};
          const cachedViewports: string[] = [];
          
          for (const [viewportKey, viewport] of Object.entries(viewports)) {
            const previousLayout = previousLayouts?.get(viewportKey);
            const taskId = `${testCase.id}-${viewportKey}`;
            
            if (previousLayout && !options.forceUpdate) {
              cachedViewports.push(viewportKey);
              if (progressDisplay) {
                progressDisplay.updateTask(taskId, { 
                  status: 'completed', 
                  message: 'using cache' 
                });
              }
              captures.push({
                testCase,
                viewport,
                layout: previousLayout,
              });
            } else {
              viewportsToCapture[viewportKey] = viewport;
            }
          }
          
          // Capture all needed viewports at once
          if (Object.keys(viewportsToCapture).length > 0) {
            let layoutMatrix;
            
            // Determine retry count for this test
            const retryCount = testCase.retry ?? config.retry ?? options.retry ?? 0;
            
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
                        // Update all viewport tasks with the same state
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
              // Create empty layouts for all viewports on error
              layoutMatrix = new Map();
              for (const [viewportKey, viewport] of Object.entries(viewportsToCapture)) {
                layoutMatrix.set(viewportKey, {
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
                });
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
                renderProgressBar(
                  currentStep,
                  totalSteps,
                  `${label} (${action}...)`
                );
              }
              
              // Save to cache
              await storage.writeSnapshot(
                testCase.id,
                viewport,
                layout,
                "baseline"
              );

              // Save output files
              if (options.forceUpdate) {
                await storage.writeOutput(testCase.id, viewport, layout);
              }

              captures.push({
                testCase,
                viewport,
                layout,
              });
              
              if (progressDisplay) {
                progressDisplay.completeTask(taskId, 'captured');
              }
            }
          } else {
            // Update progress for cached viewports
            currentStep += cachedViewports.length;
            if (!progressDisplay) {
              renderProgressBar(currentStep, totalSteps, `${testCase.id} (all cached)`);
            }
          }
          
          // Add interval between test cases in sequential mode
          if (interval > 0 && currentStep < totalSteps) {
            await new Promise((resolve) => setTimeout(resolve, interval));
          }
        } finally {
          await page.close();
        }
      }
    } else {
      // Parallel execution
      const tasks: Array<() => Promise<CaptureResult[]>> = [];

      for (const testCase of config.testCases) {
        tasks.push(async () => {
          const taskCaptures: CaptureResult[] = [];
          const page = await browser.newPage();

          try {
            const captureOptions = {
              ...config.captureOptions,
              ...testCase.captureOptions,
              overrides:
                testCase.captureOptions?.overrides ||
                config.captureOptions?.overrides,
              networkBlocks:
                testCase.captureOptions?.networkBlocks ||
                config.captureOptions?.networkBlocks,
            };

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
                
                // Determine retry count for this test
                const retryCount = testCase.retry ?? config.retry ?? options.retry ?? 0;
                
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
                  // Use empty layout on error
                  layout = {
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
                await storage.writeSnapshot(
                  testCase.id,
                  viewport,
                  layout,
                  "baseline"
                );

                if (options.forceUpdate) {
                  await storage.writeOutput(testCase.id, viewport, layout);
                }

                taskCaptures.push({
                  testCase,
                  viewport,
                  layout,
                });
              }
            }
          } finally {
            await page.close();
          }

          return taskCaptures;
        });
      }

      // Execute tasks with concurrency limit
      const results = await executeWithConcurrency(tasks, parallelConcurrency);
      for (const result of results) {
        captures.push(...result);
      }

      // Update progress bar
      currentStep = totalSteps;
      renderProgressBar(currentStep, totalSteps, "");
    }

    clearLine();
    if (progressDisplay) {
      progressDisplay.log(`✅ Captured ${captures.length} layouts`);
    } else {
      console.log(`✅ Captured ${captures.length} layouts\n`);
    }
  } finally {
    await browser.close();
  }

  return captures;
}

// Compare phase
async function runCompare(
  config: ViscConfig,
  storage: CacheStorage,
  previousResults: Map<
    string,
    Map<string, import("../../index.js").VisualTreeAnalysis>
  >,
  options: { parallelConcurrency?: number; interval?: number; onlyFailed?: boolean } = {}
): Promise<TestResult[]> {
  console.log(`📊 Compare Phase\n`);

  // Always capture fresh data for comparison
  const browser = await puppeteer.launch(config.browserOptions);
  const viewports = config.viewports as Record<
    string,
    import("../../workflow.js").Viewport
  >;
  const captures: CaptureResult[] = [];

  const totalSteps = config.testCases.length * Object.keys(viewports).length;
  let currentStep = 0;
  const parallelConcurrency = options.parallelConcurrency || 1;
  const interval = options.interval || 300;

  try {
    // First, capture fresh layouts
    console.log(
      `Capturing current layouts${
        parallelConcurrency > 1 ? ` (parallel: ${parallelConcurrency})` : ""
      }${
        parallelConcurrency === 1 && interval > 0
          ? ` (interval: ${interval}ms)`
          : ""
      }...\n`
    );

    if (parallelConcurrency === 1) {
      // Sequential execution
      for (const testCase of config.testCases) {
        const page = await browser.newPage();

        try {
          const captureOptions = {
            ...config.captureOptions,
            ...testCase.captureOptions,
            forceUpdate: true,
            // Use compare phase overrides/networkBlocks if specified, otherwise fall back to capture settings
            overrides:
              testCase.compareOptions?.overrides ||
              config.compareOptions?.overrides ||
              testCase.captureOptions?.overrides ||
              config.captureOptions?.overrides,
            networkBlocks:
              testCase.compareOptions?.networkBlocks ||
              config.compareOptions?.networkBlocks ||
              testCase.captureOptions?.networkBlocks ||
              config.captureOptions?.networkBlocks,
          };

          for (const [, viewport] of Object.entries(viewports)) {
            currentStep++;
            const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
            renderProgressBar(currentStep, totalSteps, label);

            let layout;
            try {
              layout = await captureLayout(
                page,
                testCase.url,
                viewport,
                captureOptions
              );
            } catch (error: any) {
              console.error(`⚠️ Error capturing ${testCase.id} @ ${viewport.width}x${viewport.height}: ${error.message}`);
              // Use empty layout on error
              layout = {
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

            // Save current snapshot to cache
            await storage.writeSnapshot(
              testCase.id,
              viewport,
              layout,
              "current"
            );

            captures.push({
              testCase,
              viewport,
              layout,
            });

            // Add interval between captures in sequential mode
            if (interval > 0 && currentStep < totalSteps) {
              await new Promise((resolve) => setTimeout(resolve, interval));
            }
          }
        } finally {
          await page.close();
        }
      }
    } else {
      // Parallel execution
      const tasks: Array<() => Promise<CaptureResult[]>> = [];

      for (const testCase of config.testCases) {
        tasks.push(async () => {
          const taskCaptures: CaptureResult[] = [];
          const page = await browser.newPage();

          try {
            const captureOptions = {
              ...config.captureOptions,
              ...testCase.captureOptions,
              forceUpdate: true,
              // Use compare phase overrides/networkBlocks if specified, otherwise fall back to capture settings
              overrides:
                testCase.compareOptions?.overrides ||
                config.compareOptions?.overrides ||
                testCase.captureOptions?.overrides ||
                config.captureOptions?.overrides,
              networkBlocks:
                testCase.compareOptions?.networkBlocks ||
                config.compareOptions?.networkBlocks ||
                testCase.captureOptions?.networkBlocks ||
                config.captureOptions?.networkBlocks,
            };

            for (const [, viewport] of Object.entries(viewports)) {
              let layout;
              try {
                layout = await captureLayout(
                  page,
                  testCase.url,
                  viewport,
                  captureOptions
                );
              } catch (error: any) {
                console.error(`⚠️ Error capturing ${testCase.id} @ ${viewport.width}x${viewport.height}: ${error.message}`);
                // Use empty layout on error
                layout = {
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
              await storage.writeSnapshot(
                testCase.id,
                viewport,
                layout,
                "current"
              );

              taskCaptures.push({
                testCase,
                viewport,
                layout,
              });
            }
          } finally {
            await page.close();
          }

          return taskCaptures;
        });
      }

      // Execute tasks with concurrency limit
      const results = await executeWithConcurrency(tasks, parallelConcurrency);
      for (const result of results) {
        captures.push(...result);
      }

      // Update progress bar
      currentStep = totalSteps;
      renderProgressBar(currentStep, totalSteps, "");
    }

    clearLine();
    console.log(`✅ Captured ${captures.length} current layouts\n`);
  } finally {
    await browser.close();
  }

  const currentLayouts = collectCaptures(captures, viewports);
  const results: TestResult[] = [];

  // Process comparisons
  console.log(`Comparing layouts...\n`);
  currentStep = 0;

  // Load calibration data if available
  const calibrationData = await storage.readCalibration();

  // Process each test case with its own settings
  for (const testCase of config.testCases) {
    let compareOptions = {
      ...config.compareOptions,
      ...testCase.compareOptions,
    };
    
    // Apply calibration settings if available and visual groups are enabled
    if (calibrationData?.results && compareOptions.useVisualGroups) {
      const testCalibration = calibrationData.results[testCase.id];
      if (testCalibration) {
        // Get the first viewport's calibration as default (could be enhanced to be viewport-specific)
        const viewportKey = Object.keys(testCalibration)[0];
        const calibrationSettings = testCalibration[viewportKey]?.settings;
        
        if (calibrationSettings) {
          console.log(`  🔧 Using calibrated thresholds for ${testCase.id} (confidence: ${testCalibration[viewportKey].confidence}%)`);
          compareOptions = {
            ...compareOptions,
            threshold: calibrationSettings.positionTolerance || compareOptions.threshold,
            similarityThreshold: calibrationSettings.minSimilarity || compareOptions.similarityThreshold,
          };
        }
      }
    }

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
        renderProgressBar(
          currentStep,
          totalSteps,
          `${label} (${comparison.similarity.toFixed(0)}%)`
        );

        // Get the previous and current layouts for this test case and viewport
        const viewportKey = Object.keys(viewports).find(
          (key) => viewports[key] === viewport
        );
        const previousLayout = previousResults
          .get(testCase.id)
          ?.get(viewportKey!);
        const currentLayout = currentLayouts
          .get(testCase.id)
          ?.get(viewportKey!);

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
      } else {
        results.push(result);
      }
    }
  }

  clearLine();
  console.log(`✅ Compared ${currentStep} layouts\n`);

  return results;
}

// Main check command
export async function check(
  configPath: string,
  options: {
    update?: boolean;
    clearCache?: boolean;
    outputDir?: string;
    parallelConcurrency?: number;
    interval?: number;
    tui?: boolean;
    onlyFailed?: boolean;
    incremental?: boolean;
    retry?: number;
    testId?: string;
  }
) {
  // Initialize progress display if TUI mode is enabled
  if (options.tui) {
    progressDisplay = new EnhancedProgressDisplay(true);
    progressDisplay.setPhase('Visual Check', '🚀');
  } else {
    console.log(`🚀 Visual Check\n`);
  }

  // Load config
  let config = await loadConfig(configPath);
  
  // Initialize storage early to access failed tests
  const outputDir = options.outputDir || config.outputDir!;
  const storage = new CacheStorage(config.cacheDir!, outputDir);
  
  // Filter test cases based on options
  let filteredTestCases = config.testCases;
  
  // Filter by testId if specified
  if (options.testId) {
    const targetTestCase = filteredTestCases.find(tc => tc.id === options.testId);
    if (!targetTestCase) {
      console.error(`❌ Test case with ID '${options.testId}' not found`);
      console.log(`Available test IDs:`);
      config.testCases.forEach(tc => console.log(`  - ${tc.id}`));
      process.exit(1);
    }
    filteredTestCases = [targetTestCase];
    console.log(
      `📋 Running single test: ${options.testId} × ${
        Object.keys(config.viewports).length
      } viewports
`
    );
  }
  // Filter by failed tests if --only-failed is specified
  else if (options.onlyFailed) {
    const failedTestIds = await storage.loadFailedTests();
    if (!failedTestIds || failedTestIds.length === 0) {
      console.log(`✅ No failed tests from previous run`);
      process.exit(0);
    }
    filteredTestCases = filteredTestCases.filter(tc => failedTestIds.includes(tc.id));
    console.log(
      `🔄 Re-running ${filteredTestCases.length} failed tests × ${
        Object.keys(config.viewports).length
      } viewports
`
    );
  }
  // Filter by incremental if specified (failed + not tested)
  else if (options.incremental) {
    const failedTestIds = await storage.loadFailedTests() || [];
    const hasBaseline = new Set<string>();
    
    // Check which tests have baselines
    for (const testCase of config.testCases) {
      for (const viewport of Object.values(config.viewports)) {
        try {
          const baseline = await storage.readSnapshot(testCase.id, viewport as any);
          if (baseline) {
            hasBaseline.add(testCase.id);
          }
        } catch {
          // No baseline
        }
      }
    }
    
    // Include failed tests and tests without baselines
    filteredTestCases = filteredTestCases.filter(tc => 
      failedTestIds.includes(tc.id) || !hasBaseline.has(tc.id)
    );
    
    const failedCount = filteredTestCases.filter(tc => failedTestIds.includes(tc.id)).length;
    const newCount = filteredTestCases.length - failedCount;
    
    console.log(
      `📊 Incremental mode: ${failedCount} failed + ${newCount} new tests × ${
        Object.keys(config.viewports).length
      } viewports
`
    );
  } else {
    console.log(
      `📋 Config loaded: ${filteredTestCases.length} test cases × ${
        Object.keys(config.viewports).length
      } viewports
`
    );
  }
  
  // Update config with filtered test cases
  config = { ...config, testCases: filteredTestCases };

  // Clean output directory before running tests (remove and recreate)
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist, that's fine
  }
  await fs.mkdir(outputDir, { recursive: true });

  // Clear cache if requested
  if (options.clearCache) {
    console.log(`🗑️  Clearing cache...\n`);
    await storage.clearCache();
  }

  // Check if initial run
  const viewports = config.viewports as Record<
    string,
    import("../../workflow.js").Viewport
  >;
  const previousResults = await storage.loadAllBaselines(
    config.testCases,
    viewports
  );
  const isInitialRun = previousResults.size === 0;
  
  // Check for new URLs that don't have baselines
  const newTestCases: typeof config.testCases = [];
  for (const testCase of config.testCases) {
    if (!previousResults.has(testCase.id)) {
      newTestCases.push(testCase);
    }
  }

  if (isInitialRun) {
    console.log(`🆕 Initial run detected - creating baseline snapshots...
`);
    
    // Run calibration if enabled
    if (config.calibrationOptions?.enabled !== false) {
      await runCalibration(config, storage);
    }
  } else if (newTestCases.length > 0 && !options.update) {
    console.log(`🆕 New test cases detected (${newTestCases.length}):
`);
    for (const testCase of newTestCases) {
      console.log(`  - ${testCase.id}: ${testCase.url}`);
    }
    
    // Always run calibration for new test cases
    console.log(`
🔧 Auto-calibrating new test cases...
`);
    const newConfig = { ...config, testCases: newTestCases };
    await runCalibration(newConfig, storage);
  } else if (options.update) {
    console.log(`🔄 Update mode - refreshing baseline snapshots...
`);
  }
  
  // Check if calibration exists for each test case when not in update mode
  if (!options.update && !isInitialRun) {
    const calibrationData = await storage.readCalibration();
    const uncalibratedTestCases = config.testCases.filter(tc => 
      !calibrationData?.results?.[tc.id] || 
      Object.keys(calibrationData.results[tc.id]).length === 0
    );
    
    if (uncalibratedTestCases.length > 0) {
      console.log(`🔧 Auto-calibrating ${uncalibratedTestCases.length} uncalibrated test case(s)...
`);
      const calibrationConfig = { ...config, testCases: uncalibratedTestCases };
      await runCalibration(calibrationConfig, storage);
    }
  }

  // Always capture (with or without cache)
  await runCapture(config, storage, {
    forceUpdate: options.update || isInitialRun,
    parallelConcurrency: options.parallelConcurrency,
    interval: options.interval,
    retry: options.retry,
  });

  if (isInitialRun) {
    console.log(`✅ Initial baseline snapshots created successfully!`);
    console.log(`📁 Baselines saved to: ${config.cacheDir}`);
    if (config.calibrationOptions?.enabled !== false) {
      console.log(`🔧 Calibration data saved for optimized comparisons`);
    }
    console.log(`\n💡 Run 'visc check' again to start detecting visual changes.`);
    return;
  }

  if (options.update) {
    console.log(`✅ Baseline snapshots updated successfully!`);
    console.log(`📁 Updated baselines saved to: ${config.cacheDir}`);
    console.log(`\n💡 Run 'visc check' without --update to detect visual changes.`);
    return;
  }

  // Compare
  const results = await runCompare(config, storage, previousResults, {
    parallelConcurrency: options.parallelConcurrency,
    interval: options.interval,
    onlyFailed: options.onlyFailed,
  });

  // Display results
  const failedTests: { testCase: any; viewport: any; comparison: any }[] = [];
  
  for (const result of results) {
    if (result.comparisons.length > 0) {
      console.log(`\n${result.testCase.id}:`);
      if (result.testCase.description) {
        console.log(`  ${result.testCase.description}`);
      }
      for (const comp of result.comparisons) {
        const status = comp.comparison.hasIssues ? "⚠️ " : "✅ ";
        console.log(
          `  ${status}${comp.viewport.width}x${
            comp.viewport.height
          }: ${comp.comparison.similarity.toFixed(1)}% similar`
        );
        if (comp.comparison.hasIssues) {
          console.log(
            `     Changes: ${comp.comparison.differences} | Added: ${comp.comparison.addedElements} | Removed: ${comp.comparison.removedElements}`
          );
          failedTests.push({
            testCase: result.testCase,
            viewport: comp.viewport,
            comparison: comp.comparison
          });
        }
      }
    }
  }

  // Generate and save summary
  const { generateSummary } = await import('../summary-generator.js');
  const markdownSummary = generateSummary(results);
  await storage.writeSummary(markdownSummary, 'markdown');
  
  // Also save JSON summary for backward compatibility
  const summary = generateJSONSummary(results);
  await storage.writeSummary(summary);
  
  // Save failed test IDs for incremental testing
  const failedTestIds = results
    .filter(r => r.hasIssues)
    .map(r => r.testCase.id);
  
  if (failedTestIds.length > 0) {
    await storage.saveFailedTests(failedTestIds);
  } else {
    // Clear failed tests if all passed
    await storage.clearFailedTests();
  }

  const passedTests = summary.totalTests - summary.testsWithIssues;
  console.log(
    `
✅ Passed: ${passedTests}/${summary.totalTests} tests`
  );

  if (summary.testsWithIssues > 0) {
    console.log(`\n🔍 Failed tests summary:`);
    console.log(`━${'━'.repeat(60)}`);
    
    for (const failed of failedTests) {
      const svgFilename = `diff-${failed.testCase.id}-${failed.viewport.width}x${failed.viewport.height}.svg`;
      const svgPath = path.join(outputDir, svgFilename);
      console.log(`
📊 ${failed.testCase.id} @ ${failed.viewport.width}x${failed.viewport.height}`);
      console.log(`   Similarity: ${failed.comparison.similarity.toFixed(1)}%`);
      console.log(`   Changes: ${failed.comparison.differences} elements`);
      console.log(`   Added: ${failed.comparison.addedElements} | Removed: ${failed.comparison.removedElements}`);
      
      // Show diff path when onlyFailed option is used or when test failed
      if (options.onlyFailed || failed.comparison.similarity < (failed.comparison.threshold || 90)) {
        console.log(`   📁 Diff: ${path.resolve(svgPath)}`);
      }
    }
    
    console.log(`\n━${'━'.repeat(60)}`);
    console.log(`\n💡 To fix visual differences:`);
    console.log(`   1. Review the diff SVGs in: ${path.resolve(outputDir)}`);
    console.log(`   2. If changes are intentional, run: visc check --update`);
    console.log(`   3. If changes are unintended, fix the source and re-run: visc check`);
    
    process.exit(1); // Exit with error if there are issues
  } else {
    console.log(`\n📁 Output directory: ${path.resolve(outputDir)}`);
  }
}
