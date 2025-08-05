# visc - Visual Regression Testing Library & CLI

A visual regression testing library and CLI tool that captures and compares web page layouts.

## Installation

```bash
# As a library
npm install @mizchi/visc

# As a global CLI tool
npm install -g @mizchi/visc
```

## Library API

This package provides a programmatic API for use in Node.js applications.

### Core Functions

```typescript
import {
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  renderLayoutToSvg,
  renderComparisonToSvg,
  calibrateComparisonSettings,
  captureLayout
} from '@mizchi/visc';
```

### Basic Usage Example

```typescript
import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import {
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  renderLayoutToSvg,
  renderComparisonToSvg
} from '@mizchi/visc';

// Launch browser and capture layout
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto('https://example.com');

// Fetch and extract layout
const rawData = await fetchRawLayoutData(page);
const layout = await extractLayoutTree(rawData, {
  viewportOnly: true,
  groupingThreshold: 20,
  importanceThreshold: 10
});

// Render layout as SVG
const svg = renderLayoutToSvg(layout, {
  showLabels: true,
  highlightLevel: 'moderate'
});

// Compare two layouts
const comparison = compareLayoutTrees(baselineLayout, currentLayout, {
  threshold: 5,
  ignoreText: true
});

// Render comparison as diff SVG
const diffSvg = renderComparisonToSvg(comparison, baselineLayout, currentLayout, {
  showLabels: true,
  highlightLevel: 'moderate'
});

// Save diff SVG to file
await fs.writeFile('diff.svg', diffSvg);

await browser.close();
```

### Advanced Capture with Options

```typescript
import { captureLayout } from '@mizchi/visc';

const layout = await captureLayout(page, url, viewport, {
  waitUntil: 'networkidle0',
  waitForLCP: true,  // Default: true, waits for Largest Contentful Paint
  additionalWait: 1000  // Additional wait after LCP in ms
});
```

### API Reference

#### `fetchRawLayoutData(page: Page): Promise<RawLayoutData>`
Fetches raw layout data from a Puppeteer page.

#### `extractLayoutTree(rawData: RawLayoutData, options?: ExtractOptions): Promise<VisualTreeAnalysis>`
Extracts and analyzes the visual tree from raw layout data.

Options:
- `viewportOnly`: Only include elements within viewport (default: true)
- `groupingThreshold`: Threshold for grouping elements (default: 20)
- `importanceThreshold`: Minimum importance score (default: 10)

#### `compareLayoutTrees(baseline: VisualTreeAnalysis, current: VisualTreeAnalysis, options?: CompareOptions): ComparisonResult`
Compares two layout trees and returns differences.

Options:
- `threshold`: Position/size difference threshold in pixels (default: 5)
- `ignoreText`: Ignore text content changes (default: true)
- `ignoreElements`: Array of selectors to ignore

#### `renderLayoutToSvg(layout: VisualTreeAnalysis, options?: RenderOptions): string`
Renders a layout tree as SVG.

#### `renderComparisonToSvg(comparison: ComparisonResult, baseline: VisualTreeAnalysis, current: VisualTreeAnalysis, options?: RenderOptions): string`
Renders a comparison result as SVG with visual diff.

#### `captureLayout(page: Page, url: string, viewport: Viewport, options?: CaptureOptions): Promise<VisualTreeAnalysis>`
High-level function that navigates to URL and captures layout with smart waiting.

Options:
- `waitUntil`: Puppeteer navigation wait option (default: 'networkidle0')
- `waitForLCP`: Wait for Largest Contentful Paint (default: true)
- `additionalWait`: Additional wait time after LCP in ms (default: 1000)

See [examples/basic-usage.ts](examples/basic-usage.ts) and [examples/responsive-matrix.ts](examples/responsive-matrix.ts) for complete examples.

## CLI Usage

### Basic Commands

```bash
# Get layout data from URL (output to stdout by default)
visc get https://example.com
visc get https://example.com -o raw.json

# Render layout as SVG (output to stdout by default)
visc render https://example.com
visc render raw.json -o layout.svg

# Render diff as SVG (compare two sources)
visc render https://example.com https://example.com/v2 --diff
visc render baseline.json current.json --diff -o diff.svg

# Generate comparison settings (output to stdout by default)
visc calibrate https://example.com
visc calibrate https://example.com -o check.json

# Check URL against settings
visc check check.json

# Compare two sources (files or URLs, output to stdout by default)
visc compare https://example.com https://example.com/v2
visc compare baseline.json current.json -o comparison.json

# Quick process (calibrate and generate files)
visc https://example.com --outdir out
```

### Advanced Usage - Responsive Matrix Testing

The package includes a powerful example for testing responsive designs across multiple viewports. See [examples/responsive-matrix.ts](examples/responsive-matrix.ts) for a complete implementation.

```bash
# Run responsive matrix test
npx tsx examples/responsive-matrix.ts

# With options
npx tsx examples/responsive-matrix.ts --wait-until networkidle0 --no-wait-lcp --additional-wait 2000
```

This will:
- Test multiple URLs across different viewport sizes (Mobile, Tablet, Desktop)
- Generate visual comparisons for each viewport
- Show progress bars during capture and comparison phases
- Output diff SVGs and JSON files in `matrix-output/` directory

### Command Details

#### `visc get <url>`
Fetches layout data from a URL and outputs as JSON.

Options:
- `-o, --output <path>` - Save to file instead of stdout
- `--viewport <size>` - Viewport size (e.g., `--viewport=1920x1080`) (default: `1280x800`)
- `-f, --full` - Capture full page
- `--headless` - Run browser in headless mode
- `--wait-until <event>` - Wait strategy: load, domcontentloaded, networkidle0, networkidle2 (default: networkidle0)
- `--no-wait-lcp` - Disable waiting for Largest Contentful Paint (LCP is enabled by default with 15s timeout)
- `--additional-wait <ms>` - Additional wait time after LCP in milliseconds (default: 1000)

#### `visc render <source> [compareWith]`
Renders layout as SVG. Can render a single layout or a diff between two sources.

Arguments:
- `source` - URL or JSON file to render
- `compareWith` - Second source for diff rendering (with `--diff`)

Options:
- `-o, --output <path>` - Save to file instead of stdout
- `--diff` - Render as diff (requires two sources)
- `--viewport <size>` - Viewport size (e.g., `--viewport=1920x1080`) for URLs
- `--show-labels` - Show element labels
- `--highlight-level <level>` - Highlight level: subtle, moderate, strong

#### `visc calibrate <url>`
Generates comparison settings by analyzing multiple samples from a URL.

Options:
- `-o, --output <path>` - Save to file instead of stdout
- `-n, --samples <number>` - Number of samples (default: 5)
- `-d, --delay <ms>` - Delay between samples (default: 1000)
- `--viewport <size>` - Viewport size (e.g., `--viewport=1920x1080`)
- `--strictness <level>` - Strictness: low, medium, high

#### `visc check <settings>`
Checks a URL against calibrated settings.

Arguments:
- `settings` - Settings file (check.json)

Options:
- `--url <url>` - URL to check (overrides settings)

#### `visc compare <source1> <source2>`
Compares two sources (files or URLs).

Options:
- `-o, --output <path>` - Save to file instead of stdout
- `--threshold <percent>` - Similarity threshold (default: 90)
- `--viewport <size>` - Viewport size (e.g., `--viewport=1920x1080`) for URLs

#### `visc <url>`
Quick command that processes a URL, generating layout data, SVG, and comparison settings.

Options:
- `--outdir <dir>` - Output directory (default: `out`)

## Examples

### Command line usage with viewport options

```bash
# Capture mobile viewport
visc get https://example.com --viewport=375x667 -o mobile.json

# Compare desktop and tablet layouts
visc compare https://example.com https://example.com --viewport=1920x1080 --threshold=95
```

### Basic workflow with stdout

```bash
# Get layout data and save to file
visc get https://example.com > baseline.json

# View layout as SVG in terminal (if supported)
visc render baseline.json

# Compare two URLs and see results
visc compare https://example.com https://example.com/v2
```

### File-based workflow

```bash
# 1. Get baseline layout
visc get https://example.com -o baseline.json

# 2. Generate SVG visualization
visc render baseline.json -o baseline.svg

# 3. Calibrate comparison settings
visc calibrate https://example.com -o settings.json

# 4. Check for changes
visc check settings.json

# 5. Get current layout and compare
visc get https://example.com -o current.json
visc compare baseline.json current.json -o result.json

# 6. Visualize differences
visc render baseline.json current.json --diff -o diff.svg
```

### URL comparison

```bash
# Compare two URLs directly
visc compare https://example.com https://staging.example.com

# Render diff between two URLs
visc render https://example.com https://staging.example.com --diff -o diff.svg
```

### Quick workflow

```bash
# Process URL and generate all files
visc https://example.com --outdir out
# Creates:
#   - out/raw.json (layout data)
#   - out/layout.svg (visualization)
#   - out/check.json (comparison settings)
```

## Pipe usage

Since commands output to stdout by default, you can pipe results:

```bash
# Pipe layout data to jq for processing
visc get https://example.com | jq '.elements | length'

# Save calibration with custom processing
visc calibrate https://example.com | jq '.settings' > my-settings.json
```

## Responsive Matrix Testing

The package includes a comprehensive example for testing responsive designs across multiple viewports with visual regression testing capabilities.

### Features

- **Multiple Viewport Testing**: Test your pages across Mobile (375x667), Tablet (768x1024), and Desktop (1280x800) viewports
- **Visual Diff Generation**: Automatically generates visual diffs showing added (red), removed (red dashed), and changed elements
- **Progress Tracking**: Real-time progress bars for both capture and comparison phases
- **Smart Page Loading**: 
  - Waits for Largest Contentful Paint (LCP) by default with 15s timeout
  - Configurable additional wait time for dynamic content
  - URL-specific calibration (e.g., longer waits for article pages)
- **Batch Processing**: Test multiple URLs in a single run

### Example Configuration

```typescript
const testCases = [
  { id: "top", url: "https://zenn.dev", description: "Top page" },
  { id: "topics", url: "https://zenn.dev/topics", description: "Topics page" },
  { id: "article", url: "https://zenn.dev/kou_pg_0131/articles/vue-markdown-editor", 
    description: "Article page" }
];

const viewports = {
  mobile: {
    name: "Mobile",
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)..."
  },
  tablet: {
    name: "Tablet",
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)..."
  },
  desktop: {
    name: "Desktop",
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
  }
};
```

### Running the Tests

```bash
# Basic run
npx tsx examples/responsive-matrix.ts

# With custom wait options
npx tsx examples/responsive-matrix.ts --wait-until networkidle2 --additional-wait 2000

# Disable LCP waiting (not recommended)
npx tsx examples/responsive-matrix.ts --no-wait-lcp
```

### Output Structure

```
matrix-output/
├── [test-id]/
│   ├── baseline-[viewport].json    # Baseline layout data
│   ├── current-[viewport].json     # Current layout data
│   ├── diff-[viewport].svg         # Visual diff SVG
│   └── diff-[viewport].json        # Diff analysis data
└── summary.json                    # Overall test summary
```


## License

MIT