/**
 * Snapshot Comparator
 * 高度なスナップショット比較機能
 */

import { SnapshotManager } from './manager.js';
import type { CompareResult } from '../../core/types.js';

export interface BatchCompareResult {
  name: string;
  result: CompareResult & { baselinePath: string };
  passed: boolean;
}

/**
 * 複数のスナップショットを一括で比較
 * 
 * @example
 * ```typescript
 * const comparator = new SnapshotComparator('./snapshots');
 * 
 * // 複数の画像を一括比較
 * const results = await comparator.batchCompare([
 *   { name: 'home', currentPath: './screenshots/home.png' },
 *   { name: 'about', currentPath: './screenshots/about.png' }
 * ], { threshold: 0.1 });
 * 
 * // 結果のサマリー
 * const summary = comparator.summarize(results);
 * console.log(`Passed: ${summary.passed}/${summary.total}`);
 * ```
 */
export class SnapshotComparator extends SnapshotManager {
  /**
   * 複数のスナップショットを一括比較
   */
  async batchCompare(
    snapshots: Array<{ name: string; currentPath: string }>,
    options?: {
      threshold?: number;
      generateDiff?: boolean;
      stopOnFailure?: boolean;
    }
  ): Promise<BatchCompareResult[]> {
    const results: BatchCompareResult[] = [];
    
    for (const snapshot of snapshots) {
      try {
        const result = await this.compare(
          snapshot.name,
          snapshot.currentPath,
          {
            threshold: options?.threshold,
            generateDiff: options?.generateDiff
          }
        );
        
        results.push({
          name: snapshot.name,
          result,
          passed: result.match
        });
        
        // 失敗時に停止
        if (options?.stopOnFailure && !result.match) {
          break;
        }
      } catch (error) {
        results.push({
          name: snapshot.name,
          result: {
            match: false,
            difference: 1,
            diffPixels: -1,
            baselinePath: this.getBaselinePath(snapshot.name)
          },
          passed: false
        });
        
        if (options?.stopOnFailure) {
          throw error;
        }
      }
    }
    
    return results;
  }
  
  /**
   * 比較結果のサマリーを生成
   */
  summarize(results: BatchCompareResult[]): {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    failures: Array<{
      name: string;
      difference: number;
      diffPath?: string;
    }>;
  } {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    
    const failures = results
      .filter(r => !r.passed)
      .map(r => ({
        name: r.name,
        difference: r.result.difference,
        diffPath: r.result.diffPath
      }));
    
    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? passed / total : 0,
      failures
    };
  }
  
  /**
   * レポートを生成
   */
  generateReport(results: BatchCompareResult[]): string {
    const summary = this.summarize(results);
    
    let report = '# Visual Regression Test Report\n\n';
    report += `## Summary\n\n`;
    report += `- Total: ${summary.total}\n`;
    report += `- Passed: ${summary.passed}\n`;
    report += `- Failed: ${summary.failed}\n`;
    report += `- Pass Rate: ${(summary.passRate * 100).toFixed(2)}%\n\n`;
    
    if (summary.failures.length > 0) {
      report += `## Failures\n\n`;
      for (const failure of summary.failures) {
        report += `### ${failure.name}\n`;
        report += `- Difference: ${(failure.difference * 100).toFixed(2)}%\n`;
        if (failure.diffPath) {
          report += `- Diff Image: ${failure.diffPath}\n`;
        }
        report += '\n';
      }
    }
    
    report += `## Details\n\n`;
    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      report += `- ${icon} ${result.name}: `;
      report += result.passed ? 'PASSED' : `FAILED (${(result.result.difference * 100).toFixed(2)}% difference)`;
      report += '\n';
    }
    
    return report;
  }
}