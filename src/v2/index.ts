/**
 * V2 API - Visual Checkerの新しいシンプルなAPI
 */

// 型定義
export * from './types/index.js';

// レイアウト抽出
export { extractLayout } from './extractor/index.js';

// レイアウト要約
export { summarizeLayout } from './summarizer/index.js';

// 類似度計算
export {
  calculateLayoutSimilarity,
  generateSimilarityReport,
  calculateCoordinateSimilarity,
  calculateAccessibilitySimilarity,
  calculateTextSimilarity,
  calculateTextLengthSimilarity
} from './similarity/index.js';

// SVGレンダリング
export { renderLayoutToSVG } from './renderer/index.js';
export type { SVGRenderOptions } from './renderer/index.js';

// 安定性分析
export {
  analyzeLayoutStability,
  checkAdaptiveStability,
  generateStabilityReport
} from './stability/index.js';
export type {
  StabilityAnalysisOptions,
  StabilityProgress,
  StabilityAnalysisResult,
  StabilityRecommendations,
  AdaptiveStabilityConfig,
  FinalStabilityConfig
} from './stability/index.js';