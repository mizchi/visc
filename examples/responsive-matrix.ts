/**
 * Responsive matrix testing example
 * Tests layout consistency across different viewport sizes
 */

import {
  type VisualTreeAnalysis,
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  renderLayoutToSvg,
  renderComparisonToSvg,
} from "../src/index.js";
import puppeteer, { type Page } from "puppeteer";
import * as fs from "fs/promises";
import * as path from "path";
// Define viewport configurations
const VIEWPORTS = {
  mobile: {
    name: "Mobile",
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
  },
  tablet: {
    name: "Tablet",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    userAgent:
      "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
  },
  desktop: {
    name: "Desktop",
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  },
};

async function captureLayout(
  page: Page,
  url: string,
  viewport: (typeof VIEWPORTS)[keyof typeof VIEWPORTS]
): Promise<VisualTreeAnalysis> {
  // Set viewport and user agent
  await page.setViewport({
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
  });
  await page.setUserAgent(viewport.userAgent);

  await page.goto(url, { waitUntil: "networkidle0" });

  // Wait a bit for any responsive adjustments
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const rawData = await fetchRawLayoutData(page);
  const layout = await extractLayoutTree(rawData, {
    viewportOnly: true,
    groupingThreshold: 20,
    importanceThreshold: 10,
  });

  return layout;
}

// Helper function to get snapshot filename
function getSnapshotFilename(
  viewport: (typeof VIEWPORTS)[keyof typeof VIEWPORTS]
): string {
  return `${viewport.width}x${viewport.height}`;
}

// Phase 1: Fetch layouts
type FetchPhaseResult = {
  current: Record<string, VisualTreeAnalysis>;
  previous: Record<string, VisualTreeAnalysis>;
};

async function fetchPhase(
  url: string,
  outputDir: string,
  _forceUpdate: boolean = false
): Promise<FetchPhaseResult> {
  const results: Record<string, VisualTreeAnalysis> = {};
  const previousResults: Record<string, VisualTreeAnalysis> = {};

  console.log(`📥 Fetch Phase: ${url}\n`);

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Load previous snapshots for comparison
  for (const [key, viewport] of Object.entries(VIEWPORTS)) {
    const filename = getSnapshotFilename(viewport);
    const jsonPath = path.join(outputDir, `${filename}.json`);

    if (
      await fs
        .access(jsonPath)
        .then(() => true)
        .catch(() => false)
    ) {
      const data = await fs.readFile(jsonPath, "utf-8");
      previousResults[key] = JSON.parse(data);
    }
  }

  // Launch browser once
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    for (const [key, viewport] of Object.entries(VIEWPORTS)) {
      const filename = getSnapshotFilename(viewport);
      const jsonPath = path.join(outputDir, `${filename}.json`);

      console.log(
        `📱 ${viewport.name}: Capturing layout (${viewport.width}x${viewport.height})...`
      );

      try {
        results[key] = await captureLayout(page, url, viewport);

        // Save snapshot
        await fs.writeFile(jsonPath, JSON.stringify(results[key], null, 2));

        // Generate and save SVG
        const svg = renderLayoutToSvg(results[key], { showLabels: true });
        await fs.writeFile(path.join(outputDir, `${filename}.svg`), svg);

        console.log(
          `✅ ${viewport.name}: ${results[key].elements.length} elements found`
        );
      } catch (error) {
        console.error(`❌ Failed to capture ${viewport.name}:`, error);
      }
    }
  } finally {
    await browser.close();
  }

  return { current: results, previous: previousResults };
}

// Phase 2: Verify and compare layouts
async function verifyPhase(
  current: Record<string, VisualTreeAnalysis>,
  previous: Record<string, VisualTreeAnalysis>,
  outputDir: string
): Promise<void> {
  if (Object.keys(previous).length === 0) {
    console.log(`
✅ Initial capture completed. Run again to detect CSS changes.`);
    return;
  }

  console.log(`
📊 Verify Phase: Comparing with previous captures...
`);

  const comparisonResults: Array<{
    viewport: string;
    similarity: number;
    differences: number;
    addedElements: number;
    removedElements: number;
    hasIssues: boolean;
  }> = [];

  for (const [key, currentLayout] of Object.entries(current)) {
    const viewport = VIEWPORTS[key as keyof typeof VIEWPORTS];
    const previousLayout = previous[key];

    if (!previousLayout) {
      console.log(`⚠️  ${viewport.name}: No previous snapshot to compare`);
      continue;
    }

    console.log(`🔍 ${viewport.name} (${viewport.width}x${viewport.height}):`);

    const comparison = compareLayoutTrees(previousLayout, currentLayout, {
      threshold: 5, // Allow 5px difference
      ignoreText: false,
      ignoreElements: [],
    });

    // Save comparison result
    const filename = getSnapshotFilename(viewport);
    await fs.writeFile(
      path.join(outputDir, `diff-${filename}.json`),
      JSON.stringify(comparison, null, 2)
    );

    // Generate diff SVG
    const diffSvg = renderComparisonToSvg(
      comparison,
      previousLayout,
      currentLayout,
      {
        showUnchanged: true,
        highlightLevel: "moderate",
      }
    );
    await fs.writeFile(
      path.join(outputDir, `diff-${filename}.svg`),
      diffSvg
    );

    console.log(`   Similarity: ${comparison.similarity.toFixed(1)}%`);
    console.log(`   Changes: ${comparison.differences.length}`);
    console.log(`   Added: ${comparison.addedElements.length}`);
    console.log(`   Removed: ${comparison.removedElements.length}`);

    const hasIssues = comparison.similarity < 95;
    if (hasIssues) {
      console.log(`   ⚠️  CSS changes detected!`);
    } else {
      console.log(`   ✅ No significant changes`);
    }

    comparisonResults.push({
      viewport: viewport.name,
      similarity: comparison.similarity,
      differences: comparison.differences.length,
      addedElements: comparison.addedElements.length,
      removedElements: comparison.removedElements.length,
      hasIssues,
    });
  }

  // Generate summary report
  const report = {
    timestamp: new Date().toISOString(),
    viewports: Object.entries(current).map(([key, layout]) => ({
      type: key,
      ...VIEWPORTS[key as keyof typeof VIEWPORTS],
      elementCount: layout.elements.length,
      visualGroups: layout.visualNodeGroups?.length || 0,
    })),
    comparisons: comparisonResults,
    hasAnyIssues: comparisonResults.some(c => c.hasIssues),
  };

  await fs.writeFile(
    path.join(outputDir, "css-check-report.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(`
✨ Results saved to: ${outputDir}/`);
  
  if (report.hasAnyIssues) {
    console.log(`
⚠️  CSS changes detected in ${comparisonResults.filter(c => c.hasIssues).length} viewport(s)`);
  } else {
    console.log(`
✅ No CSS changes detected`);
  }
}

async function runResponsiveMatrixTest(forceUpdate: boolean = false) {
  const url = "https://zenn.dev";
  const outputDir = "./examples/matrix-output";

  // Phase 1: Fetch layouts
  const { current, previous } = await fetchPhase(url, outputDir, forceUpdate);

  // Phase 2: Verify and compare
  await verifyPhase(current, previous, outputDir);
}

// CLI argument parsing
const args = process.argv.slice(2);
const forceUpdate = args.includes("--update");

// Run the test
runResponsiveMatrixTest(forceUpdate).catch(console.error);
