/**
 * Result exporter for visual regression tests
 * Handles summary generation and output formatting
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { TestResult } from "../../../workflow.js";
import { generateSummary } from "../../../workflow.js";
import { EnhancedProgressDisplay } from "../../ui/enhanced-progress.js";

interface ExportContext {
  log: (message: string) => void;
  progressDisplay: EnhancedProgressDisplay | null;
}

/**
 * Generate JSON summary from test results
 */
export function generateJSONSummary(results: TestResult[]): any {
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

/**
 * Export test results to various formats
 */
export async function exportResults(
  results: TestResult[],
  outputDir: string,
  options: {
    format?: 'json' | 'html' | 'markdown';
    jsonOutput?: string;
  },
  context: ExportContext
): Promise<void> {
  const { log } = context;

  // Generate and save JSON summary if requested
  if (options.jsonOutput) {
    const summary = generateJSONSummary(results);
    const outputPath = path.resolve(options.jsonOutput);
    await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));
    log(`📄 JSON summary saved to: ${outputPath}`);
  }

  // Generate text summary
  const textSummary = generateSummary(results);
  if (textSummary) {
    log("\n📋 Summary:");
    log(textSummary.totalTests > 0 ? `Tests: ${textSummary.totalTests}, With Issues: ${textSummary.testsWithIssues}` : "No tests run");
  }

  // Save results to output directory
  if (outputDir) {
    await saveResultsToDirectory(results, outputDir, context);
  }
}

/**
 * Save results to output directory
 */
async function saveResultsToDirectory(
  results: TestResult[],
  outputDir: string,
  context: ExportContext
): Promise<void> {
  const { log } = context;

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Save summary file
  const summaryPath = path.join(outputDir, 'summary.json');
  const summary = generateJSONSummary(results);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  // Save individual test results
  for (const result of results) {
    const testDir = path.join(outputDir, result.testCase.id);
    await fs.mkdir(testDir, { recursive: true });

    const testSummary = {
      id: result.testCase.id,
      url: result.testCase.url,
      hasIssues: result.hasIssues,
      timestamp: new Date().toISOString(),
      comparisons: result.comparisons.map(c => ({
        viewport: `${c.viewport.width}x${c.viewport.height}`,
        similarity: c.comparison.similarity,
        hasIssues: c.comparison.hasIssues,
        differences: c.comparison.differences,
        addedElements: c.comparison.addedElements,
        removedElements: c.comparison.removedElements,
        details: c.comparison.raw
      }))
    };

    const testPath = path.join(testDir, 'result.json');
    await fs.writeFile(testPath, JSON.stringify(testSummary, null, 2));
  }

  log(`\n📁 Results saved to: ${outputDir}`);
}

/**
 * Display results summary
 */
export function displayResultsSummary(
  results: TestResult[],
  context: ExportContext
): void {
  const { log, progressDisplay } = context;
  
  const totalTests = results.length;
  const testsWithIssues = results.filter(r => r.hasIssues).length;
  const totalComparisons = results.reduce((sum, r) => sum + r.comparisons.length, 0);
  const failedComparisons = results.reduce(
    (sum, r) => sum + r.comparisons.filter(c => c.comparison.hasIssues).length,
    0
  );

  if (progressDisplay) {
    // Display summary in enhanced mode
    progressDisplay.log("\n📊 Results Summary:");
    progressDisplay.log(`  Total Tests: ${totalTests}`);
    progressDisplay.log(`  Tests with Issues: ${testsWithIssues}`);
    progressDisplay.log(`  Total Comparisons: ${totalComparisons}`);
    progressDisplay.log(`  Failed Comparisons: ${failedComparisons}`);
  } else {
    log("\n📊 Results Summary:");
    log(`  Total Tests: ${totalTests}`);
    log(`  Tests with Issues: ${testsWithIssues}`);
    log(`  Total Comparisons: ${totalComparisons}`);
    log(`  Failed Comparisons: ${failedComparisons}`);
    
    if (testsWithIssues === 0) {
      log("\n✅ All tests passed!");
    } else {
      log(`\n⚠️ ${testsWithIssues} test(s) have issues`);
    }
  }
}