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
  .name("visc")
  .description("Visual regression testing CLI tool")
  .version("0.1.0");

// visc get - URLからレイアウトデータを取得
program
  .command("get")
  .description("Get layout data from URL")
  .argument("<url>", "URL to fetch")
  .option("-o, --output <path>", "Output path for JSON file", "raw.json")
  .option("--viewport <size>", "Viewport size (e.g., 1280x800)", "1280x800")
  .option("-f, --full", "Capture full page (default: viewport only)")
  .option("--headless", "Run browser in headless mode", true)
  .action(async (url, options) => {
    const spinner = ora("Fetching layout data...").start();

    try {
      const viewport = parseViewport(options.viewport);
      const layout = await fetchLayoutFromUrl(url, {
        viewport,
        headless: options.headless,
        captureFullPage: options.full,
      });

      await fs.writeFile(options.output, JSON.stringify(layout, null, 2));
      spinner.succeed(chalk.green(`Layout data saved to ${options.output}`));

      console.log("\n" + chalk.bold("Layout Statistics:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(`Total Elements: ${layout.elements.length}`);
      console.log(`Interactive Elements: ${layout.statistics.interactiveElements}`);
      if (layout.visualNodeGroups) {
        console.log(`Visual Node Groups: ${layout.visualNodeGroups.length}`);
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to fetch layout data"));
      console.error(error);
      process.exit(1);
    }
  });

// visc render - レイアウトデータをSVGに変換
program
  .command("render")
  .description("Render layout or diff as SVG")
  .argument("<source>", "URL or JSON file to render")
  .argument("[type]", "Type: layout (default) or diff", "layout")
  .argument("[compareWith]", "Second file for diff rendering")
  .option("-o, --output <path>", "Output path for SVG file", "layout.svg")
  .option("--viewport <size>", "Viewport size for URL", "1280x800")
  .option("--show-labels", "Show element labels", true)
  .option("--highlight-level <level>", "Highlight level: subtle, moderate, strong", "moderate")
  .action(async (source, type, compareWith, options) => {
    const spinner = ora("Rendering...").start();

    try {
      if (type === "diff") {
        // diff.jsonからdiff SVGを生成
        if (!compareWith) {
          // sourceがdiff.jsonの場合
          const diffData = JSON.parse(await fs.readFile(source, "utf-8"));
          if (!diffData.baseline || !diffData.current || !diffData.comparison) {
            throw new Error("Invalid diff file format");
          }
          const svg = renderComparisonToSvg(
            diffData.comparison,
            diffData.baseline,
            diffData.current,
            {
              showLabels: options.showLabels,
              highlightLevel: options.highlightLevel as any,
            }
          );
          await fs.writeFile(options.output, svg);
        } else {
          // 2つのファイルから比較
          const layout1 = await loadLayoutFromSource(source, parseViewport(options.viewport));
          const layout2 = await loadLayoutFromSource(compareWith, parseViewport(options.viewport));
          const comparison = compareLayoutTrees(layout1, layout2);
          const svg = renderComparisonToSvg(comparison, layout1, layout2, {
            showLabels: options.showLabels,
            highlightLevel: options.highlightLevel as any,
          });
          await fs.writeFile(options.output, svg);
        }
      } else {
        // 通常のレイアウトSVG
        const layout = await loadLayoutFromSource(source, parseViewport(options.viewport));
        const svg = renderLayoutToSvg(layout, {
          showLabels: options.showLabels,
        });
        await fs.writeFile(options.output, svg);
      }

      spinner.succeed(chalk.green(`SVG saved to ${options.output}`));
    } catch (error) {
      spinner.fail(chalk.red("Rendering failed"));
      console.error(error);
      process.exit(1);
    }
  });

// visc calibrate - 比較設定を生成
program
  .command("calibrate")
  .description("Generate comparison settings from URL")
  .argument("<url>", "URL to analyze")
  .option("-o, --output <path>", "Output path for settings", "check.json")
  .option("-n, --samples <number>", "Number of samples", "5")
  .option("-d, --delay <ms>", "Delay between samples", "1000")
  .option("--viewport <size>", "Viewport size", "1280x800")
  .option("--strictness <level>", "Strictness: low, medium, high", "medium")
  .action(async (url, options) => {
    const spinner = ora("Collecting samples for calibration...").start();

    try {
      const samples: VisualTreeAnalysis[] = [];
      const viewport = parseViewport(options.viewport);
      const sampleCount = parseInt(options.samples);

      for (let i = 0; i < sampleCount; i++) {
        spinner.text = `Collecting sample ${i + 1}/${sampleCount}...`;
        const layout = await fetchLayoutFromUrl(url, { viewport });
        samples.push(layout);

        if (i < sampleCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, parseInt(options.delay)));
        }
      }

      spinner.text = "Calibrating...";
      const calibrationResult = calibrateComparisonSettings(samples, {
        strictness: options.strictness as any,
      });

      const checkData = {
        url,
        settings: calibrationResult.settings,
        calibration: {
          timestamp: new Date().toISOString(),
          sampleCount,
          confidence: calibrationResult.confidence,
          stats: calibrationResult.sampleStats,
          viewport,
        },
      };

      await fs.writeFile(options.output, JSON.stringify(checkData, null, 2));
      spinner.succeed(chalk.green(`Settings saved to ${options.output}`));

      console.log("\n" + chalk.bold("Calibration Results:"));
      console.log(chalk.gray("─".repeat(40)));
      console.log(`Confidence: ${Math.round(calibrationResult.confidence)}%`);
      console.log(`Position Tolerance: ${calibrationResult.settings.positionTolerance}px`);
      console.log(`Size Tolerance: ${calibrationResult.settings.sizeTolerance}%`);
    } catch (error) {
      spinner.fail(chalk.red("Calibration failed"));
      console.error(error);
      process.exit(1);
    }
  });

// visc check - URLを設定と比較
program
  .command("check")
  .description("Check URL against settings")
  .argument("<settings>", "Settings file (check.json)")
  .option("--url <url>", "URL to check (overrides settings)")
  .action(async (settingsPath, options) => {
    const spinner = ora("Loading settings...").start();

    try {
      const checkData = JSON.parse(await fs.readFile(settingsPath, "utf-8"));
      const url = options.url || checkData.url;
      const settings: ComparisonSettings = checkData.settings;
      const viewport = checkData.calibration?.viewport || { width: 1280, height: 800 };

      spinner.text = "Fetching current layout...";
      const currentLayout = await fetchLayoutFromUrl(url, { viewport });

      // ベースラインを作成（キャリブレーション時の最初のサンプルと同等）
      spinner.text = "Fetching baseline...";
      const baselineLayout = await fetchLayoutFromUrl(url, { viewport });

      spinner.text = "Validating...";
      const validationResult = validateWithSettings(currentLayout, baselineLayout, settings);

      if (validationResult.isValid) {
        spinner.succeed(chalk.green("Check passed!"));
        console.log(`Similarity: ${Math.round(validationResult.similarity)}%`);
        process.exit(0);
      } else {
        spinner.fail(chalk.red("Check failed!"));
        console.log(`Similarity: ${Math.round(validationResult.similarity)}%`);
        console.log(`Critical Violations: ${validationResult.summary.criticalViolations}`);
        console.log(`Warnings: ${validationResult.summary.warnings}`);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red("Check failed"));
      console.error(error);
      process.exit(1);
    }
  });

// visc compare - 2つのファイルを比較
program
  .command("compare")
  .description("Compare two layout files")
  .argument("<file1>", "First layout file")
  .argument("<file2>", "Second layout file")
  .option("-o, --output <path>", "Output comparison result", "comparison.json")
  .option("--threshold <percent>", "Similarity threshold", "90")
  .action(async (file1, file2, options) => {
    const spinner = ora("Comparing layouts...").start();

    try {
      const layout1 = JSON.parse(await fs.readFile(file1, "utf-8"));
      const layout2 = JSON.parse(await fs.readFile(file2, "utf-8"));

      const comparison = compareLayoutTrees(layout1, layout2);
      const threshold = parseFloat(options.threshold);

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(comparison, null, 2));
      }

      if (comparison.similarity >= threshold) {
        spinner.succeed(chalk.green(`Layouts are similar (${Math.round(comparison.similarity)}%)`));
        process.exit(0);
      } else {
        spinner.fail(chalk.red(`Layouts differ (${Math.round(comparison.similarity)}% < ${threshold}%)`));
        console.log(`\nChanges: ${comparison.summary.totalChanged} elements`);
        console.log(`Added: ${comparison.summary.totalAdded} elements`);
        console.log(`Removed: ${comparison.summary.totalRemoved} elements`);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red("Comparison failed"));
      console.error(error);
      process.exit(1);
    }
  });

// visc <url> - ショートカットコマンド
program
  .argument("<url>", "URL to process")
  .option("--outdir <dir>", "Output directory", "out")
  .description("Process URL (calibrate and generate files)")
  .action(async (url, options) => {
    const spinner = ora("Processing URL...").start();

    try {
      await fs.mkdir(options.outdir, { recursive: true });

      // 1. レイアウトデータを取得
      spinner.text = "Fetching layout data...";
      const layout = await fetchLayoutFromUrl(url);
      const rawPath = path.join(options.outdir, "raw.json");
      await fs.writeFile(rawPath, JSON.stringify(layout, null, 2));

      // 2. SVGを生成
      spinner.text = "Generating SVG...";
      const svg = renderLayoutToSvg(layout);
      const svgPath = path.join(options.outdir, "layout.svg");
      await fs.writeFile(svgPath, svg);

      // 3. キャリブレーション
      spinner.text = "Calibrating...";
      const samples: VisualTreeAnalysis[] = [];
      for (let i = 0; i < 3; i++) {
        const sample = await fetchLayoutFromUrl(url);
        samples.push(sample);
        if (i < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      const calibrationResult = calibrateComparisonSettings(samples);
      const checkPath = path.join(options.outdir, "check.json");
      await fs.writeFile(
        checkPath,
        JSON.stringify(
          {
            url,
            settings: calibrationResult.settings,
            calibration: {
              timestamp: new Date().toISOString(),
              sampleCount: 3,
              confidence: calibrationResult.confidence,
              viewport: { width: 1280, height: 800 },
            },
          },
          null,
          2
        )
      );

      spinner.succeed(chalk.green(`Files generated in ${options.outdir}/`));
      console.log("\n" + chalk.bold("Generated files:"));
      console.log(`  - ${rawPath} (layout data)`);
      console.log(`  - ${svgPath} (visualization)`);
      console.log(`  - ${checkPath} (comparison settings)`);
    } catch (error) {
      spinner.fail(chalk.red("Processing failed"));
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
  viewport: { width: number; height: number }
): Promise<VisualTreeAnalysis> {
  if (source.startsWith("http://") || source.startsWith("https://")) {
    return await fetchLayoutFromUrl(source, { viewport });
  } else {
    return JSON.parse(await fs.readFile(source, "utf-8"));
  }
}

async function fetchLayoutFromUrl(
  url: string,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    captureFullPage?: boolean;
  } = {}
): Promise<VisualTreeAnalysis> {
  const {
    viewport = { width: 1280, height: 800 },
    headless = true,
    captureFullPage = false,
  } = options;

  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil: "networkidle0" });
    const rawData = await fetchRawLayoutData(page, {
      waitForContent: false,
      captureFullPage,
    });
    return extractLayoutTree(rawData, {
      viewportOnly: !captureFullPage,
    });
  } finally {
    await browser.close();
  }
}

program.parse();