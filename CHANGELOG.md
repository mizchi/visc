# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Responsive matrix testing feature for validating CSS consistency across multiple viewports
- Media query tracking and consistency validation
- CSS fingerprinting for detecting style changes between viewports
- Multi-format report generation (HTML, JSON, Markdown) for matrix test results
- New CLI command `visual-checker matrix` for running responsive tests
- Support for custom viewport configurations with device scale factors and user agents

## [0.1.0] - 2025-01-24

### Added
- Initial release of visual-checker
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