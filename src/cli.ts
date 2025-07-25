#!/usr/bin/env node

import { Command } from "commander";
import { TestRunner } from "./test-runner.ts";
import { VisualCheckConfig } from "./types.ts";
import { DefaultBrowserRunnerFactory } from "./runner/factory.js";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name("visual-checker")
  .description("Visual regression testing framework")
  .version("0.1.0");

/**
 * 設定ファイルを読み込み
 */
async function loadConfig(configPath: string): Promise<VisualCheckConfig> {
  try {
    // 絶対パスに変換
    const absolutePath = path.isAbsolute(configPath) 
      ? configPath 
      : path.resolve(process.cwd(), configPath);

    // TypeScriptファイルの場合
    if (configPath.endsWith('.ts')) {
      // Dynamic importを使用
      const configModule = await import(absolutePath);
      return configModule.default;
    }
    
    // JSONファイルの場合
    const configContent = await fs.readFile(absolutePath, "utf-8");
    return JSON.parse(configContent);
  } catch (error) {
    console.error(chalk.red(`Failed to load config file: ${configPath}`));
    console.error(error);
    process.exit(1);
  }
}

// testコマンド
program
  .command("test")
  .description("Run visual regression tests")
  .option(
    "-c, --config <path>",
    "Path to config file (.ts or .json)",
    "./visual-check.config.ts"
  )
  .action(async (options) => {
    console.log(chalk.blue.bold("Visual Regression Testing"));
    console.log(chalk.gray(`Config: ${options.config}\n`));

    const config = await loadConfig(options.config);
    const runner = new TestRunner(config);

    try {
      const results = await runner.runTests(false);
      const hasFailures = results.some((r) => !r.passed);
      process.exit(hasFailures ? 1 : 0);
    } catch (error) {
      console.error(chalk.red("Test execution failed:"));
      console.error(error);
      process.exit(1);
    }
  });

// updateコマンド
program
  .command("update")
  .description("Update baseline snapshots")
  .option(
    "-c, --config <path>",
    "Path to config file (.ts or .json)",
    "./visual-check.config.ts"
  )
  .action(async (options) => {
    console.log(chalk.blue.bold("Updating Baseline Snapshots"));
    console.log(chalk.gray(`Config: ${options.config}\n`));

    const config = await loadConfig(options.config);
    const runner = new TestRunner(config);

    try {
      await runner.runTests(true);
      console.log(chalk.green("\n✓ All baselines updated successfully"));
    } catch (error) {
      console.error(chalk.red("Update failed:"));
      console.error(error);
      process.exit(1);
    }
  });

// compareコマンド
program
  .command("compare <baseline> <current>")
  .description("Compare two images directly")
  .option("-t, --threshold <number>", "Difference threshold (0-1)", "0.1")
  .option("-o, --output <path>", "Output path for diff image")
  .action(async (baseline, current, options) => {
    console.log(chalk.blue.bold("Image Comparison"));
    console.log(chalk.gray(`Baseline: ${baseline}`));
    console.log(chalk.gray(`Current: ${current}`));
    console.log(chalk.gray(`Threshold: ${options.threshold}\n`));

    const { SnapshotComparator } = await import("./snapshot-comparator.js");

    const config: VisualCheckConfig = {
      urls: [],
      comparison: {
        threshold: parseFloat(options.threshold),
        generateDiff: !!options.output,
        diffDir: options.output ? path.dirname(options.output) : undefined,
      },
    };

    const comparator = new SnapshotComparator(config);
    const result = await comparator.compare(current, baseline, {
      name: path.basename(current, path.extname(current)),
      url: "",
    });

    if (result.passed) {
      console.log(chalk.green("✓ Images match"));
    } else {
      console.log(chalk.red("✗ Images differ"));
      if (result.error) {
        console.log(chalk.red(`  ${result.error}`));
      }
      if (result.diffPercentage !== undefined) {
        console.log(
          chalk.yellow(
            `  Difference: ${(result.diffPercentage * 100).toFixed(2)}%`
          )
        );
      }
    }

    if (options.output && result.diffImagePath) {
      await fs.rename(result.diffImagePath, options.output);
      console.log(chalk.gray(`  Diff saved to: ${options.output}`));
    }

    process.exit(result.passed ? 0 : 1);
  });

// initコマンド
// flakinessコマンド
program
  .command("flakiness <url>")
  .description("Detect flaky elements by crawling multiple times")
  .option("-n, --iterations <number>", "Number of crawl iterations", "5")
  .option("-d, --delay <ms>", "Delay between crawls in milliseconds", "1000")
  .option("-w, --wait <ms>", "Wait after page load in milliseconds", "1000")
  .option("--threshold <number>", "Flakiness threshold (0-100)", "20")
  .option("-o, --output <path>", "Output path for flakiness report")
  .option("-f, --format <format>", "Report format (text|json|markdown)", "text")
  .option("-v, --verbosity <level>", "Report verbosity (summary|detailed|full)", "detailed")
  .option("--clear-cache", "Clear cache between crawls")
  .option("--clear-cookies", "Clear cookies between crawls")
  .option("--viewport <size>", "Viewport size (e.g., 1280x720)")
  .action(async (url, options) => {
    console.log(chalk.blue.bold("Flakiness Detection"));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Iterations: ${options.iterations}\n`));

    try {
      const { defaultRunnerFactory } = await import("./runner/factory.js");
      const { MultiCrawlManager } = await import("./layout/multi-crawl-manager.js");
      const { generateFlakinessReport } = await import("./layout/flakiness-detector.js");

      // ビューポートサイズの解析
      let viewport = { width: 1280, height: 720 };
      if (options.viewport) {
        const [width, height] = options.viewport.split('x').map(Number);
        if (width && height) {
          viewport = { width, height };
        }
      }

      // ランナーを作成
      const runner = defaultRunnerFactory.create('playwright');
      const browserContext = await runner.launch({ headless: true });
      const pageContext = await runner.newPage(browserContext, { viewport });

      // 複数回クロール実行
      const manager = new MultiCrawlManager(runner, browserContext, pageContext);
      const result = await manager.crawl(url, {
        iterations: parseInt(options.iterations),
        delayBetweenCrawls: parseInt(options.delay),
        waitAfterLoad: parseInt(options.wait),
        clearCache: options.clearCache,
        clearCookies: options.clearCookies,
        clearLocalStorage: options.clearCookies,
        onProgress: (current, total) => {
          process.stdout.write(
            chalk.gray(`\rCrawling... ${current}/${total}`)
          );
        },
      });

      console.log("\n");

      // フレーキーネスレポートを生成
      const report = generateFlakinessReport(result.flakinessAnalysis, {
        verbosity: options.verbosity as any,
        format: options.format as any,
      });

      // レポートを出力
      if (options.output) {
        await fs.writeFile(options.output, report);
        console.log(chalk.green(`Report saved to: ${options.output}`));
      } else {
        console.log(report);
      }

      // サマリーを表示
      if (options.format !== 'text') {
        console.log("\n" + chalk.blue("Summary:"));
        console.log(
          chalk.gray(`Overall flakiness score: `) +
          (result.flakinessAnalysis.overallScore < parseFloat(options.threshold)
            ? chalk.green(`${result.flakinessAnalysis.overallScore.toFixed(1)}%`)
            : chalk.red(`${result.flakinessAnalysis.overallScore.toFixed(1)}%`))
        );
        console.log(
          chalk.gray(`Stable elements: ${result.flakinessAnalysis.stableCount}`)
        );
        console.log(
          chalk.gray(`Unstable elements: ${result.flakinessAnalysis.unstableCount}`)
        );
      }

      await runner.close(browserContext);
      await defaultRunnerFactory.cleanup();

      // フレーキーネスが閾値を超えていたら非ゼロで終了
      const exitCode = result.flakinessAnalysis.overallScore > parseFloat(options.threshold) ? 1 : 0;
      process.exit(exitCode);

    } catch (error) {
      console.error(chalk.red("Flakiness detection failed:"));
      console.error(error);
      process.exit(1);
    }
  });

// stabilityコマンド
program
  .command("stability <url>")
  .description("Crawl until the page becomes stable")
  .option("--max-iterations <number>", "Maximum iterations", "10")
  .option("--min-iterations <number>", "Minimum iterations", "3")
  .option("--stability-threshold <number>", "Stability threshold (0-100)", "95")
  .option("-d, --delay <ms>", "Delay between crawls in milliseconds", "1000")
  .option("-w, --wait <ms>", "Wait after page load in milliseconds", "1000")
  .option("-o, --output <path>", "Output path for stability report")
  .action(async (url, options) => {
    console.log(chalk.blue.bold("Stability Check"));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Stability threshold: ${options.stabilityThreshold}%\n`));

    try {
      const { defaultRunnerFactory } = await import("./runner/factory.js");
      const { MultiCrawlManager } = await import("./layout/multi-crawl-manager.js");
      const { generateFlakinessReport } = await import("./layout/flakiness-detector.js");

      const runner = defaultRunnerFactory.create('playwright');
      const browserContext = await runner.launch({ headless: true });
      const pageContext = await runner.newPage(browserContext);

      const manager = new MultiCrawlManager(runner, browserContext, pageContext);
      const result = await manager.crawlUntilStable(url, {
        maxIterations: parseInt(options.maxIterations),
        minIterations: parseInt(options.minIterations),
        stabilityThreshold: parseFloat(options.stabilityThreshold),
        delayBetweenCrawls: parseInt(options.delay),
        waitAfterLoad: parseInt(options.wait),
        onProgress: (current, isStable) => {
          process.stdout.write(
            chalk.gray(`\rIteration ${current}...`) +
            (isStable ? chalk.green(" (stable)") : "")
          );
        },
      });

      console.log("\n");

      // 結果を表示
      const isStable = result.flakinessAnalysis.overallScore <= (100 - parseFloat(options.stabilityThreshold));
      
      console.log(chalk.blue("Results:"));
      console.log(chalk.gray(`Total iterations: ${result.metadata.totalIterations}`));
      console.log(chalk.gray(`Successful crawls: ${result.metadata.successfulIterations}`));
      console.log(
        chalk.gray(`Stability: `) +
        (isStable 
          ? chalk.green(`${(100 - result.flakinessAnalysis.overallScore).toFixed(1)}% (stable)`)
          : chalk.red(`${(100 - result.flakinessAnalysis.overallScore).toFixed(1)}% (unstable)`))
      );

      if (result.flakinessAnalysis.unstableCount > 0) {
        console.log(chalk.yellow(`\nUnstable elements: ${result.flakinessAnalysis.unstableCount}`));
        const topFlaky = result.flakinessAnalysis.flakyElements.slice(0, 5);
        topFlaky.forEach((element, i) => {
          console.log(chalk.gray(`  ${i + 1}. ${element.path} (${element.flakinessType})`));
        });
      }

      // レポートを保存
      if (options.output) {
        const report = generateFlakinessReport(result.flakinessAnalysis, {
          verbosity: 'full',
          format: 'markdown',
        });
        await fs.writeFile(options.output, report);
        console.log(chalk.green(`\nReport saved to: ${options.output}`));
      }

      await runner.close(browserContext);
      await defaultRunnerFactory.cleanup();
      process.exit(isStable ? 0 : 1);

    } catch (error) {
      console.error(chalk.red("Stability check failed:"));
      console.error(error);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize visual-checker in current directory")
  .action(async () => {
    console.log(chalk.blue.bold("Initializing Visual Checker"));

    const dirs = ["configs", "snapshots", "diffs"];

    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(chalk.green(`✓ Created ${dir}/`));
      } catch (error) {
        console.log(chalk.yellow(`⚠ ${dir}/ already exists`));
        // Error is expected if directory exists
      }
    }

    // サンプル設定ファイルをコピー
    const exampleConfigSrc = path.join(
      __dirname,
      "../configs/example.config.json"
    );
    const exampleConfigDest = "./configs/visual-check.config.json";

    try {
      await fs.copyFile(exampleConfigSrc, exampleConfigDest);
      console.log(chalk.green(`✓ Created ${exampleConfigDest}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠ Config file already exists`));
      // Error is expected if file exists
    }

    console.log(chalk.green("\n✓ Visual Checker initialized successfully"));
    console.log(chalk.gray("\nNext steps:"));
    console.log(chalk.gray("1. Edit configs/visual-check.config.json"));
    console.log(
      chalk.gray(
        "2. Run: visual-checker update -c configs/visual-check.config.json"
      )
    );
    console.log(
      chalk.gray(
        "3. Run: visual-checker test -c configs/visual-check.config.json"
      )
    );
  });

// compareコマンド - レイアウト比較
program
  .command("compare <url1> <url2>")
  .description("Compare layouts between two URLs using rectangle distance")
  .option("--threshold <number>", "Similarity threshold (0-1)", "0.8")
  .option("-o, --output <path>", "Output path for comparison report")
  .option("-v, --viewport <size>", "Viewport size (e.g., 1920x1080)", "1920x1080")
  .option("--position-weight <number>", "Weight for position comparison (0-1)", "0.4")
  .option("--size-weight <number>", "Weight for size comparison (0-1)", "0.4")
  .option("--aspect-ratio-weight <number>", "Weight for aspect ratio comparison (0-1)", "0.2")
  .action(async (url1, url2, options) => {
    console.log(chalk.blue.bold("Layout Comparison"));
    console.log(chalk.gray(`URL1: ${url1}`));
    console.log(chalk.gray(`URL2: ${url2}\n`));

    try {
      // Dynamically import the layout comparison functions
      const { extractSemanticLayoutScript } = await import('./layout/semantic-analyzer.js');
      const { 
        calculateLayoutSimilarity, 
        generateLayoutFingerprint,
        isSameLayoutStructure 
      } = await import('./layout/rect-distance.js');
      
      const runnerFactory = new DefaultBrowserRunnerFactory();
      const runner = runnerFactory.create('playwright');
      const browserContext = await runner.launch({ headless: true });

      // ビューポートサイズを解析
      const [width, height] = options.viewport.split('x').map(Number);
      const viewport = { width, height };

      // レイアウトを抽出
      console.log(chalk.cyan("Extracting layouts..."));
      
      const page1 = await runner.newPage(browserContext, { viewport });
      await runner.goto(page1, url1, { waitUntil: 'networkidle' });
      await runner.wait(1000);
      const layout1 = await runner.evaluate(page1, extractSemanticLayoutScript);
      await runner.closePage(page1);

      const page2 = await runner.newPage(browserContext, { viewport });
      await runner.goto(page2, url2, { waitUntil: 'networkidle' });
      await runner.wait(1000);
      const layout2 = await runner.evaluate(page2, extractSemanticLayoutScript);
      await runner.closePage(page2);

      if (!layout1.semanticGroups || !layout2.semanticGroups) {
        throw new Error('Failed to extract layout information');
      }

      // フィンガープリントを生成
      const fingerprint1 = generateLayoutFingerprint(layout1.semanticGroups);
      const fingerprint2 = generateLayoutFingerprint(layout2.semanticGroups);
      
      console.log(chalk.yellow("\nLayout Fingerprints:"));
      console.log(`URL1: ${fingerprint1.substring(0, 60)}...`);
      console.log(`URL2: ${fingerprint2.substring(0, 60)}...`);

      // 類似性を計算
      const similarity = calculateLayoutSimilarity(
        layout1.semanticGroups, 
        layout2.semanticGroups,
        { 
          viewport,
          positionWeight: parseFloat(options.positionWeight),
          sizeWeight: parseFloat(options.sizeWeight),
          aspectRatioWeight: parseFloat(options.aspectRatioWeight)
        }
      );

      console.log(chalk.yellow("\n📊 Similarity Analysis:"));
      console.log(`Overall similarity: ${chalk.bold((similarity.similarity * 100).toFixed(1) + '%')}`);
      console.log(`Matched groups: ${similarity.matchedGroups.length} / ${Math.max(layout1.semanticGroups.length, layout2.semanticGroups.length)}`);

      // 詳細メトリクス
      console.log(chalk.yellow("\n📏 Detailed Metrics:"));
      console.log(`Position distance: ${similarity.metrics.positionDistance.toFixed(3)}`);
      console.log(`Size distance: ${similarity.metrics.sizeDistance.toFixed(3)}`);
      console.log(`Aspect ratio distance: ${similarity.metrics.aspectRatioDistance.toFixed(3)}`);
      console.log(`Euclidean distance: ${similarity.metrics.euclideanDistance.toFixed(3)}`);

      // 構造の判定
      const threshold = parseFloat(options.threshold);
      const isSameStructure = isSameLayoutStructure(layout1.semanticGroups, layout2.semanticGroups, threshold);
      
      console.log(chalk.yellow("\n🏗️ Structure Analysis:"));
      console.log(`Same structure (threshold ${threshold}): ${isSameStructure ? chalk.green('✓ Yes') : chalk.red('✗ No')}`);

      // マッチしたグループを表示
      if (similarity.matchedGroups.length > 0) {
        console.log(chalk.yellow("\n🔗 Matched Groups:"));
        similarity.matchedGroups.slice(0, 10).forEach((match, index) => {
          console.log(`  ${index + 1}. ${match.group1.type} "${match.group1.label}" ↔ "${match.group2.label}" (${(match.similarity * 100).toFixed(1)}%)`);
        });
        if (similarity.matchedGroups.length > 10) {
          console.log(chalk.gray(`  ... and ${similarity.matchedGroups.length - 10} more`));
        }
      }

      // レポートを保存
      if (options.output) {
        const report = {
          timestamp: new Date().toISOString(),
          url1,
          url2,
          viewport,
          fingerprints: { url1: fingerprint1, url2: fingerprint2 },
          similarity: similarity.similarity,
          metrics: similarity.metrics,
          matchedGroups: similarity.matchedGroups.map(m => ({
            type: m.group1.type,
            label1: m.group1.label,
            label2: m.group2.label,
            similarity: m.similarity
          })),
          isSameStructure,
          threshold
        };

        await fs.writeFile(options.output, JSON.stringify(report, null, 2));
        console.log(chalk.green(`\nReport saved to: ${options.output}`));
      }

      await runner.close(browserContext);
      await runnerFactory.cleanup();
      
      process.exit(isSameStructure ? 0 : 1);

    } catch (error) {
      console.error(chalk.red("Layout comparison failed:"));
      console.error(error);
      process.exit(1);
    }
  });

program.parse(process.argv);
