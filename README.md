# visc - Visual Regression Testing CLI

A visual regression testing CLI tool that captures and compares web page layouts.

## Installation

```bash
npm install -g @mizchi/visc
```

## Usage

### Basic Commands

```bash
# Get layout data from URL
visc get https://example.com -o raw.json

# Render layout as SVG
visc render https://example.com -o layout.svg
visc render raw.json -o layout.svg

# Render diff as SVG
visc render diff diff.json -o diff.svg

# Generate comparison settings
visc calibrate https://example.com -o check.json

# Check URL against settings
visc check check.json

# Compare two layout files
visc compare raw-a.json raw-b.json

# Quick process (calibrate and generate files)
visc https://example.com --outdir out
```

### Command Details

#### `visc get <url>`
Fetches layout data from a URL and saves it as JSON.

Options:
- `-o, --output <path>` - Output path (default: `raw.json`)
- `--viewport <size>` - Viewport size (default: `1280x800`)
- `-f, --full` - Capture full page
- `--headless` - Run browser in headless mode

#### `visc render <source> [type] [compareWith]`
Renders layout or diff as SVG.

Arguments:
- `source` - URL or JSON file to render
- `type` - `layout` (default) or `diff`
- `compareWith` - Second file for diff rendering

Options:
- `-o, --output <path>` - Output path (default: `layout.svg`)
- `--viewport <size>` - Viewport size for URL
- `--show-labels` - Show element labels
- `--highlight-level <level>` - Highlight level: subtle, moderate, strong

#### `visc calibrate <url>`
Generates comparison settings by analyzing multiple samples from a URL.

Options:
- `-o, --output <path>` - Output path (default: `check.json`)
- `-n, --samples <number>` - Number of samples (default: 5)
- `-d, --delay <ms>` - Delay between samples (default: 1000)
- `--viewport <size>` - Viewport size
- `--strictness <level>` - Strictness: low, medium, high

#### `visc check <settings>`
Checks a URL against calibrated settings.

Arguments:
- `settings` - Settings file (check.json)

Options:
- `--url <url>` - URL to check (overrides settings)

#### `visc compare <file1> <file2>`
Compares two layout files.

Options:
- `-o, --output <path>` - Output comparison result
- `--threshold <percent>` - Similarity threshold (default: 90)

#### `visc <url>`
Quick command that processes a URL, generating layout data, SVG, and comparison settings.

Options:
- `--outdir <dir>` - Output directory (default: `out`)

## Examples

### Basic workflow

```bash
# 1. Get layout data
visc get https://example.com -o baseline.json

# 2. Generate SVG visualization
visc render baseline.json -o baseline.svg

# 3. Calibrate comparison settings
visc calibrate https://example.com -o settings.json

# 4. Check for changes
visc check settings.json

# 5. Compare layouts
visc get https://example.com -o current.json
visc compare baseline.json current.json
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

## License

MIT