export type { StabilityCheckOptions } from "./types.js";
export type {
  LayoutAnalysisResult,
  LayoutElement,
  SemanticGroup,
} from "./layout/extractor.js";

// Core APIs - データ取得と変換
export { 
  fetchRawLayoutData,
  extractLayoutTree,
} from "./browser/puppeteer.js";
export {
  withBrowser,
  withPage,
  getLayoutsParallel,
  getLayoutsSamples,
} from "./browser/helpers.js";
export {
  getExtractLayoutScript,
  organizeIntoSemanticGroups,
  analyzeLayout,
} from "./layout/extractor.js";

// Core APIs - 比較と分析
export {
  compareLayoutTrees,
  calculateSimilarity,
  hasLayoutChanged,
} from "./layout/comparator.js";
export type {
  LayoutComparisonResult,
  LayoutDifference,
} from "./layout/comparator.js";

// Semantic Comparator
export {
  compareSemanticGroups,
  getSemanticStatistics,
  type SemanticDifference,
  type SemanticComparisonResult,
} from "./layout/semantic-comparator.js";

// Flat Comparator
export {
  flattenSemanticGroups,
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
} from "./layout/calibrator.js";

// Rendering APIs - 可視化
export { renderLayoutToSvg } from "./renderer/layout-renderer.js";
export { renderComparisonToSvg } from "./renderer/comparison-renderer.js";
