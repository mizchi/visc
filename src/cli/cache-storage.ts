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
    const filename = `${type}-${viewport.width}x${viewport.height}.json`;
    return path.join(this.cacheDir, testId, filename);
  }

  private getOutputPath(
    testId: string,
    viewport: Viewport,
    extension: string
  ): string {
    const filename = `${viewport.width}x${viewport.height}.${extension}`;
    return path.join(this.outputDir, testId, filename);
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
    await fs.writeFile(cachePath, JSON.stringify(layout, null, 2));
  }

  async writeOutput(
    testId: string,
    viewport: Viewport,
    layout: VisualTreeAnalysis
  ): Promise<void> {
    const outputDir = path.join(this.outputDir, testId);
    await fs.mkdir(outputDir, { recursive: true });

    // Write JSON
    const jsonPath = this.getOutputPath(testId, viewport, "json");
    await fs.writeFile(jsonPath, JSON.stringify(layout, null, 2));

    // Write SVG
    const svgPath = this.getOutputPath(testId, viewport, "svg");
    const svg = renderLayoutToSvg(layout, { showLabels: true });
    await fs.writeFile(svgPath, svg);
  }

  async writeComparison(
    testId: string,
    viewport: Viewport,
    comparison: any,
    previousLayout: VisualTreeAnalysis,
    currentLayout: VisualTreeAnalysis
  ): Promise<void> {
    const outputDir = path.join(this.outputDir, testId);
    await fs.mkdir(outputDir, { recursive: true });

    // Write comparison JSON
    const jsonPath = this.getDiffPath(testId, viewport, "json");
    await fs.writeFile(jsonPath, JSON.stringify(comparison, null, 2));

    // Write diff SVG
    const svgPath = this.getDiffPath(testId, viewport, "svg");
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

  async writeSummary(summary: any): Promise<void> {
    await fs.mkdir(this.outputDir, { recursive: true });
    const summaryPath = path.join(this.outputDir, "summary.json");
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
  }

  async writeCalibration(calibration: any): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    const calibrationPath = path.join(this.cacheDir, "calibration.json");
    await fs.writeFile(calibrationPath, JSON.stringify(calibration, null, 2));
  }

  async readCalibration(): Promise<any | null> {
    try {
      const calibrationPath = path.join(this.cacheDir, "calibration.json");
      const content = await fs.readFile(calibrationPath, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
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
}
