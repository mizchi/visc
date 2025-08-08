#!/usr/bin/env node
import { Command } from "commander";
import {
  calibrateComparisonSettings,
  validateWithSettings,
  renderLayoutToSvg,
  renderComparisonToSvg,
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
} from "../index.js";
import puppeteer from "puppeteer";
import type { ComparisonSettings, VisualTreeAnalysis } from "../index.js";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { check as checkCommand } from "./commands/check.js";
import { createCalcCommand } from './commands/calc.js';
import { 
  takePuppeteerScreenshot, 
  takeMultipleScreenshots,
  clearScreenshotCache,
  getCacheStats 
} from "../drivers/puppeteer-screenshot.js";

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
  .option("-o, --output <path>", "Output path for JSON file")
  .option(
    "--viewport <size>",
    "Viewport size (e.g., --viewport=1280x800)",
    "1280x800"
  )
  .option("-f, --full", "Capture full page (default: viewport only)")
  .option("--headless", "Run browser in headless mode", true)
  .option(
    "--wait-until <event>",
    "Wait strategy: load, domcontentloaded, networkidle0, networkidle2",
    "networkidle2"
  )
  .option("--no-wait-lcp", "Disable waiting for Largest Contentful Paint")
  .option(
    "--additional-wait <ms>",
    "Additional wait time after LCP in milliseconds",
    "500"
  )
  .option(
    "--timeout <ms>",
    "Navigation timeout in milliseconds",
    "30000"
  )
  .action(async (url, options) => {
    const spinner = options.output
      ? ora("Fetching layout data...").start()
      : null;

    try {
      const viewport = parseViewport(options.viewport);
      const layout = await fetchLayoutFromUrl(url, {
        viewport,
        headless: options.headless,
        captureFullPage: options.full,
        waitUntil: options.waitUntil,
        waitForLCP: options.waitLcp !== false,
        additionalWait: parseInt(options.additionalWait),
        timeout: parseInt(options.timeout),
      });

      const jsonOutput = JSON.stringify(layout, null, 2);

      if (options.output) {
        await fs.writeFile(options.output, jsonOutput);
        spinner?.succeed(chalk.green(`Layout data saved to ${options.output}`));

        console.log("\n" + chalk.bold("Layout Statistics:"));
        console.log(chalk.gray("─".repeat(40)));
        console.log(`Total Elements: ${layout.elements.length}`);
        console.log(
          `Interactive Elements: ${layout.statistics.interactiveElements}`
        );
        if (layout.visualNodeGroups) {
          console.log(`Visual Node Groups: ${layout.visualNodeGroups.length}`);
        }
      } else {
        // 標準出力に出力
        console.log(jsonOutput);
      }
    } catch (error) {
      spinner?.fail(chalk.red("Failed to fetch layout data"));
      console.error(error);
      process.exit(1);
    }
  });

// visc render - レイアウトデータをSVGに変換
program
  .command("render")
  .description("Render layout as SVG")
  .argument("<source>", "URL or JSON file to render")
  .argument("[compareWith]", "Second source for diff rendering (with --diff)")
  .option("-o, --output <path>", "Output path for SVG file")
  .option("--diff", "Render as diff (requires two sources)")
  .option(
    "--viewport <size>",
    "Viewport size for URL (e.g., --viewport=1280x800)",
    "1280x800"
  )
  .option("--show-labels", "Show element labels", true)
  .option(
    "--highlight-level <level>",
    "Highlight level: subtle, moderate, strong",
    "moderate"
  )
  .action(async (source, compareWith, options) => {
    const spinner = options.output ? ora("Rendering...").start() : null;

    try {
      let svg: string;

      if (options.diff) {
        if (!compareWith) {
          throw new Error("Diff mode requires two sources");
        }

        // 2つのソースから比較
        const layout1 = await loadLayoutFromSource(
          source,
          parseViewport(options.viewport)
        );
        const layout2 = await loadLayoutFromSource(
          compareWith,
          parseViewport(options.viewport)
        );
        const comparison = compareLayoutTrees(layout1, layout2);
        svg = renderComparisonToSvg(comparison, layout1, layout2, {
          showLabels: options.showLabels,
          highlightLevel: options.highlightLevel as any,
        });
      } else {
        // 通常のレイアウトSVG
        const layout = await loadLayoutFromSource(
          source,
          parseViewport(options.viewport)
        );
        svg = renderLayoutToSvg(layout, {
          showLabels: options.showLabels,
        });
      }

      if (options.output) {
        await fs.writeFile(options.output, svg);
        spinner?.succeed(chalk.green(`SVG saved to ${options.output}`));
      } else {
        // 標準出力に出力
        console.log(svg);
      }
    } catch (error) {
      spinner?.fail(chalk.red("Rendering failed"));
      console.error(error);
      process.exit(1);
    }
  });

// visc calibrate - 比較設定を生成
program
  .command("calibrate")
  .description("Generate comparison settings from URL")
  .argument("<url>", "URL to analyze")
  .option("-o, --output <path>", "Output path for settings")
  .option("-n, --samples <number>", "Number of samples", "5")
  .option("-d, --delay <ms>", "Delay between samples", "1000")
  .option(
    "--viewport <size>",
    "Viewport size (e.g., --viewport=1280x800)",
    "1280x800"
  )
  .option("--strictness <level>", "Strictness: low, medium, high", "medium")
  .action(async (url, options) => {
    const spinner = options.output
      ? ora("Collecting samples for calibration...").start()
      : null;

    try {
      const samples: VisualTreeAnalysis[] = [];
      const viewport = parseViewport(options.viewport);
      const sampleCount = parseInt(options.samples);

      for (let i = 0; i < sampleCount; i++) {
        if (spinner)
          spinner.text = `Collecting sample ${i + 1}/${sampleCount}...`;
        const layout = await fetchLayoutFromUrl(url, { viewport });
        samples.push(layout);

        if (i < sampleCount - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, parseInt(options.delay))
          );
        }
      }

      if (spinner) spinner.text = "Calibrating...";
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

      const jsonOutput = JSON.stringify(checkData, null, 2);

      if (options.output) {
        await fs.writeFile(options.output, jsonOutput);
        spinner?.succeed(chalk.green(`Settings saved to ${options.output}`));

        console.log("\n" + chalk.bold("Calibration Results:"));
        console.log(chalk.gray("─".repeat(40)));
        console.log(`Confidence: ${Math.round(calibrationResult.confidence)}%`);
        console.log(
          `Position Tolerance: ${calibrationResult.settings.positionTolerance}px`
        );
        console.log(
          `Size Tolerance: ${calibrationResult.settings.sizeTolerance}%`
        );
      } else {
        // 標準出力に出力
        console.log(jsonOutput);
      }
    } catch (error) {
      spinner?.fail(chalk.red("Calibration failed"));
      console.error(error);
      process.exit(1);
    }
  });

// visc init - Initialize configuration
program
  .command("init")
  .description("Initialize visc configuration file")
  .option("-f, --force", "Overwrite existing configuration")
  .option("-m, --minimal", "Create minimal configuration")
  .action(async (options) => {
    try {
      const { init } = await import("./commands/init.js");
      await init(options);
    } catch (error) {
      console.error(chalk.red("Error:"), error);
      process.exit(1);
    }
  });

// visc check - 設定ファイルベースの視覚回帰テスト
program
  .command("check")
  .description("Run visual regression tests based on configuration file")
  .option("-c, --config <path>", "Configuration file path", "visc.config.json")
  .option("-o, --outdir <path>", "Output directory (overrides config)")
  .option("-p, --parallel [concurrency]", "Run tests in parallel (default: 1)")
  .option(
    "--interval <ms>",
    "Interval between requests in milliseconds (default: 300)"
  )
  .option("-u, --update", "Update baseline snapshots")
  .option("--clear-cache", "Clear cache before running tests")
  .option("--tui", "Use interactive TUI for progress display")
  .option("--only-failed", "Run only tests that failed in the previous run")
  .option("--incremental", "Run only tests that failed or haven't been run yet")
  .option("--retry <count>", "Number of retries for failed tests (default: 0)")
  .option("--id <testId>", "Run specific test by ID")
  .action(async (options) => {
    try {
      // Parse parallel option
      let parallelConcurrency = 1; // Default to sequential
      if (options.parallel !== undefined) {
        if (options.parallel === true) {
          parallelConcurrency = 1; // No longer default to 4
        } else if (typeof options.parallel === "string") {
          // Handle string values (e.g., "4" from -p 4)
          // Commander includes the = in the value for -p=4, so we need to strip it
          const value = options.parallel.startsWith("=")
            ? options.parallel.slice(1)
            : options.parallel;
          parallelConcurrency = parseInt(value, 10);
          if (isNaN(parallelConcurrency) || parallelConcurrency < 1) {
            throw new Error(
              `Invalid parallel concurrency value: ${options.parallel}`
            );
          }
        } else {
          throw new Error(
            `Unexpected parallel option type: ${typeof options.parallel}`
          );
        }
      }

      // Parse interval option
      let interval = 300; // Default interval in ms
      if (options.interval !== undefined) {
        interval = parseInt(options.interval, 10);
        if (isNaN(interval) || interval < 0) {
          throw new Error(`Invalid interval value: ${options.interval}`);
        }
      }

      await checkCommand({
        config: options.config,
        update: options.update,
        only: options.id,
        onlyFailed: options.onlyFailed,
        parallelConcurrency,
        interval,
        retry: options.retry ? parseInt(options.retry, 10) : 0,
        tui: options.tui,
        calibrate: options.calibrate
      });
    } catch (error) {
      console.error(chalk.red("Check failed:"), error);
      process.exit(1);
    }
  });

// visc compare - 2つのファイルまたはURLを比較
program
  .command("compare")
  .description("Compare two sources (files or URLs)")
  .argument("<source1>", "First source (file or URL)")
  .argument("<source2>", "Second source (file or URL)")
  .option("-o, --output <path>", "Output comparison result")
  .option("--threshold <percent>", "Similarity threshold", "90")
  .option(
    "--viewport <size>",
    "Viewport size for URLs (e.g., --viewport=1280x800)",
    "1280x800"
  )
  .action(async (source1, source2, options) => {
    const spinner = options.output ? ora("Comparing layouts...").start() : null;

    try {
      const viewport = parseViewport(options.viewport);
      const layout1 = await loadLayoutFromSource(source1, viewport);
      const layout2 = await loadLayoutFromSource(source2, viewport);

      const comparison = compareLayoutTrees(layout1, layout2);
      const threshold = parseFloat(options.threshold);

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(comparison, null, 2));
      } else {
        // 標準出力に出力
        console.log(JSON.stringify(comparison, null, 2));
      }

      // 結果の表示（stderr に出力して、stdoutのJSONと混ざらないように）
      if (comparison.similarity >= threshold) {
        if (options.output) {
          spinner?.succeed(
            chalk.green(
              `Layouts are similar (${Math.round(comparison.similarity)}%)`
            )
          );
        } else {
          console.error(
            chalk.green(
              `Layouts are similar (${Math.round(comparison.similarity)}%)`
            )
          );
        }
        process.exit(0);
      } else {
        if (options.output) {
          spinner?.fail(
            chalk.red(
              `Layouts differ (${Math.round(
                comparison.similarity
              )}% < ${threshold}%)`
            )
          );
          console.log(`\nChanges: ${comparison.summary.totalChanged} elements`);
          console.log(`Added: ${comparison.summary.totalAdded} elements`);
          console.log(`Removed: ${comparison.summary.totalRemoved} elements`);
        } else {
          console.error(
            chalk.red(
              `Layouts differ (${Math.round(
                comparison.similarity
              )}% < ${threshold}%)`
            )
          );
          console.error(`Changes: ${comparison.summary.totalChanged} elements`);
          console.error(`Added: ${comparison.summary.totalAdded} elements`);
          console.error(`Removed: ${comparison.summary.totalRemoved} elements`);
        }
        process.exit(1);
      }
    } catch (error) {
      spinner?.fail(chalk.red("Comparison failed"));
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
  if (source.startsWith("https://") || source.startsWith("http://")) {
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
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
    waitForLCP?: boolean;
    additionalWait?: number;
    timeout?: number;
  } = {}
): Promise<VisualTreeAnalysis> {
  const {
    viewport = { width: 1280, height: 800 },
    headless = true,
    captureFullPage = false,
    waitUntil = "networkidle2",
    waitForLCP = true,
    additionalWait = 500,
    timeout = 30000,
  } = options;

  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    try {
      await page.goto(url, { waitUntil, timeout });
    } catch (error: any) {
      // Handle navigation timeout errors but continue with data extraction
      if (error.name === 'TimeoutError') {
        console.warn(`Navigation timeout for ${url}, continuing with data extraction...`);
      } else {
        // Re-throw non-timeout errors
        throw error;
      }
    }

    // Wait for LCP if enabled
    if (waitForLCP) {
      try {
        await page.evaluate(() => {
          return new Promise((resolve) => {
            new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              resolve(lastEntry);
            }).observe({ entryTypes: ["largest-contentful-paint"] });

            // Fallback if LCP doesn't fire within 15 seconds
            setTimeout(resolve, 15000);
          });
        });
      } catch (error) {
        console.warn('Failed to wait for LCP, continuing...', error);
      }
    }

    // Additional wait time
    if (additionalWait > 0) {
      await new Promise((resolve) => setTimeout(resolve, additionalWait));
    }

    try {
      const rawData = await fetchRawLayoutData(page, {
        waitForContent: false,
        captureFullPage,
      });
      return extractLayoutTree(rawData, {
        viewportOnly: !captureFullPage,
      });
    } catch (error) {
      console.error('Failed to extract layout data:', error);
      // Return a minimal layout structure to allow the process to continue
      return {
        url: url,
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
      };
    }
  } finally {
    await browser.close();
  }
}

// visc screenshot - Take screenshots using Puppeteer
program
  .command("screenshot")
  .description("Take screenshots of web pages using Puppeteer")
  .argument("<url>", "URL to capture")
  .option("-o, --output <dir>", "Output directory", ".visc/cache/screenshots")
  .option("--viewport <size>", "Viewport size (e.g., 1280x800)", "1280x800")
  .option("-f, --full", "Capture full page (default: viewport only)")
  .option("--format <format>", "Image format: png or jpeg", "jpeg")
  .option("--quality <number>", "JPEG quality (0-100)", "70")
  .option("--clear-cache", "Clear screenshot cache before capture")
  .option("--cache-stats", "Show cache statistics")
  .option("--config <path>", "Path to visc config file", "visc.config.json")
  .option("--viewport-id <id>", "Use viewport from config by ID")
  .action(async (url, options) => {
    const spinner = ora("Taking screenshot...").start();
    
    try {
      // Handle cache operations
      if (options.clearCache) {
        await clearScreenshotCache(options.output);
        spinner.succeed("Cache cleared");
      }
      
      if (options.cacheStats) {
        const stats = await getCacheStats(options.output);
        spinner.stop();
        console.log(chalk.cyan("Cache Statistics:"));
        console.log(`  Total files: ${stats.totalFiles}`);
        console.log(`  Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
        if (stats.oldestFile) {
          console.log(`  Oldest file: ${stats.oldestFile.toLocaleString()}`);
        }
        if (stats.newestFile) {
          console.log(`  Newest file: ${stats.newestFile.toLocaleString()}`);
        }
        return;
      }
      
      // Load config if viewport-id is specified
      let viewport = { width: 1280, height: 800, deviceScaleFactor: 1 };
      
      if (options.viewportId) {
        try {
          const configPath = path.resolve(process.cwd(), options.config);
          const configContent = await fs.readFile(configPath, "utf-8");
          const config = JSON.parse(configContent);
          
          if (config.viewports && config.viewports[options.viewportId]) {
            const vp = config.viewports[options.viewportId];
            viewport = {
              width: vp.width,
              height: vp.height,
              deviceScaleFactor: vp.deviceScaleFactor || 1
            };
            spinner.text = `Using viewport: ${vp.name} (${vp.width}x${vp.height})`;
          } else {
            spinner.warn(`Viewport ID "${options.viewportId}" not found in config`);
          }
        } catch (error) {
          spinner.warn(`Could not load config: ${error}`);
        }
      } else if (options.viewport) {
        // Parse viewport from command line
        const [width, height] = options.viewport.split('x').map(Number);
        if (width && height) {
          viewport = { width, height, deviceScaleFactor: 1 };
        }
      }
      
      spinner.text = `Taking screenshot at ${viewport.width}x${viewport.height}...`;
      
      // Take screenshot
      const result = await takePuppeteerScreenshot({
        url,
        viewport,
        fullPage: options.full || false,
        format: options.format === 'png' ? 'png' : 'jpeg',
        quality: parseInt(options.quality),
        cacheDir: options.output
      });
      
      if (result.cached) {
        spinner.succeed(
          chalk.green(`Screenshot loaded from cache: ${result.path}`) +
          chalk.gray(` (${(result.size / 1024).toFixed(1)} KB)`)
        );
      } else {
        spinner.succeed(
          chalk.green(`Screenshot saved: ${result.path}`) +
          chalk.gray(` (${(result.size / 1024).toFixed(1)} KB, ${result.dimensions.width}x${result.dimensions.height})`)
        );
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed to take screenshot: ${error}`));
      process.exit(1);
    }
  });

// visc screenshot-all - Take screenshots for all viewports in config
program
  .command("screenshot-all")
  .description("Take screenshots for all configured viewports")
  .argument("<url>", "URL to capture")
  .option("-o, --output <dir>", "Output directory", ".visc/cache/screenshots")
  .option("-f, --full", "Capture full page (default: viewport only)")
  .option("--format <format>", "Image format: png or jpeg", "jpeg")
  .option("--quality <number>", "JPEG quality (0-100)", "70")
  .option("--config <path>", "Path to visc config file", "visc.config.json")
  .action(async (url, options) => {
    const spinner = ora("Loading configuration...").start();
    
    try {
      // Load config
      const configPath = path.resolve(process.cwd(), options.config);
      const configContent = await fs.readFile(configPath, "utf-8");
      const config = JSON.parse(configContent);
      
      if (!config.viewports) {
        spinner.fail("No viewports configured in visc.config.json");
        process.exit(1);
      }
      
      // Prepare viewports
      const viewports = Object.entries(config.viewports).map(([id, vp]: [string, any]) => ({
        id,
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.deviceScaleFactor || 1
      }));
      
      spinner.text = `Taking screenshots for ${viewports.length} viewports...`;
      
      // Take screenshots
      const results = await takeMultipleScreenshots(url, viewports, {
        fullPage: options.full || false,
        format: options.format === 'png' ? 'png' : 'jpeg',
        quality: parseInt(options.quality),
        cacheDir: options.output
      });
      
      spinner.succeed(`Screenshots taken for ${results.size} viewports`);
      
      // Display results
      for (const [id, result] of results) {
        const vp = config.viewports[id];
        const status = result.cached ? chalk.yellow("[CACHED]") : chalk.green("[NEW]");
        console.log(
          `  ${status} ${vp.name}: ${result.path} ` +
          chalk.gray(`(${(result.size / 1024).toFixed(1)} KB)`)
        );
      }
      
      // Show total size
      const totalSize = Array.from(results.values()).reduce((sum, r) => sum + r.size, 0);
      console.log(chalk.cyan(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`));
      
    } catch (error) {
      spinner.fail(chalk.red(`Failed: ${error}`));
      process.exit(1);
    }
  });

// Add calc command
program.addCommand(createCalcCommand());

program.parse();
