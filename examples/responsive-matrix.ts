/**
 * Responsive matrix testing example
 * Tests layout consistency across different viewport sizes
 */

import puppeteer from "puppeteer";
import * as fs from "fs/promises";
import * as path from "path";
import { stdout } from "process";
import {
  captureLayouts,
  captureLayout,
  compareLayouts,
  collectCaptures,
  generateSummary,
  renderLayoutToSvg,
  renderComparisonToSvg,
  type Viewport,
  type TestCase,
  type VisualTreeAnalysis,
  type CaptureResult,
  type TestResult,
} from "@mizchi/visc";

// Configuration
const VIEWPORTS: Record<string, Viewport> = {
  mobile: {
    name: "Mobile",
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone)",
  },
  tablet: {
    name: "Tablet",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPad)",
  },
  desktop: {
    name: "Desktop",
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Mac)",
  },
};

const TEST_CASES: TestCase[] = [
  { id: "top", url: "https://zenn.dev", description: "Zenn top page" },
  {
    id: "article",
    url: "https://zenn.dev/mizchi/articles/claude-code-cheatsheet",
    description: "Article",
  },
];

const OUTPUT_DIR = "./examples/matrix-output";

// Progress bar helpers
function renderProgressBar(current: number, total: number, label: string = "") {
  const width = 30;
  const percent = Math.floor((current / total) * 100);
  const filled = Math.floor((current / total) * width);
  const empty = width - filled;
  
  const bar = `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  const progress = `${current}/${total}`;
  
  stdout.write(`\r${bar} ${progress} ${percent}% ${label}`);
  
  if (current === total) {
    stdout.write('\n');
  }
}

function clearLine() {
  stdout.write('\r' + ' '.repeat(80) + '\r');
}

// Storage helpers
const storage = {
  async readSnapshot(
    testId: string,
    viewport: Viewport
  ): Promise<VisualTreeAnalysis | null> {
    try {
      const path = `${OUTPUT_DIR}/${testId}/${viewport.width}x${viewport.height}.json`;
      return JSON.parse(await fs.readFile(path, "utf-8"));
    } catch {
      return null;
    }
  },

  async writeSnapshot(
    testId: string,
    viewport: Viewport,
    layout: VisualTreeAnalysis
  ) {
    const dir = path.join(OUTPUT_DIR, testId);
    await fs.mkdir(dir, { recursive: true });

    const filename = `${viewport.width}x${viewport.height}`;
    await fs.writeFile(
      `${dir}/${filename}.json`,
      JSON.stringify(layout, null, 2)
    );
    await fs.writeFile(
      `${dir}/${filename}.svg`,
      renderLayoutToSvg(layout, { showLabels: true })
    );
  },

  async writeComparison(
    testId: string,
    viewport: Viewport,
    comparison: any,
    previousLayout: VisualTreeAnalysis,
    currentLayout: VisualTreeAnalysis
  ) {
    const dir = path.join(OUTPUT_DIR, testId);
    const filename = `${viewport.width}x${viewport.height}`;

    await fs.writeFile(
      `${dir}/diff-${filename}.json`,
      JSON.stringify(comparison, null, 2)
    );
    await fs.writeFile(
      `${dir}/diff-${filename}.svg`,
      renderComparisonToSvg(comparison, previousLayout, currentLayout, {
        showUnchanged: true,
        highlightLevel: "moderate",
      })
    );
  },

  async loadAll(): Promise<Map<string, Map<string, VisualTreeAnalysis>>> {
    const results = new Map();

    for (const test of TEST_CASES) {
      const viewportMap = new Map();
      for (const [key, viewport] of Object.entries(VIEWPORTS)) {
        const snapshot = await storage.readSnapshot(test.id, viewport);
        if (snapshot) viewportMap.set(key, snapshot);
      }
      if (viewportMap.size > 0) results.set(test.id, viewportMap);
    }

    return results;
  },

  async writeSummary(summary: any) {
    await fs.writeFile(
      `${OUTPUT_DIR}/result.json`,
      JSON.stringify(summary, null, 2)
    );
  },

  async readCalibration(testId: string): Promise<any | null> {
    try {
      const path = `${OUTPUT_DIR}/${testId}/calibration.json`;
      return JSON.parse(await fs.readFile(path, "utf-8"));
    } catch {
      return null;
    }
  },

  async writeCalibration(testId: string, settings: any) {
    const dir = path.join(OUTPUT_DIR, testId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      `${dir}/calibration.json`,
      JSON.stringify(settings, null, 2)
    );
  },
};

// Capture phase
async function runCapture(options: any): Promise<CaptureResult[]> {
  // Clear all caches if --update flag is set
  if (options.forceUpdate) {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  }

  const browser = await puppeteer.launch({ headless: true });
  const previousResults = options.forceUpdate ? new Map() : await storage.loadAll();
  const captures: CaptureResult[] = [];
  
  const totalSteps = TEST_CASES.length * Object.keys(VIEWPORTS).length;
  let currentStep = 0;

  console.log(`📥 Capture Phase\n`);

  try {
    // Process each test case with its own settings
    for (const testCase of TEST_CASES) {
      const page = await browser.newPage();
      
      try {
        // Load URL-specific settings if available
        const urlSettings = await storage.readCalibration(testCase.id);
        const testOptions = urlSettings ? { ...options, ...urlSettings } : options;
        
        const previousLayouts = previousResults.get(testCase.id);
        
        for (const [viewportKey, viewport] of Object.entries(VIEWPORTS)) {
          currentStep++;
          const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
          
          const previousLayout = previousLayouts?.get(viewportKey);
          
          if (previousLayout && !options.forceUpdate) {
            renderProgressBar(currentStep, totalSteps, `${label} (cached)`);
            captures.push({
              testCase,
              viewport,
              layout: previousLayout,
            });
          } else {
            renderProgressBar(currentStep, totalSteps, `${label} (capturing...)`);
            
            // Capture new layout with URL-specific options
            const layout = await captureLayout(page, testCase.url, viewport, testOptions);
            
            if (options.forceUpdate) {
              await storage.writeSnapshot(testCase.id, viewport, layout);
            }
            
            captures.push({
              testCase,
              viewport,
              layout,
            });
          }
        }
      } finally {
        await page.close();
      }
    }
    
    clearLine();
    console.log(`✅ Captured ${captures.length} layouts\n`);
  } finally {
    await browser.close();
  }

  return captures;
}

// Compare phase
async function runCompare(
  previousResults: Map<string, Map<string, VisualTreeAnalysis>>,
  captureOptions: any
): Promise<TestResult[]> {
  console.log(`📊 Compare Phase\n`);
  
  // Always capture fresh data for comparison
  const browser = await puppeteer.launch({ headless: true });
  const captures: CaptureResult[] = [];
  
  const totalSteps = TEST_CASES.length * Object.keys(VIEWPORTS).length;
  let currentStep = 0;

  try {
    // First, capture fresh layouts
    console.log(`Capturing current layouts...\n`);
    
    for (const testCase of TEST_CASES) {
      const page = await browser.newPage();
      
      try {
        const urlSettings = await storage.readCalibration(testCase.id);
        const testOptions = urlSettings ? { ...captureOptions, ...urlSettings, forceUpdate: true } : { ...captureOptions, forceUpdate: true };
        
        for (const [viewportKey, viewport] of Object.entries(VIEWPORTS)) {
          currentStep++;
          const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
          renderProgressBar(currentStep, totalSteps, label);
          
          const layout = await captureLayout(page, testCase.url, viewport, testOptions);
          captures.push({
            testCase,
            viewport,
            layout,
          });
        }
      } finally {
        await page.close();
      }
    }
    
    clearLine();
    console.log(`✅ Captured ${captures.length} current layouts\n`);
  } finally {
    await browser.close();
  }

  const currentLayouts = collectCaptures(captures, VIEWPORTS);
  const results: TestResult[] = [];

  // Load calibration settings for each test case
  const calibrationMap = new Map();
  for (const testCase of TEST_CASES) {
    const settings = await storage.readCalibration(testCase.id);
    if (settings) {
      calibrationMap.set(testCase.id, settings);
    }
  }

  // Process comparisons
  console.log(`Comparing layouts...\n`);
  currentStep = 0;

  // Process each test case with its own settings
  for (const testCase of TEST_CASES) {
    const testSettings = calibrationMap.get(testCase.id) || {
      ignoreText: true,
      threshold: 10,
      similarityThreshold: 95,
    };

    const testCurrentLayouts = new Map();
    testCurrentLayouts.set(testCase.id, currentLayouts.get(testCase.id));

    const testPreviousLayouts = new Map();
    testPreviousLayouts.set(testCase.id, previousResults.get(testCase.id));

    for await (const result of compareLayouts(
      [testCase],
      VIEWPORTS,
      testCurrentLayouts,
      testPreviousLayouts,
      testSettings
    )) {
      if ("comparison" in result) {
        currentStep++;
        const { testCase, viewport, comparison } = result;
        
        const label = `${testCase.id} ${viewport.width}x${viewport.height}`;
        renderProgressBar(currentStep, totalSteps, `${label} (${comparison.similarity.toFixed(0)}%)`);

        // Get the previous and current layouts for this test case and viewport
        const viewportKey = Object.keys(VIEWPORTS).find(
          (key) => VIEWPORTS[key] === viewport
        );
        const previousLayout = previousResults
          .get(testCase.id)
          ?.get(viewportKey!);
        const currentLayout = currentLayouts
          .get(testCase.id)
          ?.get(viewportKey!);

        if (previousLayout && currentLayout) {
          await storage.writeComparison(
            testCase.id,
            viewport,
            comparison.raw,
            previousLayout,
            currentLayout
          );
        }
      } else {
        results.push(result);
      }
    }
  }
  
  clearLine();
  console.log(`✅ Compared ${currentStep} layouts\n`);

  return results;
}

// Main
async function main() {
  const forceUpdate = process.argv.includes("--update");
  
  // Parse CLI options
  const waitUntilIndex = process.argv.findIndex(arg => arg.startsWith("--wait-until="));
  const waitUntil = waitUntilIndex !== -1 
    ? process.argv[waitUntilIndex].split("=")[1] as "load" | "domcontentloaded" | "networkidle0" | "networkidle2"
    : "networkidle0";
  
  const waitForLCP = !process.argv.includes("--no-wait-lcp"); // Default true
  
  // Parse additional wait time
  const additionalWaitIndex = process.argv.findIndex(arg => arg.startsWith("--additional-wait="));
  const additionalWait = additionalWaitIndex !== -1 
    ? parseInt(process.argv[additionalWaitIndex].split("=")[1])
    : undefined;

  console.log(`🚀 Visual Check Matrix Test`);
  console.log(
    `📋 ${TEST_CASES.length} URLs × ${
      Object.keys(VIEWPORTS).length
    } viewports\n`
  );
  
  if (waitUntil !== "networkidle0" || !waitForLCP || additionalWait) {
    console.log(`⚙️  Options: waitUntil=${waitUntil}${!waitForLCP ? ", waitForLCP=false" : ""}${additionalWait ? `, additionalWait=${additionalWait}ms` : ""}\n`);
  }

  // Check if initial run
  const previousResults = await storage.loadAll();
  const isInitialRun = previousResults.size === 0;

  // Always capture (with or without cache)
  const captureOptions = {
    forceUpdate: forceUpdate || isInitialRun,
    waitUntil,
    waitForLCP,
    additionalWait
  };
  
  await runCapture(captureOptions);

  if (isInitialRun) {
    console.log(`✅ Initial capture completed. Run again to detect changes.`);
    return;
  }

  // Create calibration settings when updating
  if (forceUpdate) {
    console.log(`\n📝 Creating calibration settings...\n`);

    for (const testCase of TEST_CASES) {
      // Default settings for each URL
      const settings: any = {
        ignoreText: true,
        threshold: 10,
        similarityThreshold: 95,
        waitUntil,
        waitForLCP,
        additionalWait,
      };

      // Special settings for problematic URLs
      if (testCase.id === "article") {
        settings.threshold = 20; // More tolerant for articles
        settings.similarityThreshold = 90;
        settings.waitForLCP = true; // Always wait for LCP on articles
        settings.additionalWait = 1000; // Extra 1s for thumbnails to load
      }

      await storage.writeCalibration(testCase.id, settings);
      console.log(
        `  ${testCase.id}: threshold=${settings.threshold}, similarity=${settings.similarityThreshold}%`
      );
    }

    console.log(`\n✅ Calibration settings created for all URLs`);
  }

  // Compare
  const results = await runCompare(previousResults, captureOptions);

  // Display results
  for (const result of results) {
    if (result.comparisons.length > 0) {
      console.log(`${result.testCase.id}:`);
      for (const comp of result.comparisons) {
        const status = comp.comparison.hasIssues ? "⚠️ " : "✅ ";
        console.log(
          `  ${status}${comp.viewport.width}x${
            comp.viewport.height
          }: ${comp.comparison.similarity.toFixed(1)}% similar`
        );
      }
    }
  }

  // Summary
  const summary = generateSummary(results);
  await storage.writeSummary(summary);

  console.log(
    `\n✨ Complete: ${summary.testsWithIssues}/${summary.totalTests} tests with issues`
  );
}

main().catch(console.error);
