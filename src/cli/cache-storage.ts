/**
 * Cache storage implementation for visc check command
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { VisualTreeAnalysis } from "../index.js";
import type { Viewport, TestCase } from "../workflow.js";
import { renderLayoutToSvg, renderComparisonToSvg } from "../index.js";

export class CacheStorage {
  constructor(private cacheDir: string, private outputDir: string) {}

  private getCachePath(
    testId: string,
    viewport: Viewport,
    type: "baseline" | "current" = "baseline"
  ): string {
    if (type === "current") {
      // Store current snapshots in .visc/current/<id>/
      const currentDir = path.join(path.dirname(this.cacheDir), "current");
      const filename = `${viewport.width}x${viewport.height}.json`;
      return path.join(currentDir, testId, filename);
    } else {
      // Store baseline snapshots in .visc/cache/<id>/
      const filename = `baseline-${viewport.width}x${viewport.height}.json`;
      return path.join(this.cacheDir, testId, filename);
    }
  }



  private getDiffPath(
    testId: string,
    viewport: Viewport,
    extension: string
  ): string {
    const filename = `diff-${viewport.width}x${viewport.height}.${extension}`;
    return path.join(this.outputDir, testId, filename);
  }

  async readSnapshot(
    testId: string,
    viewport: Viewport,
    type: "baseline" | "current" = "baseline"
  ): Promise<VisualTreeAnalysis | null> {
    try {
      const cachePath = this.getCachePath(testId, viewport, type);
      const content = await fs.readFile(cachePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async writeSnapshot(
    testId: string,
    viewport: Viewport,
    layout: VisualTreeAnalysis,
    type: "baseline" | "current" = "baseline"
  ): Promise<void> {
    const cachePath = this.getCachePath(testId, viewport, type);
    const cacheDir = path.dirname(cachePath);
    await fs.mkdir(cacheDir, { recursive: true });
    
    // Write JSON
    await fs.writeFile(cachePath, JSON.stringify(layout, null, 2));
    
    // Also write SVG to cache
    const svgFilename = `${type}-${viewport.width}x${viewport.height}.svg`;
    const svgPath = path.join(cacheDir, svgFilename);
    const svg = renderLayoutToSvg(layout, { showLabels: true });
    await fs.writeFile(svgPath, svg);
  }

  async writeOutput(
    testId: string,
    viewport: Viewport,
    layout: VisualTreeAnalysis
  ): Promise<void> {
    // Generate flat filename: <testId>-<viewport>.svg in output directory
    const filename = `${testId}-${viewport.width}x${viewport.height}.svg`;
    const svgPath = path.join(this.outputDir, filename);
    
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    
    // Write SVG only (no JSON)
    const svg = renderLayoutToSvg(layout, { showLabels: true });
    await fs.writeFile(svgPath, svg);
  }

  async writeComparison(
    testId: string,
    viewport: Viewport,
    comparison: any,
    previousLayout: VisualTreeAnalysis,
    currentLayout: VisualTreeAnalysis,
    options: { onlyFailed?: boolean } = {}
  ): Promise<void> {
    // Skip successful tests if onlyFailed is true
    const threshold = comparison.threshold || 90;
    const hasFailed = comparison.similarity < threshold;
    
    if (options.onlyFailed && !hasFailed) {
      return;
    }

    // Ensure output directory exists (flat structure)
    await fs.mkdir(this.outputDir, { recursive: true });

    // Generate flat SVG filename: diff-<testId>-<viewport>.svg
    const viewportKey = `${viewport.width}x${viewport.height}`;
    const svgFilename = `diff-${testId}-${viewportKey}.svg`;
    const svgPath = path.join(this.outputDir, svgFilename);

    // Generate diff SVG
    const svg = renderComparisonToSvg(
      comparison,
      previousLayout,
      currentLayout,
      {
        showUnchanged: true,
        highlightLevel: "moderate",
      }
    );
    
    await fs.writeFile(svgPath, svg);
  }

  async loadAllBaselines(
    testCases: TestCase[],
    viewports: Record<string, Viewport>
  ): Promise<Map<string, Map<string, VisualTreeAnalysis>>> {
    const results = new Map<string, Map<string, VisualTreeAnalysis>>();

    for (const testCase of testCases) {
      const viewportMap = new Map<string, VisualTreeAnalysis>();

      for (const [key, viewport] of Object.entries(viewports)) {
        const snapshot = await this.readSnapshot(
          testCase.id,
          viewport,
          "baseline"
        );
        if (snapshot) {
          viewportMap.set(key, snapshot);
        }
      }

      if (viewportMap.size > 0) {
        results.set(testCase.id, viewportMap);
      }
    }

    return results;
  }

  async writeSummary(summary: any, format: 'json' | 'markdown' = 'json'): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    
    if (format === 'markdown') {
      const summaryPath = path.join(this.outputDir, "summary.md");
      await fs.writeFile(summaryPath, summary);
    } else {
      const summaryPath = path.join(this.outputDir, "summary.json");
      await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    }
  }

  async writeCalibration(calibration: any): Promise<void> {
    // Write global calibration for backward compatibility
    await fs.mkdir(this.cacheDir, { recursive: true });
    const calibrationPath = path.join(this.cacheDir, "calibration.json");
    await fs.writeFile(calibrationPath, JSON.stringify(calibration, null, 2));
    
    // Also write individual calibration files for each test case
    if (calibration.results) {
      for (const [testId, testCalibration] of Object.entries(calibration.results)) {
        const testCacheDir = path.join(this.cacheDir, testId);
        await fs.mkdir(testCacheDir, { recursive: true });
        const testCalibrationPath = path.join(testCacheDir, "calibration.json");
        await fs.writeFile(testCalibrationPath, JSON.stringify({
          version: calibration.version,
          strictness: calibration.strictness,
          timestamp: calibration.timestamp,
          results: testCalibration
        }, null, 2));
      }
    }
  }

  async readCalibration(): Promise<any | null> {
    try {
      // First try to read global calibration file
      const calibrationPath = path.join(this.cacheDir, "calibration.json");
      const content = await fs.readFile(calibrationPath, "utf-8");
      return JSON.parse(content);
    } catch {
      // If global file doesn't exist, try to reconstruct from individual files
      try {
        const calibrationData: any = {
          version: "1.0",
          results: {},
          timestamp: new Date().toISOString()
        };
        
        const dirs = await fs.readdir(this.cacheDir);
        for (const dir of dirs) {
          const testCalibrationPath = path.join(this.cacheDir, dir, "calibration.json");
          try {
            const testContent = await fs.readFile(testCalibrationPath, "utf-8");
            const testCalibration = JSON.parse(testContent);
            if (testCalibration.results) {
              calibrationData.results[dir] = testCalibration.results;
            }
          } catch {
            // Skip if no calibration for this test case
          }
        }
        
        return Object.keys(calibrationData.results).length > 0 ? calibrationData : null;
      } catch {
        return null;
      }
    }
  }

  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }
    
    // Also clear current directory
    try {
      const currentDir = path.join(path.dirname(this.cacheDir), "current");
      await fs.rm(currentDir, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }
  }

  async clearOutput(): Promise<void> {
    try {
      await fs.rm(this.outputDir, { recursive: true, force: true });
    } catch {
      // Ignore errors if directory doesn't exist
    }
  }

  // Save failed test IDs for incremental testing
  async saveFailedTests(failedTestIds: string[]): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    const failedTestsPath = path.join(this.outputDir, "failed-tests.json");
    const data = {
      timestamp: new Date().toISOString(),
      failedTestIds,
    };
    await fs.writeFile(failedTestsPath, JSON.stringify(data, null, 2));
  }

  // Load previously failed test IDs
  async loadFailedTests(): Promise<string[] | null> {
    try {
      const failedTestsPath = path.join(this.outputDir, "failed-tests.json");
      const content = await fs.readFile(failedTestsPath, "utf-8");
      const data = JSON.parse(content);
      return data.failedTestIds || [];
    } catch {
      return null;
    }
  }

  // Clear failed tests record
  async clearFailedTests(): Promise<void> {
    try {
      const failedTestsPath = path.join(this.outputDir, "failed-tests.json");
      await fs.unlink(failedTestsPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
