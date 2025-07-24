import { BrowserController } from './browser-controller.js';
import { SnapshotComparator } from './snapshot-comparator.js';
import { VisualCheckConfig, TestResult } from './types.js';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

export class TestRunner {
  private browserController: BrowserController;
  private comparator: SnapshotComparator;

  constructor(private config: VisualCheckConfig) {
    this.browserController = new BrowserController(config);
    this.comparator = new SnapshotComparator(config);
  }

  /**
   * すべてのURLをテスト
   */
  async runTests(updateBaseline = false): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    console.log(chalk.blue.bold('\n🔍 Visual Regression Testing\n'));
    
    // ブラウザを起動
    const browserSpinner = ora('Launching browser...').start();
    try {
      await this.browserController.launch();
      browserSpinner.succeed('Browser launched');
    } catch (error) {
      browserSpinner.fail('Failed to launch browser');
      throw error;
    }

    // 各URLをテスト
    for (const urlConfig of this.config.urls) {
      const urlSpinner = ora(`Testing ${chalk.cyan(urlConfig.name)} (${urlConfig.url})`).start();
      const startTime = Date.now();
      
      try {
        // スクリーンショットを撮影
        const currentImagePath = await this.browserController.captureScreenshot(urlConfig);
        
        // ベースラインのパス
        const snapshotDir = this.config.snapshotDir ?? './snapshots';
        const baselineImagePath = path.join(snapshotDir, `${urlConfig.name}-baseline.png`);
        
        let result: TestResult;
        
        if (updateBaseline) {
          // ベースラインを更新
          const fs = await import('fs/promises');
          await fs.copyFile(currentImagePath, baselineImagePath);
          
          result = {
            url: urlConfig,
            passed: true,
            snapshotPath: baselineImagePath,
            duration: Date.now() - startTime,
          };
          
          urlSpinner.succeed(`${chalk.cyan(urlConfig.name)} - Baseline updated`);
        } else {
          // スナップショットを比較
          const comparisonResult = await this.comparator.compare(
            currentImagePath,
            baselineImagePath,
            urlConfig
          );
          
          result = {
            url: urlConfig,
            passed: comparisonResult.passed ?? false,
            error: comparisonResult.error,
            diffPercentage: comparisonResult.diffPercentage,
            diffImagePath: comparisonResult.diffImagePath,
            snapshotPath: currentImagePath,
            duration: Date.now() - startTime,
          };
          
          if (result.passed) {
            urlSpinner.succeed(
              `${chalk.cyan(urlConfig.name)} - ${chalk.green('PASSED')} (${result.duration}ms)`
            );
          } else {
            urlSpinner.fail(
              `${chalk.cyan(urlConfig.name)} - ${chalk.red('FAILED')} (${result.duration}ms)`
            );
            if (result.error) {
              console.log(chalk.red(`  → ${result.error}`));
            }
            if (result.diffImagePath) {
              console.log(chalk.yellow(`  → Diff image: ${result.diffImagePath}`));
            }
          }
        }
        
        results.push(result);
      } catch (error) {
        const duration = Date.now() - startTime;
        urlSpinner.fail(`${chalk.cyan(urlConfig.name)} - ${chalk.red('ERROR')} (${duration}ms)`);
        
        results.push({
          url: urlConfig,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          snapshotPath: '',
          duration,
        });
        
        console.log(chalk.red(`  → ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    // ブラウザを閉じる
    const closeSpinner = ora('Closing browser...').start();
    try {
      await this.browserController.close();
      closeSpinner.succeed('Browser closed');
    } catch (error) {
      closeSpinner.fail('Failed to close browser');
    }

    // サマリーを表示
    this.printSummary(results);

    return results;
  }

  /**
   * テスト結果のサマリーを表示
   */
  private printSummary(results: TestResult[]): void {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`  ✓ ${passed} passed`));
    if (failed > 0) {
      console.log(chalk.red(`  ✗ ${failed} failed`));
    }
    console.log(chalk.gray(`  Total: ${total} tests`));
    console.log(chalk.gray(`  Duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`));
    
    if (failed > 0) {
      console.log('\n' + chalk.red.bold('Failed tests:'));
      results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(chalk.red(`  - ${r.url.name}: ${r.error}`));
        });
    }
  }
}