/**
 * Visual Checker - Main Entry Point
 */

// Pure Types
export * from "./pure/types/core.types.js";
export * from "./pure/types/layout.types.js";
export * from "./pure/types/visual.types.js";
export * from "./pure/types/stability.types.js";
export * from "./pure/types/config.types.js";

// Pure Algorithms
export {
  calculateLayoutSimilarity,
  generateSimilarityReport,
} from "./pure/algorithms/similarity.js";

// Domain Logic
export { summarizeLayout } from "./domain/layout-summarizer.js";
export { analyzeLayoutStability } from "./domain/stability-analyzer.js";
export { renderLayoutToSVG } from "./domain/layout-svg-renderer.js";

// Effects - Browser
export {
  createPuppeteerDriver,
  type PuppeteerDriver,
  type CoverageReport,
} from "./effects/browser/puppeteer.js";
export {
  createPlaywrightDriver,
  type PlaywrightDriver,
} from "./effects/browser/playwright.js";
export {
  createLayoutExtractor,
  type LayoutExtractor,
} from "./effects/browser/layout-extractor.js";

// Effects - File System
export {
  readFile,
  writeFile,
  writeBinaryFile,
  readJSON,
  writeJSON,
  ensureDir,
  fileExists,
  dirExists,
  removeFile,
  removeDir,
  copyFile,
  listFiles,
  getFileInfo,
} from "./effects/fs/file-operations.js";
export {
  readPNG,
  writePNG,
  compareImages,
  saveScreenshot,
  type ImageCompareResult,
} from "./effects/fs/image-operations.js";

// Application Use Cases
export { checkAdaptiveStability } from "./application/adaptive-stability-checker.js";

// ========================================
// 既存のエクスポート（後方互換性のため）
// これらは将来的に非推奨になる予定
// ========================================

// Level 1: Core API
export {
  captureScreenshot,
  captureMultipleScreenshots,
  compareImages as compareCoreImages,
  compareMultipleImages,
} from "./core/index.js";

export type {
  ScreenshotResult,
  CompareOptions,
  CompareResult,
} from "./core/index.js";

// Legacy exports
export { TestRunner } from "./test-runner.js";
export { BrowserController as LegacyBrowserController } from "./browser-controller.js";
export { SnapshotComparator } from "./snapshot-comparator.js";
export type { VisualCheckConfig, UrlConfig, TestResult } from "./types.js";

// Layout analysis exports
export {
  getSemanticType,
  calculateImportance,
  detectPatterns,
  getExtractLayoutScript,
} from "./layout/extractor.js";

export {
  detectSemanticGroups,
  getExtractSemanticLayoutScript,
} from "./layout/semantic-analyzer.js";

export type {
  LayoutElement,
  SemanticGroup,
  LayoutPattern,
  LayoutAnalysisResult,
  LayoutRect,
} from "./layout/extractor.js";

// Layout comparison exports
export {
  compareLayouts,
  hasLayoutChanged,
  isLayoutSimilar,
} from "./layout/comparator.js";

export type {
  LayoutDifference,
  LayoutComparisonResult,
} from "./layout/comparator.js";

// Layout assertion exports
export {
  assertLayoutsIdentical,
  assertLayoutsSimilar,
  assertNoLayoutChanges,
  createLayoutMatchers,
  expectLayoutsToMatch,
  LayoutAssertionError,
} from "./layout/assertions.js";

// Flakiness detection exports
export {
  detectFlakiness,
  generateFlakinessReport,
} from "./layout/flakiness-detector.js";

export type {
  FlakinessAnalysis,
  FlakyElement,
  VariationDetail,
} from "./layout/flakiness-detector.js";

export {
  MultiCrawlManager,
  getCommonVariations,
} from "./layout/multi-crawl-manager.js";

export type {
  MultiCrawlOptions,
  MultiCrawlResult,
} from "./layout/multi-crawl-manager.js";

// Browser runner exports
export * from "./browser/runners/index.js";

// Layout distance calculation exports
export {
  extractRectFeatures,
  calculateRectDistance,
  calculateGroupSimilarity,
  calculateLayoutSimilarity as calculateLegacyLayoutSimilarity,
  generateLayoutFingerprint,
  isSameLayoutStructure,
} from "./layout/rect-distance.js";

export type {
  RectDistanceOptions,
  RectFeatures,
  LayoutSimilarity,
} from "./layout/rect-distance.js";

// Visual layout comparison exports
export {
  flattenGroups,
  calculateVisualSimilarity,
  isVisuallyEqualLayout,
} from "./layout/rect-distance-visual.js";

// Validator exports
export * from "./validator/index.js";

// Workflow exports
export * from "./workflow/types.js";
export {
  WorkflowEngine,
  getDefaultWorkflowConfig,
  createGeminiWorkflowConfig,
} from "./workflow/workflow-engine.js";
export { createAIProvider } from "./workflow/ai-provider-factory.js";

// Responsive Matrix Testing exports
export { ResponsiveMatrixTester } from "./responsive-matrix/matrix-tester.js";
export { ResponsiveMatrixReportGenerator } from "./responsive-matrix/report-generator.js";
export type {
  ResponsiveMatrixResult,
  ViewportTestResult,
  MediaQueryConsistency,
  ViewportSize,
} from "./types.js";

// Content-Aware Layout Comparison exports
export {
  compareLayoutsWithContentExclusion,
  analyzeLayoutWithContentAwareness,
} from "./layout/content-aware-comparator.js";
export type {
  ContentAwareComparisonOptions,
  ContentAwareComparisonResult,
  ContentExtractionResult,
} from "./layout/content-aware-comparator.js";

// ========================================
// 便利な初期化関数
// ========================================

// BrowserControllerとSnapshotManagerを再エクスポート（ユーザーが直接使用できるように）
export { BrowserController } from "./browser-controller.js";
export { SnapshotManager } from "./snapshot/manager.js";
