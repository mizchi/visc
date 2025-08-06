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
        for (const [viewportKey, viewport] of Object.entries(viewports)) {
          log(`  - ${viewport.width}x${viewport.height}: Collecting ${samples} samples`);
          
          const captureOptions = {
            ...config.captureOptions,
            ...testCase.captureOptions,
          };
          
          const layoutSamples: VisualTreeAnalysis[] = [];
          
          // Capture multiple samples (raw layout data)
          for (let i = 0; i < samples; i++) {
            if (i > 0) {
              await page.reload();
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between samples
            }
            
            const layout = await captureLayout(
              page,
              testCase.url,
              viewport,
              captureOptions
            );
            
            layoutSamples.push(layout);
            if (progressDisplay) {
              progressDisplay.showCalibration(testCase.id, `${viewport.width}x${viewport.height}`, i + 1, samples);
            } else {
              process.stdout.write(".");
            }
          }
          
          log(" ✓");
          
          // Calculate calibration settings based on raw layout data
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
    const config = JSON.parse(content) as ViscConfig;

    // Merge with defaults and ensure all viewports have required fields
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...config,
      captureOptions: {
        ...DEFAULT_CONFIG.captureOptions,
        ...config.captureOptions,
      },
      compareOptions: {
        ...DEFAULT_CONFIG.compareOptions,
        ...config.compareOptions,
      },
      browserOptions: {
        ...DEFAULT_CONFIG.browserOptions,
        ...config.browserOptions,
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

          for (const [viewportKey, viewport] of Object.entries(viewports)) {
            currentStep++;
            const label = `${testCase.id} ${viewport.width}x${viewport.height}`;

            const previousLayout = previousLayouts?.get(viewportKey);

            const taskId = `${testCase.id}-${viewportKey}`;
            
            if (previousLayout && !options.forceUpdate) {
              if (progressDisplay) {
                progressDisplay.updateTask(taskId, { 
                  status: 'completed', 
                  message: 'using cache' 
                });
              } else {
                renderProgressBar(currentStep, totalSteps, `${label} (using cache)`);
              }
              captures.push({
                testCase,
                viewport,
                layout: previousLayout,
              });
            } else {
              const action = options.forceUpdate ? "updating baseline" : "creating baseline";
              if (progressDisplay) {
                progressDisplay.startTask(taskId, action);
              } else {
                renderProgressBar(
                  currentStep,
                  totalSteps,
                  `${label} (${action}...)`
                );
              }

              // Capture new layout
              const layout = await captureLayout(
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
                const layout = await captureLayout(
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
  options: { parallelConcurrency?: number; interval?: number } = {}
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

            const layout = await captureLayout(
              page,
              testCase.url,
              viewport,
              captureOptions
            );

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
              const layout = await captureLayout(
                page,
                testCase.url,
                viewport,
                captureOptions
              );
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
            currentLayout
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
  const config = await loadConfig(configPath);
  console.log(
    `📋 Config loaded: ${config.testCases.length} test cases × ${
      Object.keys(config.viewports).length
    } viewports\n`
  );

  // Override output directory if specified
  const outputDir = options.outputDir || config.outputDir!;

  // Initialize storage
  const storage = new CacheStorage(config.cacheDir!, outputDir);

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
    console.log(`🆕 New URLs detected (${newTestCases.length}):
`);
    for (const testCase of newTestCases) {
      console.log(`  - ${testCase.id}: ${testCase.url}`);
    }
    console.log(`
🔧 Running calibration for new URLs...
`);
    
    // Run calibration only for new test cases if enabled
    if (config.calibrationOptions?.enabled !== false) {
      const newConfig = { ...config, testCases: newTestCases };
      await runCalibration(newConfig, storage);
    }
  } else if (options.update) {
    console.log(`🔄 Update mode - refreshing baseline snapshots...
`);
  }

  // Always capture (with or without cache)
  await runCapture(config, storage, {
    forceUpdate: options.update || isInitialRun,
    parallelConcurrency: options.parallelConcurrency,
    interval: options.interval,
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
  });

  // Display results
  const diffPaths: string[] = [];
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
          // Collect diff file paths
          const diffPath = path.join(outputDir, result.testCase.id, `diff-${comp.viewport.width}x${comp.viewport.height}.svg`);
          diffPaths.push(diffPath);
        }
      }
    }
  }

  // Summary
  const summary = generateSummary(results);
  await storage.writeSummary(summary);

  console.log(
    `\n✨ Complete: ${summary.testsWithIssues}/${summary.totalTests} tests with issues`
  );

  if (summary.testsWithIssues > 0) {
    if (diffPaths.length > 0) {
      console.log(`
🔍 Failed test diff files:`);
      for (const diffPath of diffPaths) {
        // Get absolute path for easy copy-paste
        const absolutePath = path.resolve(diffPath);
        console.log(`   ${absolutePath}`);
      }
    }
    
    process.exit(1); // Exit with error if there are issues
  }
}
