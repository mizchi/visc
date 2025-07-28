/**
 * V2 Similarity - 統合的な類似度計算
 */

import { LayoutSummary, SimilarityResult } from '../types/index.js';
import { calculateCoordinateSimilarity } from './coordinate.js';
import { calculateAccessibilitySimilarity } from './accessibility.js';
import { calculateTextSimilarity } from './text.js';
import { calculateTextLengthSimilarity } from './text-length.js';

/**
 * レイアウトの類似度を計算
 */
export function calculateLayoutSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary
): SimilarityResult {
  // 各種類似度を計算
  const coordinate = calculateCoordinateSimilarity(layout1, layout2);
  const accessibility = calculateAccessibilitySimilarity(layout1, layout2);
  const text = calculateTextSimilarity(layout1, layout2);
  const textLength = calculateTextLengthSimilarity(layout1, layout2);
  
  // 全体的な類似度（重み付き平均）
  const overallSimilarity = (
    coordinate.similarity * 0.3 +
    accessibility.similarity * 0.2 +
    text.similarity * 0.3 +
    textLength.similarity * 0.2
  );
  
  return {
    overallSimilarity,
    coordinateSimilarity: coordinate.similarity,
    accessibilitySimilarity: accessibility.similarity,
    textSimilarity: text.similarity,
    textLengthSimilarity: textLength.similarity,
    details: {
      coordinateDetails: coordinate.details,
      accessibilityDetails: accessibility.details,
      textDetails: text.details,
      textLengthDetails: textLength.details
    }
  };
}

/**
 * 類似度レポートを生成
 */
export function generateSimilarityReport(result: SimilarityResult): string {
  const report: string[] = [];
  
  report.push('# レイアウト類似度レポート\n');
  report.push(`## 全体的な類似度: ${(result.overallSimilarity * 100).toFixed(1)}%\n`);
  
  report.push('### 各要素の類似度');
  report.push(`- 座標の類似度: ${(result.coordinateSimilarity * 100).toFixed(1)}%`);
  report.push(`- アクセシビリティの類似度: ${(result.accessibilitySimilarity * 100).toFixed(1)}%`);
  report.push(`- テキストの類似度: ${(result.textSimilarity * 100).toFixed(1)}%`);
  report.push(`- テキスト長の類似度: ${(result.textLengthSimilarity * 100).toFixed(1)}%\n`);
  
  // 座標の詳細
  report.push('### 座標の詳細');
  const coord = result.details.coordinateDetails;
  report.push(`- マッチしたノード: ${coord.matchedNodes}/${coord.totalNodes}`);
  report.push(`- 平均位置変化: X=${coord.averagePositionDelta.x.toFixed(1)}px, Y=${coord.averagePositionDelta.y.toFixed(1)}px`);
  report.push(`- 平均サイズ変化: 幅=${coord.averageSizeDelta.width.toFixed(1)}px, 高さ=${coord.averageSizeDelta.height.toFixed(1)}px\n`);
  
  // アクセシビリティの詳細
  report.push('### アクセシビリティの詳細');
  const acc = result.details.accessibilityDetails;
  report.push(`- ロールの一致: ${acc.matchedRoles}/${acc.totalRoles}`);
  report.push(`- ラベルの一致: ${acc.matchedLabels}/${acc.totalLabels}`);
  report.push(`- 状態の一致: ${acc.matchedStates}/${acc.totalStates}\n`);
  
  // テキストの詳細
  report.push('### テキストの詳細');
  const text = result.details.textDetails;
  report.push(`- 完全一致: ${text.exactMatches}/${text.totalTexts}`);
  report.push(`- 部分一致: ${text.partialMatches}/${text.totalTexts}`);
  report.push(`- 平均レーベンシュタイン距離: ${text.averageLevenshteinDistance.toFixed(1)}\n`);
  
  // テキスト長の詳細
  report.push('### テキスト長の詳細');
  const textLen = result.details.textLengthDetails;
  report.push(`- レイアウト1の総文字数: ${textLen.totalLength1}`);
  report.push(`- レイアウト2の総文字数: ${textLen.totalLength2}`);
  report.push(`- 長さの比率: ${(textLen.lengthRatio * 100).toFixed(1)}%`);
  report.push(`- 平均長さ差: ${textLen.averageLengthDifference.toFixed(1)}文字\n`);
  
  return report.join('\n');
}

// 個別の類似度計算関数もエクスポート
export { calculateCoordinateSimilarity } from './coordinate.js';
export { calculateAccessibilitySimilarity } from './accessibility.js';
export { calculateTextSimilarity } from './text.js';
export { calculateTextLengthSimilarity } from './text-length.js';