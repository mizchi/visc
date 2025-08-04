#!/usr/bin/env node
import { Command } from "commander";
import {
  calibrateComparisonSettings,
  validateWithSettings,
  renderLayoutToSvg,
  renderComparisonToSvg,
  getVisualNodeGroupStatistics,
  compareFlattenedGroups,
  generateChangeSummary,
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
} from "./index.js";
import puppeteer from "puppeteer";
import type { ComparisonSettings, VisualTreeAnalysis } from "./index.js";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";

const program = new Command();

program
  .name("visual-checker")
  .description("Visual regression testing tool with adaptive calibration")
  .version("2.0.0");

// calibrate コマンド - 比較設定の自動生成
program
  .command("calibrate")
  .description("Generate comparison settings by analyzing multiple samples")
  .argument("<url>", "URL to analyze")
  .option("-n, --samples <number>", "Number of samples to collect", "5")
  .option("-d, --delay <ms>", "Delay between samples in milliseconds", "1000")
  .option(
    "-o, --output <path>",
    "Output path for settings file",
    "./visual-checker-settings.json"
  )
  .option("--viewport <size>", 'Viewport size (e.g., "1280x800")', "1280x800")
  .option(
    "--strictness <level>",
    "Strictness level: low, medium, high",
    "medium"
  )
  .option("--headless", "Run browser in headless mode", true)
  .option(
    "--grouping-threshold <number>",
    "Threshold for semantic grouping",
    "20"
  )
  .option(
    "--importance-threshold <number>",
    "Minimum importance for elements",
    "10"
  )
  .action(async (url, options) => {
    const spinner = ora("Collecting samples for calibration...").start();

    try {
      const samples: VisualTreeAnalysis[] = [];
      const viewport = parseViewport(options.viewport);
      const sampleCount = parseInt(options.samples);

      // サンプルを収集
      for (let i = 0; i < sampleCount; i++) {
        spinner.text = `Collecting sample ${i + 1}/${sampleCount}...`;
        const layout = await fetchLayoutFromUrl(url, {
          viewport,
          headless: options.headless,
          groupingThreshold: parseFloat(options.groupingThreshold),
          importanceThreshold: parseFloat(options.importanceThreshold),
        });
        samples.push(layout);

        if (i < sampleCount - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(options.delay))
          );
        }
      }

      spinner.text = "Calibrating comparison settings...";

      // 設定を生成
      const calibrationResult = calibrateComparisonSettings(samples, {
        strictness: options.strictness as "low" | "medium" | "high",
      });

      // 設定を保存
      await fs.writeFile(
        options.output,
        JSON.stringify(
          {
            settings: calibrationResult.settings,
            calibration: {
              url,
              timestamp: new Date().toISOString(),
              sampleCount,
              confidence: calibrationResult.confidence,
              stats: calibrationResult.sampleStats,
            },
          },
          null,
          2
        )
      );

      spinner.succeed(
        chalk.green(`Calibration complete! Settings saved to ${options.output}`)
      );

      console.log("\n" + chalk.bold("Calibration Results:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(
        `Position Tolerance: ${calibrationResult.settings.positionTolerance}px`
      );
      console.log(
        `Size Tolerance: ${calibrationResult.settings.sizeTolerance}%`
      );
      console.log(
        `Text Similarity: ${Math.round(
          calibrationResult.settings.textSimilarityThreshold * 100
        )}%`
      );
      console.log(`Confidence: ${Math.round(calibrationResult.confidence)}%`);
    } catch (error) {
      spinner.fail(chalk.red("Calibration failed"));
      console.error(error);
      process.exit(1);
    }
  });

// validate コマンド - キャリブレーション済み設定での検証
program
  .command("validate")
  .description("Validate a URL against calibrated settings")
  .argument("<url>", "URL to validate")
  .option(
    "-s, --settings <path>",
    "Path to settings file",
    "./visual-checker-settings.json"
  )
  .option("-b, --baseline <path>", "Path to baseline layout file (optional)")
  .option(
    "-o, --output <dir>",
    "Output directory for results",
    "./visual-checker-output"
  )
  .option("--viewport <size>", "Viewport size (overrides settings)", "")
  .option("--save-svg", "Save SVG visualizations", false)
  .action(async (url, options) => {
    const spinner = ora("Loading settings...").start();

    try {
      // 設定を読み込む
      const settingsData = JSON.parse(
        await fs.readFile(options.settings, "utf-8")
      );
      const settings: ComparisonSettings = settingsData.settings;

      // ビューポートサイズを決定
      const viewport = options.viewport
        ? parseViewport(options.viewport)
        : settingsData.calibration?.viewport || { width: 1280, height: 800 };

      spinner.text = "Fetching current layout...";

      // 現在のレイアウトを取得
      const currentLayout = await fetchLayoutFromUrl(url, {
        viewport,
        groupingThreshold: settingsData.groupingThreshold || 20,
        importanceThreshold: settingsData.importanceThreshold || 10,
      });

      // ベースラインを取得または作成
      let baselineLayout: VisualTreeAnalysis;
      if (options.baseline) {
        spinner.text = "Loading baseline...";
        baselineLayout = JSON.parse(
          await fs.readFile(options.baseline, "utf-8")
        );
      } else {
        spinner.text = "Creating baseline...";
        // ベースラインがない場合は、現在のレイアウトをベースラインとして使用
        baselineLayout = currentLayout;
        const baselinePath = path.join(options.output, "baseline.json");
        await fs.mkdir(options.output, { recursive: true });
        await fs.writeFile(
          baselinePath,
          JSON.stringify(baselineLayout, null, 2)
        );
        spinner.info(
          chalk.yellow(
            `No baseline provided. Saved current layout as baseline: ${baselinePath}`
          )
        );
        process.exit(0);
      }

      spinner.text = "Validating layout...";

      // 検証を実行
      const validationResult = validateWithSettings(
        currentLayout,
        baselineLayout,
        settings
      );

      // 結果を保存
      await fs.mkdir(options.output, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const resultPath = path.join(
        options.output,
        `validation-${timestamp}.json`
      );
      await fs.writeFile(
        resultPath,
        JSON.stringify(
          {
            url,
            timestamp: new Date().toISOString(),
            result: validationResult,
            settings,
          },
          null,
          2
        )
      );

      // SVGを保存（オプション）
      if (options.saveSvg) {
        spinner.text = "Generating visualizations...";

        // 現在のレイアウトのSVG
        const layoutSvg = renderLayoutToSvg(currentLayout);
        await fs.writeFile(
          path.join(options.output, `layout-${timestamp}.svg`),
          layoutSvg
        );

        // 比較結果のSVG
        const comparison = compareLayoutTrees(baselineLayout, currentLayout);
        const diffSvg = renderComparisonToSvg(
          comparison,
          baselineLayout,
          currentLayout
        );
        await fs.writeFile(
          path.join(options.output, `diff-${timestamp}.svg`),
          diffSvg
        );
      }

      // 結果を表示
      if (validationResult.isValid) {
        spinner.succeed(chalk.green("Validation passed!"));
      } else {
        spinner.fail(chalk.red("Validation failed!"));
      }

      console.log("\n" + chalk.bold("Validation Results:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(`Similarity: ${Math.round(validationResult.similarity)}%`);
      console.log(`Total Elements: ${validationResult.summary.totalElements}`);
      console.log(
        `Changed Elements: ${validationResult.summary.changedElements}`
      );
      console.log(
        `Critical Violations: ${validationResult.summary.criticalViolations}`
      );
      console.log(`Warnings: ${validationResult.summary.warnings}`);

      if (validationResult.violations.length > 0) {
        console.log("\n" + chalk.bold("Violations:"));
        validationResult.violations.slice(0, 10).forEach((v) => {
          const icon = v.severity === "high" ? "❌" : "⚠️";
          console.log(
            `${icon} ${v.elementId}: ${v.type} (expected: ${
              v.expected
            }, actual: ${Math.round(v.actual)})`
          );
        });

        if (validationResult.violations.length > 10) {
          console.log(
            chalk.gray(
              `... and ${
                validationResult.violations.length - 10
              } more violations`
            )
          );
        }
      }

      console.log("\n" + chalk.gray(`Results saved to: ${resultPath}`));

      process.exit(validationResult.isValid ? 0 : 1);
    } catch (error) {
      spinner.fail(chalk.red("Validation failed"));
      console.error(error);
      process.exit(1);
    }
  });

// compare コマンド - 2つのURLまたはファイルを比較
program
  .command("compare")
  .description("Compare two URLs or layout files")
  .argument("<source1>", "First URL or layout file")
  .argument("<source2>", "Second URL or layout file")
  .option("-o, --output <dir>", "Output directory", "./visual-checker-output")
  .option("--viewport <size>", "Viewport size for URLs", "1280x800")
  .option("--threshold <number>", "Similarity threshold (0-100)", "90")
  .option("-f, --full", "Capture full page (default: viewport only)")
  .action(async (source1, source2, options) => {
    const spinner = ora("Loading layouts...").start();

    try {
      // レイアウトを取得
      const layout1 = await loadLayoutFromSource(
        source1,
        parseViewport(options.viewport),
        spinner,
        options.full
      );
      const layout2 = await loadLayoutFromSource(
        source2,
        parseViewport(options.viewport),
        spinner,
        options.full
      );

      spinner.text = "Comparing layouts...";

      // 比較を実行
      const comparison = compareLayoutTrees(layout1, layout2);

      // セマンティックグループのフラット比較も実行
      const flatComparison = compareFlattenedGroups(layout1, layout2);

      // 結果を保存
      await fs.mkdir(options.output, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // 比較結果を保存
      await fs.writeFile(
        path.join(options.output, `comparison-${timestamp}.json`),
        JSON.stringify(comparison, null, 2)
      );

      // フラット比較結果も保存
      await fs.writeFile(
        path.join(options.output, `flat-comparison-${timestamp}.json`),
        JSON.stringify(flatComparison, null, 2)
      );

      // SVGを生成
      spinner.text = "Generating visualizations...";

      const svg1 = renderLayoutToSvg(layout1);
      const svg2 = renderLayoutToSvg(layout2);
      const diffSvg = renderComparisonToSvg(comparison, layout1, layout2);

      await fs.writeFile(
        path.join(options.output, `layout1-${timestamp}.svg`),
        svg1
      );
      await fs.writeFile(
        path.join(options.output, `layout2-${timestamp}.svg`),
        svg2
      );
      await fs.writeFile(
        path.join(options.output, `diff-${timestamp}.svg`),
        diffSvg
      );

      const threshold = parseFloat(options.threshold);

      // セマンティックグループがある場合はフラット比較の結果を優先
      const similarityToCheck =
        flatComparison.statistics.totalBaselineGroups > 0
          ? flatComparison.totalSimilarity
          : comparison.similarity;

      const passed = similarityToCheck >= threshold;

      if (passed) {
        spinner.succeed(
          chalk.green(`Layouts are similar (${Math.round(similarityToCheck)}%)`)
        );
      } else {
        spinner.fail(
          chalk.red(
            `Layouts differ too much (${Math.round(
              similarityToCheck
            )}% < ${threshold}%)`
          )
        );
      }

      console.log("\n" + chalk.bold("Element-Level Comparison:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(`Total Elements: ${comparison.summary.totalElements}`);
      console.log(`Changed: ${comparison.summary.totalChanged}`);
      console.log(`Added: ${comparison.summary.totalAdded}`);
      console.log(`Removed: ${comparison.summary.totalRemoved}`);

      if (flatComparison.statistics.totalBaselineGroups > 0) {
        console.log("\n" + chalk.bold("Visual Node Group Comparison:"));
        console.log(chalk.gray("─".repeat(40)));
        console.log(generateChangeSummary(flatComparison));
      }

      console.log("\n" + chalk.gray(`Results saved to: ${options.output}`));

      process.exit(passed ? 0 : 1);
    } catch (error) {
      spinner.fail(chalk.red("Comparison failed"));
      console.error(error);
      process.exit(1);
    }
  });

// extract コマンド - レイアウトデータを抽出
program
  .command("extract")
  .description("Extract layout data from a URL")
  .argument("<url>", "URL to extract")
  .option("-o, --output <path>", "Output file path", "./layout.json")
  .option("--viewport <size>", "Viewport size", "1280x800")
  .option("--svg", "Also save as SVG", false)
  .option(
    "--grouping-threshold <number>",
    "Threshold for semantic grouping",
    "20"
  )
  .option(
    "--importance-threshold <number>",
    "Minimum importance for elements",
    "10"
  )
  .action(async (url, options) => {
    const spinner = ora("Extracting layout...").start();

    try {
      const viewport = parseViewport(options.viewport);
      const layout = await fetchLayoutFromUrl(url, {
        viewport,
        groupingThreshold: parseFloat(options.groupingThreshold),
        importanceThreshold: parseFloat(options.importanceThreshold),
      });

      // JSONを保存
      await fs.writeFile(options.output, JSON.stringify(layout, null, 2));

      // SVGも保存（オプション）
      if (options.svg) {
        const svg = renderLayoutToSvg(layout);
        const svgPath = options.output.replace(/\.json$/, ".svg");
        await fs.writeFile(svgPath, svg);
        spinner.succeed(
          chalk.green(`Layout extracted to ${options.output} and ${svgPath}`)
        );
      } else {
        spinner.succeed(chalk.green(`Layout extracted to ${options.output}`));
      }

      console.log("\n" + chalk.bold("Layout Statistics:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(`Total Raw Elements: ${layout.elements.length}`);
      console.log(
        `Interactive Elements: ${layout.statistics.interactiveElements}`
      );
      if (layout.visualNodeGroups) {
        console.log(`Visual Node Groups: ${layout.visualNodeGroups.length}`);

        const stats = getVisualNodeGroupStatistics(layout.visualNodeGroups);
        console.log(
          `Group Types: ${Object.entries(stats.groupsByType)
            .map(([type, count]) => `${type}(${count})`)
            .join(", ")}`
        );
        console.log(`Max Depth: ${stats.maxDepth}`);
        console.log(
          `Avg Children per Group: ${stats.averageChildrenPerGroup.toFixed(1)}`
        );
      }
    } catch (error) {
      spinner.fail(chalk.red("Extraction failed"));
      console.error(error);
      process.exit(1);
    }
  });

// ヘルパー関数

function parseViewport(viewportStr: string): { width: number; height: number } {
  const [width, height] = viewportStr.split("x").map(Number);
  return { width, height };
}

async function loadLayoutFromSource(
  source: string,
  viewport: { width: number; height: number },
  spinner: any,
  captureFullPage: boolean = false
): Promise<VisualTreeAnalysis> {
  if (
    source.startsWith("http://") ||
    source.startsWith("https://") ||
    source.startsWith("file://")
  ) {
    spinner.text = `Fetching layout from ${source}...`;
    return await fetchLayoutFromUrl(source, {
      viewport,
      groupingThreshold: 20,
      importanceThreshold: 10,
      waitForContent: captureFullPage,
      captureFullPage,
    });
  } else {
    spinner.text = `Loading layout from ${source}...`;
    return JSON.parse(await fs.readFile(source, "utf-8"));
  }
}

// ヘルパー関数: URLからレイアウトを取得
async function fetchLayoutFromUrl(
  url: string,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    groupingThreshold?: number;
    importanceThreshold?: number;
    waitForContent?: boolean;
    captureFullPage?: boolean;
  } = {}
): Promise<VisualTreeAnalysis> {
  const {
    viewport = { width: 1280, height: 800 },
    headless = true,
    waitForContent = false,
    captureFullPage = false,
    ...extractOptions
  } = options;

  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil: "networkidle0" });
    const rawData = await fetchRawLayoutData(page, {
      waitForContent,
      captureFullPage,
    });
    return extractLayoutTree(rawData, {
      ...extractOptions,
      viewportOnly: !captureFullPage,
    });
  } finally {
    await browser.close();
  }
}

program.parse();
