# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2025-08-05

### Added
- Network request controls for capture and comparison phases
- `networkBlocks` option to block requests by URL patterns (e.g., analytics, GTM)
- Phase-specific configuration for capture and comparison phases
- Support for different overrides/networkBlocks settings for each phase
- CSS regression testing capability by applying different CSS in comparison phase
- Comprehensive tests for network controls

### Changed
- Reorganized test fixtures to `tests/fixtures` directory
- Moved CLI implementation to `src/cli/` directory (BREAKING CHANGE for direct imports)

### Fixed
- Improved request interception handling to prevent "Request is already handled" errors

## [0.1.0] - 2025-01-24

### Added
- Initial release of @mizchi/visual-checker
- Multiple URL testing support
- Configurable wait strategies (selector, network idle, timeout)
- Pre-screenshot actions (JavaScript execution, element clicks, hiding elements)
- Image comparison using pixelmatch
- Diff image generation
- CLI interface with init, test, update, and compare commands
- Support for multiple browsers (Chromium, Firefox, WebKit)
- Device emulation support
- Configurable viewport sizes
- Example configurations for basic, mobile, and advanced use cases