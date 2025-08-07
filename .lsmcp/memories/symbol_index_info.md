---
created: 2025-08-07T15:25:42.035Z
updated: 2025-08-07T15:25:42.035Z
---

# Symbol Index Configuration for visual-checker

## Project Information
- **Name**: @mizchi/visc v0.2.7
- **Description**: Visual regression testing CLI tool
- **Type**: TypeScript React Application
- **Language**: TypeScript
- **Root**: /home/mizchi/mizchi/visual-checker

## Indexing Configuration
- **Pattern Used**: `**/*.ts`
- **Index Created**: 2025-08-07T15:24:35.942Z
- **Total Files Indexed**: 55
- **Total Symbols**: 613
- **Average Indexing Time**: 238ms per file
- **Total Indexing Time**: 13.115 seconds

## Project Structure
```
examples/       - Example usage files (2 files)
scripts/        - Build and utility scripts (1 file)
src/            - Main source code (30 files)
  analysis/     - Element difference analysis
  browser/      - Puppeteer browser control
  cli/          - Command-line interface (9 files)
    commands/   - CLI commands (check, init)
    ui/         - Progress display components
  config/       - Configuration merging
  drivers/      - Screenshot drivers
  layout/       - Layout comparison and analysis (9 files)
  renderer/     - Visual comparison rendering (3 files)
  schema/       - Configuration schema
tests/          - Test files (14 files)
  calibration/  - Calibration tests
  fixtures/     - Test fixtures
  layout/       - Layout module tests
```

## Key Components

### Classes (23 total)
- **CacheStorage**: Manages snapshot caching and diff storage
- **EnhancedProgressDisplay**: Terminal progress display with tasks
- **ProgressManager**: Manages progress for test execution
- **ViscConfig**: Main configuration class
- **TestCaseConfig**: Test case configuration
- **ViewportConfig**: Viewport configuration

### Interfaces (46 total)
- Layout and visual comparison interfaces
- Configuration interfaces
- Element difference analysis interfaces
- Accessibility matching interfaces

### Functions (258 total)
- **Exported Functions**: 211 functions for various operations
- **Main Entry Points**: CLI commands, workflow functions
- **Layout Analysis**: Comparison, calibration, flakiness detection
- **Rendering**: SVG generation for visual diffs

## Dependencies
- **Core**: puppeteer, commander, chalk, zod
- **UI**: react, ink, ora
- **Development**: TypeScript, testing frameworks

## Search Tips
- Use `search_symbol_from_index` with kind filters for specific types
- Common kinds: Class, Interface, Function, Variable
- Key namespaces: layout, cli, renderer, analysis

## Notes
- LSP server is active and supports TypeScript
- Symbol search is case-sensitive by default
- Use name patterns for flexible searching (e.g., "*Config" for all config classes)