export type { StabilityCheckOptions } from "./types.js";
export type {
  VisualTreeAnalysis,
  VisualNode,
  VisualNodeGroup,
} from "./layout/extractor.js";

// Core APIs - データ取得と変換
export {
  fetchRawLayoutData,
  fetchRawLayoutDataViewportMatrix,
  extractLayoutTree,
} from "./browser/puppeteer.js";
export {
  getExtractLayoutScript,
  organizeIntoVisualNodeGroups,
  analyzeLayout,
} from "./layout/extractor.js";

// Core APIs - 比較と分析
export {
  compareLayoutTrees,
  calculateSimilarity,
  hasLayoutChanged,
} from "./layout/comparator.js";
export type {
  VisualComparisonResult,
  VisualDifference,
} from "./layout/comparator.js";

// Visual Comparator
export {
  compareVisualNodeGroups,
  getVisualNodeGroupStatistics,
  type VisualGroupDifference,
  type VisualGroupComparisonResult,
} from "./layout/visual-comparator.js";

// Flat Comparator
export {
  flattenVisualNodeGroups,
  compareFlattenedGroups,
  generateChangeSummary,
  type FlattenedGroup,
  type GroupMatch,
  type FlatComparisonResult,
} from "./layout/flat-comparator.js";
export { detectFlakiness } from "./layout/flakiness-detector.js";

// High-level APIs - 自動調整
export {
  calibrateComparisonSettings,
  validateWithSettings,
  type ComparisonSettings,
  type CalibrationResult,
  type ValidationResult,
  type DynamicElementInfo,
} from "./layout/calibrator.js";

// Rendering APIs - 可視化
export { renderLayoutToSvg } from "./renderer/layout-renderer.js";
export { renderComparisonToSvg } from "./renderer/comparison-renderer.js";

// Workflow APIs - 高レベルワークフロー
export {
  captureLayouts,
  captureLayout,
  captureLayoutMatrix,
  compareLayouts,
  collectCaptures,
  generateSummary,
  type Viewport,
  type TestCase,
  type CaptureResult,
  type ComparisonResult,
  type TestResult,
  type CaptureOptions,
  type CompareOptions,
} from "./workflow.js";

// Configuration APIs
export {
  type ViscConfig,
  type ViewportConfig,
  type TestCaseConfig,
  DEFAULT_CONFIG,
} from "./cli/config.js";

// Storage APIs
export { CacheStorage } from "./cli/cache-storage.js";

// Semantic Detection APIs
export {
  detectSemanticDifferences,
  generateSemanticMessage,
  calculatePositionDiff,
  calculateSizeDiff,
  analyzeSubtleDifferences,
} from "./semantic-detector.js";
export type {
  SemanticDifferenceDetection,
  SemanticDifferenceMessage,
  ThresholdConfig,
} from "./types.js";

// Threshold Evaluation APIs
export {
  evaluateThresholds,
  createDefaultThresholds,
  createStrictThresholds,
  createRelaxedThresholds,
  mergeThresholds,
  type ThresholdEvaluation,
  type ThresholdFailure,
  type ThresholdWarning,
} from "./threshold-evaluator.js";
