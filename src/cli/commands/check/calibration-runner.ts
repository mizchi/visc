/**
 * Calibration runner for visual regression tests
 * Analyzes layout stability and generates comparison settings
 */

import puppeteer from "puppeteer";
import type { ViscConfig } from "../../config.js";
import { CacheStorage } from "../../cache-storage.js";
import { getEffectiveCaptureOptions, logMergedOptions } from "../../../config/merge.js";
import { calibrateComparisonSettings } from "../../../layout/calibrator.js";
import type { VisualTreeAnalysis } from "../../../types.js";
import { EnhancedProgressDisplay } from "../../ui/enhanced-progress.js";

interface CalibrationContext {
  log: (message: string) => void;
  progressDisplay: EnhancedProgressDisplay | null;
}

/**
 * Run calibration to analyze layout stability
 * @param config Configuration for the visual regression tests
 * @param storage Cache storage instance
 * @param context Calibration context with logging and progress display
 */
export async function runCalibration(
  config: ViscConfig,
  storage: CacheStorage,
  context: CalibrationContext
): Promise<void> {
  const { log, progressDisplay } = context;
  
  log(`🔧 Running calibration to analyze layout stability...\n`);

  const browser = await puppeteer.launch(config.browserOptions);
  const viewports = config.viewports as Record<
    string,
    import("../../../workflow.js").Viewport
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
        // Use merged options for calibration
        const captureOptions = getEffectiveCaptureOptions(
          testCase,
          config.captureOptions,
          config.captureOptions // Same for both phases during calibration
        );
        logMergedOptions(testCase.id, captureOptions, 'capture');
        
        // Import the matrix capture function
        const { captureLayoutMatrix } = await import("../../../workflow.js");
        
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
      log(`\n✅ Calibration completed successfully!`);
      log(`📊 Added ${newTestCases} new test cases (${totalTestCases} total) across ${Object.keys(viewports).length} viewports\n`);
    } else {
      log(`\n✅ Calibration completed successfully!`);
      log(`📊 Analyzed ${totalTestCases} test cases across ${Object.keys(viewports).length} viewports\n`);
    }
  } finally {
    await browser.close();
  }
}