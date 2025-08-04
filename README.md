# visc - Visual Regression Testing CLI

A visual regression testing CLI tool that captures and compares web page layouts.

## Installation

```bash
npm install -g @mizchi/visc
```

## Usage

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

### Command Details

#### `visc get <url>`
Fetches layout data from a URL and outputs as JSON.

Options:
- `-o, --output <path>` - Save to file instead of stdout
- `--viewport <size>` - Viewport size (e.g., `--viewport=1920x1080`) (default: `1280x800`, e.g., `--viewport=1920x1080`)
- `-f, --full` - Capture full page
- `--headless` - Run browser in headless mode

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

## API

This package also provides a programmatic API for use in Node.js applications.

```javascript
import {
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  renderLayoutToSvg,
  calibrateComparisonSettings
} from '@mizchi/visc';
```

See [examples/basic-usage.ts](examples/basic-usage.ts) for a complete example of the library API.

## License

MIT