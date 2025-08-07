/**
 * Check command implementation
 * Runs visual regression tests based on configuration file
 */

import * as path from "path";
import { CacheStorage } from "../cache-storage.js";
import { EnhancedProgressDisplay } from "../ui/enhanced-progress.js";

// Main check command
export async function check(options: {
  config: string;
  update?: boolean;
  only?: string;
  onlyFailed?: boolean;
  parallelConcurrency?: number;
  interval?: number;
  json?: string;
  retry?: number;
  tui?: boolean;
  calibrate?: boolean;
}) {
  // Import required modules
  const { loadConfig } = await import("./check/config-loader.js");
  const { runCalibration } = await import("./check/calibration-runner.js");
  const { runCapture } = await import("./check/capture-runner.js");
  const { runCompare } = await import("./check/comparison-runner.js");
  const { exportResults, displayResultsSummary } = await import("./check/result-exporter.js");
  const { renderProgressBar, clearLine, log: utilLog } = await import("./check/utils.js");

  // Initialize progress display
  let progressDisplay: EnhancedProgressDisplay | null = null;
  
  if (options.tui) {
    progressDisplay = new EnhancedProgressDisplay();
  }

  const context = {
    log: (message: string) => utilLog(message, progressDisplay),
    progressDisplay,
    renderProgressBar: (current: number, total: number, label?: string) => 
      renderProgressBar(current, total, label, progressDisplay),
    clearLine
  };

  try {
    // Load and validate configuration
    const configPath = path.resolve(options.config);
    const config = await loadConfig(configPath);

    // Create cache storage
    const storage = new CacheStorage(
      config.cacheDir || ".visc/cache",
      config.outputDir || ".visc/output"
    );

    // Apply --only filter if specified
    if (options.only) {
      const patterns = options.only.split(",").map((p) => p.trim());
      config.testCases = config.testCases.filter((tc) =>
        patterns.some((pattern) => {
          if (pattern.includes("*")) {
            const regex = new RegExp(
              "^" + pattern.replace(/\*/g, ".*") + "$"
            );
            return regex.test(tc.id);
          }
          return tc.id === pattern;
        })
      );

      if (config.testCases.length === 0) {
        throw new Error(`No test cases match the pattern: ${options.only}`);
      }

      context.log(`\n🎯 Running ${config.testCases.length} test case(s) matching: ${options.only}\n`);
    }

    // Run calibration if requested
    if (options.calibrate) {
      await runCalibration(config, storage, context);
      
      // Cleanup if needed
      if (progressDisplay) {
        // Progress display cleanup handled automatically
      }
      return;
    }

    const viewports = config.viewports as Record<
      string,
      import("../../workflow.js").Viewport
    >;

    // Load previous results (baselines)
    const previousResults = await storage.loadAllBaselines(
      config.testCases,
      viewports
    );

    // Check for missing baselines
    const missingBaselines: string[] = [];
    for (const testCase of config.testCases) {
      const testLayouts = previousResults.get(testCase.id);
      if (!testLayouts || testLayouts.size === 0) {
        missingBaselines.push(testCase.id);
      }
    }

    // Determine operation mode
    if (options.update) {
      // Update mode: capture new baselines
      context.log(`📸 Update Mode: Capturing new baselines...\n`);
      
      await runCapture(
        config, 
        storage, 
        {
          forceUpdate: true,
          parallelConcurrency: options.parallelConcurrency,
          interval: options.interval,
          retry: options.retry
        },
        context
      );
      
      context.log(`✅ Baselines updated successfully\n`);
    } else if (missingBaselines.length > 0) {
      // First run: create initial baselines
      context.log(
        `🎬 First Run: Creating baselines for ${missingBaselines.length} test case(s)...\n`
      );
      
      await runCapture(
        config, 
        storage, 
        {
          forceUpdate: false,
          parallelConcurrency: options.parallelConcurrency,
          interval: options.interval,
          retry: options.retry
        },
        context
      );
      
      context.log(`✅ Initial baselines created\n`);
    } else {
      // Compare mode: run visual regression tests
      const results = await runCompare(
        config,
        storage,
        previousResults,
        {
          parallelConcurrency: options.parallelConcurrency,
          interval: options.interval,
          onlyFailed: options.onlyFailed
        },
        context
      );

      // Export and display results
      await exportResults(
        results,
        config.outputDir || '.visc/output',
        {
          jsonOutput: options.json,
          saveImages: config.saveImages,
          saveScreenshots: config.saveScreenshots
        },
        context
      )

      displayResultsSummary(results, context);

      // Exit with error code if tests failed
      const hasFailures = results.some((r) => r.hasIssues);
      if (hasFailures) {
        process.exit(1);
      }
    }
  } catch (error: any) {
    context.log(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  } finally {
    // Cleanup if needed
    if (progressDisplay) {
      // Progress display cleanup handled automatically
    }
  }
}
