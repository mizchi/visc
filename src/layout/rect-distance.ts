/**
 * 矩形間の距離計算とレイアウトの類似性判定
 */

import type { LayoutRect, SemanticGroup } from './extractor.js';

/**
 * 矩形間の距離計算オプション
 */
export interface RectDistanceOptions {
  /** 位置の重み (0-1) */
  positionWeight?: number;
  /** サイズの重み (0-1) */
  sizeWeight?: number;
  /** アスペクト比の重み (0-1) */
  aspectRatioWeight?: number;
  /** 正規化の基準（ビューポートサイズ） */
  viewport?: { width: number; height: number };
}

/**
 * 矩形の特徴ベクトル
 */
export interface RectFeatures {
  /** 正規化されたX座標 */
  normalizedX: number;
  /** 正規化されたY座標 */
  normalizedY: number;
  /** 正規化された幅 */
  normalizedWidth: number;
  /** 正規化された高さ */
  normalizedHeight: number;
  /** アスペクト比 */
  aspectRatio: number;
  /** 中心X座標 */
  centerX: number;
  /** 中心Y座標 */
  centerY: number;
}

/**
 * レイアウト類似性の結果
 */
export interface LayoutSimilarity {
  /** 全体的な類似度スコア (0-1) */
  similarity: number;
  /** 個別の距離メトリクス */
  metrics: {
    positionDistance: number;
    sizeDistance: number;
    aspectRatioDistance: number;
    euclideanDistance: number;
  };
  /** マッチしたグループのペア */
  matchedGroups: Array<{
    group1: SemanticGroup;
    group2: SemanticGroup;
    similarity: number;
  }>;
}

/**
 * 矩形を特徴ベクトルに変換
 */
export function extractRectFeatures(
  rect: LayoutRect | { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number }
): RectFeatures {
  const normalizedX = rect.x / viewport.width;
  const normalizedY = rect.y / viewport.height;
  const normalizedWidth = rect.width / viewport.width;
  const normalizedHeight = rect.height / viewport.height;
  const aspectRatio = rect.width / Math.max(rect.height, 1);
  const centerX = (rect.x + rect.width / 2) / viewport.width;
  const centerY = (rect.y + rect.height / 2) / viewport.height;

  return {
    normalizedX,
    normalizedY,
    normalizedWidth,
    normalizedHeight,
    aspectRatio,
    centerX,
    centerY
  };
}

/**
 * 2つの矩形間の距離を計算
 */
export function calculateRectDistance(
  rect1: LayoutRect | { x: number; y: number; width: number; height: number },
  rect2: LayoutRect | { x: number; y: number; width: number; height: number },
  options: RectDistanceOptions = {}
): number {
  const {
    positionWeight = 0.4,
    sizeWeight = 0.4,
    aspectRatioWeight = 0.2,
    viewport = { width: 1920, height: 1080 }
  } = options;

  const features1 = extractRectFeatures(rect1, viewport);
  const features2 = extractRectFeatures(rect2, viewport);

  // 位置の距離（中心点間のユークリッド距離）
  const positionDistance = Math.sqrt(
    Math.pow(features1.centerX - features2.centerX, 2) +
    Math.pow(features1.centerY - features2.centerY, 2)
  );

  // サイズの距離
  const sizeDistance = Math.sqrt(
    Math.pow(features1.normalizedWidth - features2.normalizedWidth, 2) +
    Math.pow(features1.normalizedHeight - features2.normalizedHeight, 2)
  );

  // アスペクト比の距離
  const aspectRatioDistance = Math.abs(features1.aspectRatio - features2.aspectRatio) / 
    Math.max(features1.aspectRatio, features2.aspectRatio);

  // 重み付き距離
  const weightedDistance = 
    positionWeight * positionDistance +
    sizeWeight * sizeDistance +
    aspectRatioWeight * aspectRatioDistance;

  return weightedDistance;
}

/**
 * セマンティックグループ間の類似度を計算
 */
export function calculateGroupSimilarity(
  group1: SemanticGroup,
  group2: SemanticGroup,
  options: RectDistanceOptions = {}
): number {
  // タイプが異なる場合は類似度0
  if (group1.type !== group2.type) {
    return 0;
  }

  // 矩形の距離を計算
  const rectDistance = calculateRectDistance(group1.bounds, group2.bounds, options);
  
  // 要素数の差を考慮
  const elementCountRatio = Math.min(group1.elements.length, group2.elements.length) /
    Math.max(group1.elements.length, group2.elements.length, 1);

  // 重要度の差を考慮
  const importanceDiff = Math.abs(group1.importance - group2.importance) / 100;

  // 子要素の数の差を考慮
  const childrenCountRatio = Math.min(group1.children.length, group2.children.length) /
    Math.max(group1.children.length, group2.children.length, 1);

  // 類似度スコアを計算（0-1の範囲）
  const similarity = (1 - Math.min(rectDistance, 1)) * 0.4 +
    elementCountRatio * 0.2 +
    (1 - importanceDiff) * 0.2 +
    childrenCountRatio * 0.2;

  return Math.max(0, Math.min(1, similarity));
}

/**
 * レイアウト全体の類似性を計算
 */
export function calculateLayoutSimilarity(
  groups1: SemanticGroup[],
  groups2: SemanticGroup[],
  options: RectDistanceOptions = {}
): LayoutSimilarity {
  const matchedGroups: LayoutSimilarity['matchedGroups'] = [];
  const used2 = new Set<number>();

  // 各グループに対して最も類似したグループを見つける
  for (const group1 of groups1) {
    let bestMatch: { group: SemanticGroup; similarity: number; index: number } | null = null;
    
    groups2.forEach((group2, index) => {
      if (used2.has(index)) return;
      
      const similarity = calculateGroupSimilarity(group1, group2, options);
      
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { group: group2, similarity, index };
      }
    });

    if (bestMatch) {
      const validMatch = bestMatch as {
        group: SemanticGroup;
        similarity: number;
        index: number;
      };
      if (validMatch.similarity > 0.5) {
        matchedGroups.push({
          group1,
          group2: validMatch.group,
          similarity: validMatch.similarity
        });
        used2.add(validMatch.index);
      }
    }
  }

  // 全体的な類似度スコアを計算
  const matchRatio = matchedGroups.length / Math.max(groups1.length, groups2.length);
  const avgSimilarity = matchedGroups.length > 0
    ? matchedGroups.reduce((sum, m) => sum + m.similarity, 0) / matchedGroups.length
    : 0;

  const overallSimilarity = matchRatio * 0.5 + avgSimilarity * 0.5;

  // メトリクスを計算
  const metrics = calculateLayoutMetrics(groups1, groups2, options);

  return {
    similarity: overallSimilarity,
    metrics,
    matchedGroups
  };
}

/**
 * レイアウト間の詳細なメトリクスを計算
 */
function calculateLayoutMetrics(
  groups1: SemanticGroup[],
  groups2: SemanticGroup[],
  options: RectDistanceOptions = {}
): LayoutSimilarity['metrics'] {
  let totalPositionDistance = 0;
  let totalSizeDistance = 0;
  let totalAspectRatioDistance = 0;
  let count = 0;

  const viewport = options.viewport || { width: 1920, height: 1080 };

  // 各グループペアの距離を計算
  for (const group1 of groups1) {
    for (const group2 of groups2) {
      if (group1.type !== group2.type) continue;

      const features1 = extractRectFeatures(group1.bounds, viewport);
      const features2 = extractRectFeatures(group2.bounds, viewport);

      const positionDistance = Math.sqrt(
        Math.pow(features1.centerX - features2.centerX, 2) +
        Math.pow(features1.centerY - features2.centerY, 2)
      );

      const sizeDistance = Math.sqrt(
        Math.pow(features1.normalizedWidth - features2.normalizedWidth, 2) +
        Math.pow(features1.normalizedHeight - features2.normalizedHeight, 2)
      );

      const aspectRatioDistance = Math.abs(features1.aspectRatio - features2.aspectRatio) /
        Math.max(features1.aspectRatio, features2.aspectRatio);

      totalPositionDistance += positionDistance;
      totalSizeDistance += sizeDistance;
      totalAspectRatioDistance += aspectRatioDistance;
      count++;
    }
  }

  const avgPositionDistance = count > 0 ? totalPositionDistance / count : 1;
  const avgSizeDistance = count > 0 ? totalSizeDistance / count : 1;
  const avgAspectRatioDistance = count > 0 ? totalAspectRatioDistance / count : 1;
  const euclideanDistance = Math.sqrt(
    avgPositionDistance * avgPositionDistance +
    avgSizeDistance * avgSizeDistance +
    avgAspectRatioDistance * avgAspectRatioDistance
  );

  return {
    positionDistance: avgPositionDistance,
    sizeDistance: avgSizeDistance,
    aspectRatioDistance: avgAspectRatioDistance,
    euclideanDistance
  };
}

/**
 * レイアウトのフィンガープリントを生成
 */
export function generateLayoutFingerprint(groups: SemanticGroup[]): string {
  // グループをタイプと位置でソート
  const sortedGroups = [...groups].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.bounds.y !== b.bounds.y) return a.bounds.y - b.bounds.y;
    return a.bounds.x - b.bounds.x;
  });

  // 各グループの特徴を文字列化
  const features = sortedGroups.map(group => {
    const gridX = Math.floor(group.bounds.x / 100);
    const gridY = Math.floor(group.bounds.y / 100);
    const gridW = Math.floor(group.bounds.width / 100);
    const gridH = Math.floor(group.bounds.height / 100);
    
    return `${group.type}:${gridX},${gridY},${gridW},${gridH}:${group.elements.length}`;
  });

  return features.join('|');
}

/**
 * 2つのレイアウトが同じ構造を持つかチェック
 */
export function isSameLayoutStructure(
  groups1: SemanticGroup[],
  groups2: SemanticGroup[],
  threshold: number = 0.8
): boolean {
  const similarity = calculateLayoutSimilarity(groups1, groups2);
  return similarity.similarity >= threshold;
}