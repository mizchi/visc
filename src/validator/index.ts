/**
 * バリデーターモジュールのエクスポート
 */

// 型定義
export * from './types.js';

// レイアウトバリデーター
export {
  LayoutStructureValidator,
  LayoutVisualValidator,
  LayoutStabilityValidator
} from './layout-validator.js';

// Pixelmatchバリデーター
export {
  createPixelmatchValidator,
  createRegionPixelmatchValidator,
  createAnimationDetectorValidator,
  createSmartPixelmatchValidator,
  // 互換性のため
  PixelmatchValidator,
  RegionPixelmatchValidator,
  AnimationDetectorValidator
} from './pixelmatch-validator.js';

// Pixelmatch実行ユーティリティ
export {
  executePixelmatch,
  executeRegionPixelmatch,
  loadPNG,
  createPNGFromBuffer,
  prepareScreenshotForPixelmatch
} from './pixelmatch-executor.js';

export type {
  PixelmatchResult,
  PixelmatchOptions
} from './pixelmatch-executor.js';

// AIバリデーター
export {
  AIPixelmatchValidator,
  AIPatternLearningValidator
} from './ai-pixelmatch-validator.js';

export {
  AIImageComparisonValidator,
  AIResponsiveValidator
} from './ai-image-validator.js';

// バリデーターチェーン
export {
  ValidatorChainImpl,
  ConditionalValidatorChain,
  WeightedValidatorChain,
  ValidatorChainBuilder
} from './validator-chain.js';

// ファクトリーとプリセット
export {
  ValidatorFactory,
  ValidatorPreset,
  defaultValidatorFactory
} from './validator-factory.js';

// ユーティリティ関数
export { 
  createValidationPipeline,
  formatValidationResults,
  validateCombined,
  validateStability
} from './utils.js';

export type { ValidationPipelineResult } from './utils.js';