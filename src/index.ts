export { TestRunner } from "./test-runner.ts";
export { BrowserController } from "./browser-controller.ts";
export { SnapshotComparator } from "./snapshot-comparator.ts";
export type { VisualCheckConfig, UrlConfig, TestResult } from "./types.ts";

// Layout analysis exports
export {
  getSemanticType,
  calculateImportance,
  detectPatterns,
  extractLayoutScript,
} from "./layout/extractor.ts";

export {
  detectSemanticGroups,
  extractSemanticLayoutScript,
} from "./layout/semantic-analyzer.ts";

export type {
  LayoutElement,
  SemanticGroup,
  LayoutPattern,
  LayoutAnalysisResult,
  LayoutRect,
} from "./layout/extractor.ts";

// Layout comparison exports
export {
  compareLayouts,
  hasLayoutChanged,
  isLayoutSimilar,
} from "./layout/comparator.ts";

export type {
  LayoutDifference,
  LayoutComparisonResult,
} from "./layout/comparator.ts";

// Layout assertion exports
export {
  assertLayoutsIdentical,
  assertLayoutsSimilar,
  assertNoLayoutChanges,
  createLayoutMatchers,
  expectLayoutsToMatch,
  LayoutAssertionError,
} from "./layout/assertions.ts";

// Flakiness detection exports
export {
  detectFlakiness,
  generateFlakinessReport,
} from "./layout/flakiness-detector.ts";

export type {
  FlakinessAnalysis,
  FlakyElement,
  VariationDetail,
} from "./layout/flakiness-detector.ts";

export {
  MultiCrawlManager,
  commonVariations,
} from "./layout/multi-crawl-manager.ts";

export type {
  MultiCrawlOptions,
  MultiCrawlResult,
} from "./layout/multi-crawl-manager.ts";

// Browser runner exports
export * from "./runner/index.js";

// Layout distance calculation exports
export {
  extractRectFeatures,
  calculateRectDistance,
  calculateGroupSimilarity,
  calculateLayoutSimilarity,
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
export { WorkflowEngine, defaultWorkflowConfig, createGeminiWorkflowConfig } from "./workflow/workflow-engine.js";
export { createAIProvider } from "./workflow/ai-provider-factory.js";
