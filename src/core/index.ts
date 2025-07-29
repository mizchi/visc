/**
 * Visual Checker Core API
 * 
 * 最も基本的な機能を提供するコアモジュール
 * 
 * @example
 * ```typescript
 * import { captureScreenshot, compareImages } from 'visual-checker/core';
 * 
 * // スクリーンショットを撮影
 * const screenshot = await captureScreenshot('https://example.com');
 * 
 * // 画像を比較
 * const result = await compareImages('before.png', 'after.png');
 * ```
 * 
 * @module core
 */

export { 
  captureScreenshot, 
  captureMultipleScreenshots 
} from './screenshot.js';

export { 
  compareImages,
  compareMultipleImages 
} from './compare.js';

export type {
  ScreenshotOptions,
  ScreenshotResult,
  CompareOptions,
  CompareResult
} from './types.js';

// 新しい統合された型をエクスポート
export type {
  SummarizedNode,
  NodeGroup,
  Position,
  SemanticType,
  CoordinateSimilarityDetails,
  AccessibilitySimilarityDetails,
  TextSimilarityDetails,
  TextLengthSimilarityDetails
} from './types.js';