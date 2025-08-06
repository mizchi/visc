# visc - Visual Regression Testing Library & CLI

A visual regression testing library and CLI tool that captures and compares web page layouts using semantic visual groups for more stable and meaningful comparisons.

## Key Features

- **Semantic Visual Groups**: Compares layouts based on meaningful visual groups rather than individual DOM elements
- **Auto-Calibration**: Automatically determines optimal comparison thresholds on first run
- **Smart Waiting**: Waits for Largest Contentful Paint (LCP) for more stable captures
- **Network Control**: Block or override network requests during capture
- **Interactive TUI**: Real-time progress visualization with state tracking
- **Parallel Execution**: Run multiple tests concurrently for faster results
- **Flexible Output**: Generate SVG visualizations and JSON reports

## Installation

```bash
# As a library
npm install @mizchi/visc

# As a global CLI tool
npm install -g @mizchi/visc
```

## Quick Start

```bash
# 1. Install visc globally
npm install -g @mizchi/visc

# 2. Create configuration file
cat > visc.config.json << 'EOF'
{
  "version": "1.0",
  "viewports": {
    "mobile": {
      "name": "Mobile",
      "width": 375,
      "height": 667,
      "deviceScaleFactor": 2
    },
    "desktop": {
      "name": "Desktop",
      "width": 1280,
      "height": 800,
      "deviceScaleFactor": 1
    }
  },
  "testCases": [
    {
      "id": "home",
      "url": "https://example.com",
      "description": "Homepage"
    }
  ]
}
EOF

# 3. Run initial capture (creates baseline with auto-calibration)
visc check

# 4. Run again to detect changes
visc check

# Optional: Use interactive TUI for better progress visualization
visc check --tui
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
  captureLayout,
  compareVisualNodeGroups
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
  additionalWait: 1000,  // Additional wait after LCP in ms
  overrides: {  // Network request overrides
    '**/analytics.js': './tests/fixtures/test-overrides/empty.js',
    'https://cdn.example.com/lib.js': 'https://localhost:8080/lib.js'
  },
  onStateChange: (state) => {  // Optional: Track capture progress
    console.log(`State: ${state}`); // 'requesting' | 'waiting-lcp' | 'extracting' | 'completed'
  }
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
- `additionalWait`: Additional wait time after LCP in ms (default: 500)
- `overrides`: Network request overrides (key: URL pattern, value: replacement file/URL)
- `networkBlocks`: Array of URL patterns to block entirely
- `onStateChange`: Callback for tracking capture progress states

#### `compareVisualNodeGroups(baseline: VisualTreeAnalysis, current: VisualTreeAnalysis): ComparisonResult`
Compares two layouts using semantic visual groups for more stable comparisons.

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

# Run visual regression tests with configuration file
visc check                           # Uses visc.config.json by default
visc check -c custom.config.json     # Use custom config file
visc check -o results/               # Override output directory
visc check -p 4                      # Run with 4 concurrent pages
visc check --interval 1000           # Set 1s interval between requests
visc check -p 1 --interval 0         # Sequential with no delay
visc check --update                  # Update baseline snapshots
visc check --clear-cache            # Clear cache before running

# Compare two sources (files or URLs, output to stdout by default)
visc compare https://example.com https://example.com/v2
visc compare baseline.json current.json -o comparison.json

# Quick process (calibrate and generate files)
visc https://example.com --outdir out
```

### Advanced Usage - Responsive Matrix Testing

The package provides two ways to run responsive matrix tests:

#### 1. Using Configuration File (Recommended)

Create a `visc.config.json` file based on the example:

```bash
# Copy the example configuration
cp visc.config.example.json visc.config.json

# Edit the configuration to match your needs
# - Update URLs in testCases
# - Adjust viewports as needed
# - Customize capture and compare options
```

Then run tests:

```bash
# Initial run (creates baseline snapshots)
visc check

# Run tests and detect changes
visc check

# Update baseline snapshots after intentional changes
visc check --update

# Clear cache and start fresh
visc check --clear-cache --update
```

#### 2. Using the Example Script

The package includes a powerful example for testing responsive designs across multiple viewports. See [examples/responsive-matrix.ts](examples/responsive-matrix.ts) for a complete implementation.

```bash
# Run responsive matrix test
npx tsx examples/responsive-matrix.ts

# With options
npx tsx examples/responsive-matrix.ts --wait-until networkidle0 --no-wait-lcp --additional-wait 2000
```

Both methods will:
- Test multiple URLs across different viewport sizes (Mobile, Tablet, Desktop)
- Generate visual comparisons for each viewport
- Show progress bars during capture and comparison phases
- Output diff SVGs and JSON files

### Configuration-based Testing with `visc check`

The `visc check` command enables comprehensive visual regression testing across multiple URLs and viewports using a configuration file. This is the recommended approach for CI/CD integration and regular testing.

#### Configuration File Format

Create a `visc.config.json` file:

```json
{
  "version": "1.0",
  "cacheDir": ".visc/cache",
  "outputDir": ".visc/output",
  "viewports": {
    "mobile": {
      "name": "Mobile",
      "width": 375,
      "height": 667,
      "deviceScaleFactor": 2,
      "userAgent": "Mozilla/5.0 (iPhone)..."
    },
    "tablet": {
      "name": "Tablet",
      "width": 768,
      "height": 1024,
      "deviceScaleFactor": 2
    },
    "desktop": {
      "name": "Desktop",
      "width": 1280,
      "height": 800,
      "deviceScaleFactor": 1
    }
  },
  "testCases": [
    {
      "id": "home",
      "url": "https://example.com",
      "description": "Homepage"
    },
    {
      "id": "about",
      "url": "https://example.com/about",
      "description": "About page",
      "captureOptions": {
        "additionalWait": 2000
      }
    },
    {
      "id": "products",
      "url": "https://example.com/products",
      "description": "Products listing",
      "compareOptions": {
        "threshold": 10,
        "similarityThreshold": 90
      }
    }
  ],
  "captureOptions": {
    "waitUntil": "networkidle0",
    "waitForLCP": true,
    "additionalWait": 500,
    "networkBlocks": ["**/gtag/**", "**/analytics/**"]
  },
  "compareOptions": {
    "ignoreText": true,
    "threshold": 5,
    "similarityThreshold": 98,
    "useVisualGroups": true,
    "overrides": {
      "**/styles.css": "./tests/fixtures/test-overrides/modified.css"
    }
  },
  "calibrationOptions": {
    "enabled": true,
    "samples": 3,
    "strictness": "medium"
  }
}
```

#### Check Command Usage

```bash
# Initial run (creates baseline snapshots)
visc check

# Update baseline snapshots
visc check --update

# Use interactive TUI mode for better progress visualization
visc check --tui

# Use custom config file
visc check -c my-tests.config.json

# Override output directory
visc check -o test-results/

# Run tests in parallel with 4 concurrent pages
visc check -p 4 --tui

# Run sequentially with 500ms interval
visc check --interval 500

# Run parallel with no interval (fast for local sites)
visc check -p 8 --interval 0

# Clear cache before running
visc check --clear-cache

# CI/CD usage (exits with code 1 if changes detected)
visc check || echo "Visual regressions detected!"
```

#### Output Structure

The check command creates the following structure:

```
.visc/
├── cache/                         # Cached baseline snapshots
│   ├── home/
│   │   ├── baseline-375x667.json
│   │   ├── baseline-768x1024.json
│   │   └── baseline-1280x800.json
│   └── about/
│       └── ...
├── calibration.json               # Auto-calibration data
└── output/                        # Test results
    ├── home/
    │   ├── 375x667.svg           # Current layout visualization
    │   ├── diff-375x667.svg      # Visual diff
    │   └── diff-375x667.json     # Diff data
    ├── about/
    │   └── ...
    └── summary.json              # Overall test summary
```

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

#### `visc check`
Runs visual regression tests based on configuration file.

Options:
- `-c, --config <path>` - Configuration file path (default: visc.config.json)
- `-o, --outdir <path>` - Output directory (overrides config)
- `-p, --parallel [concurrency]` - Run tests in parallel (default: 1)
- `--interval <ms>` - Interval between requests in milliseconds (default: 300)
- `-u, --update` - Update baseline snapshots
- `--clear-cache` - Clear cache before running tests
- `--tui` - Use interactive TUI for real-time progress display with state tracking

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
- **TUI Mode**: Interactive terminal UI showing capture states (requesting → waiting-lcp → extracting → completed)
- **Smart Page Loading**: 
  - Waits for Largest Contentful Paint (LCP) by default with 15s timeout
  - Configurable additional wait time for dynamic content
  - URL-specific calibration (e.g., longer waits for article pages)
- **Batch Processing**: Test multiple URLs in a single run
- **Semantic Visual Groups**: Compares meaningful visual groups instead of individual DOM elements

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


### Network Request Overrides and Blocking

The visual checker supports advanced network control features to improve test stability and enable CSS regression testing.

#### Network Blocking

The `networkBlocks` option allows you to block specific network requests entirely. This is particularly useful for:
- Blocking analytics scripts (GTM, Google Analytics) to speed up page loads
- Removing third-party widgets that cause test flakiness
- Eliminating ads and tracking pixels

#### Request Overrides

The `overrides` option allows you to intercept and replace network requests during page capture. This is useful for:
- Testing with modified CSS/JS files to detect visual regressions
- Redirecting CDN resources to local versions
- Mocking external dependencies

#### Phase-Specific Configuration

You can configure different network settings for capture and comparison phases:

```json
{
  "captureOptions": {
    "networkBlocks": [
      "**/gtm.js",
      "**/gtag/**",
      "**/google-analytics.com/**",
      "**/googletagmanager.com/**",
      "**/facebook.com/tr/**"
    ]
  },
  "compareOptions": {
    "networkBlocks": [
      "**/gtm.js",
      "**/gtag/**"
    ],
    "overrides": {
      "**/main.css": "./tests/fixtures/test-overrides/modified.css",
      "**/theme.css": "./tests/fixtures/test-overrides/broken-theme.css"
    }
  }
}
```

This configuration:
1. During **capture phase**: Blocks all analytics and tracking to speed up baseline capture
2. During **comparison phase**: Blocks analytics AND replaces CSS files to test for visual regressions

#### Pattern Matching

- Patterns support glob-style wildcards:
  - `*` matches any characters except `/`
  - `**` matches any characters including `/`
  - `?` matches a single character
- Patterns are tested against the full request URL
- First matching pattern wins

#### Replacement Types

1. **Local file replacement**: Use relative paths starting with `./` or absolute paths
   ```json
   { "**/main.css": "./tests/fixtures/test-overrides/custom.css" }
   ```
   
2. **URL redirection**: Use another URL to redirect the request
   ```json
   { "https://cdn.example.com/lib.js": "https://localhost:8080/lib.js" }
   ```

#### Example Override Files

Create an empty JS file to neutralize tracking scripts:
```javascript
// tests/fixtures/test-overrides/empty.js
// Empty file to replace analytics/tracking scripts
```

Create a custom CSS file for testing:
```css
/* tests/fixtures/test-overrides/custom.css */
body {
  background-color: #f0f0f0 !important;
}
```

### CI/CD Integration

The `visc check` command is designed for easy CI/CD integration:

```yaml
# GitHub Actions example
name: Visual Regression Tests
on: [push, pull_request]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm install -g @mizchi/visc
      
      - name: Run visual regression tests
        run: visc check
        
      - name: Upload diff artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-diffs
          path: .visc/output/
```

```yaml
# GitLab CI example
visual-tests:
  stage: test
  script:
    - npm install -g @mizchi/visc
    - visc check
  artifacts:
    when: on_failure
    paths:
      - .visc/output/
    expire_in: 1 week
```

### Best Practices

1. **Baseline Management**
   - Commit `visc.config.json` to version control
   - Do NOT commit `.visc/` directory (already in .gitignore)
   - Update baselines intentionally with `visc check --update`
   - Review diff SVGs before updating baselines

2. **Configuration Tips**
   - Start with conservative thresholds (threshold: 5, similarityThreshold: 98)
   - Enable `useVisualGroups: true` for more stable comparisons
   - Use test-specific overrides for problematic pages
   - Increase `additionalWait` for pages with animations
   - Use `ignoreElements` for dynamic content (ads, timestamps)

3. **Performance Optimization**
   - Use specific viewports rather than testing all sizes
   - Run tests in parallel with `-p` flag for faster execution
   - For external sites: Use sequential mode with interval (`--interval 500`)
   - For local/internal sites: Use parallel mode with no interval (`-p 8 --interval 0`)
   - Default settings (sequential with 300ms interval) are safe for most sites
   - Cache Puppeteer browser downloads

4. **Auto-Calibration**
   - Calibration runs automatically on first run (unless disabled)
   - Calibration analyzes multiple samples to determine optimal thresholds
   - Higher confidence scores indicate more stable layouts
   - Re-run calibration after major layout changes

## Testing

This project includes comprehensive test suites:

### Unit Tests
```bash
npm test
```

### Test Fixtures
Test fixtures are organized under `tests/fixtures/`:
- `test-overrides/` - CSS/JS files for testing network request overrides
- `test-configs/` - Example configuration files for integration tests
- `calibration-samples/` - Sample data for calibration testing

### Network Controls Testing
The project includes tests for network blocking and request overrides:
```bash
npm test tests/network-controls.test.ts
npm test tests/integration/check-command.test.ts
```

## License

MIT