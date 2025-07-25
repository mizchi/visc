/**
 * 視覚的な配置に基づくレイアウト比較
 * DOM構造に依存せず、純粋に視覚的な位置とサイズで比較
 */

import type { SemanticGroup, LayoutAnalysisResult } from './extractor.js';
import { 
  extractRectFeatures, 
  calculateRectDistance,
  type RectDistanceOptions,
  type LayoutSimilarity 
} from './rect-distance.js';

/**
 * 視覚的に重なっているかチェック
 */
function isOverlapping(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    rect1.x + rect1.width <= rect2.x ||
    rect2.x + rect2.width <= rect1.x ||
    rect1.y + rect1.height <= rect2.y ||
    rect2.y + rect2.height <= rect1.y
  );
}

/**
 * 矩形の重なり面積を計算
 */
function getOverlapArea(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  if (!isOverlapping(rect1, rect2)) return 0;

  const xOverlap = Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - 
                   Math.max(rect1.x, rect2.x);
  const yOverlap = Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - 
                   Math.max(rect1.y, rect2.y);

  return xOverlap * yOverlap;
}

/**
 * セマンティックグループをフラット化（子要素も含めて1次元配列に）
 */
export function flattenGroups(groups: SemanticGroup[]): SemanticGroup[] {
  const flattened: SemanticGroup[] = [];

  function traverse(group: SemanticGroup) {
    flattened.push(group);
    if (group.children && group.children.length > 0) {
      group.children.forEach(traverse);
    }
  }

  groups.forEach(traverse);
  return flattened;
}

/**
 * 視覚的な類似度を計算（DOM構造を無視）
 */
export function calculateVisualSimilarity(
  groups1: SemanticGroup[],
  groups2: SemanticGroup[],
  options: RectDistanceOptions = {}
): LayoutSimilarity & {
  matchedElements: number;
  totalElements: number;
  unmatchedRects: Array<{ x: number; y: number; width: number; height: number }>;
} {
  // グループをフラット化して親子関係を無視
  const flat1 = flattenGroups(groups1);
  const flat2 = flattenGroups(groups2);

  const matchedGroups: LayoutSimilarity['matchedGroups'] = [];
  const used1 = new Set<number>();
  const used2 = new Set<number>();

  // 各グループに対して最も視覚的に近いグループを見つける
  flat1.forEach((group1, idx1) => {
    if (used1.has(idx1)) return;

    let bestMatch: {
      group: SemanticGroup;
      similarity: number;
      index: number;
      visualScore: number;
    } | null = null;

    flat2.forEach((group2, idx2) => {
      if (used2.has(idx2)) return;

      // 視覚的な距離を計算
      const rectDistance = calculateRectDistance(group1.bounds, group2.bounds, options);
      
      // タイプの一致度
      const typeMatch = group1.type === group2.type ? 1 : 0.5;
      
      // 重なり面積の割合
      const overlapArea = getOverlapArea(group1.bounds, group2.bounds);
      const area1 = group1.bounds.width * group1.bounds.height;
      const area2 = group2.bounds.width * group2.bounds.height;
      const overlapRatio = overlapArea / Math.min(area1, area2);

      // 視覚的類似度スコア
      const visualScore = (1 - Math.min(rectDistance, 1)) * 0.6 +
                         typeMatch * 0.2 +
                         overlapRatio * 0.2;

      if (!bestMatch || visualScore > bestMatch.visualScore) {
        bestMatch = {
          group: group2,
          similarity: visualScore,
          index: idx2,
          visualScore
        };
      }
    });

    // 視覚的に十分近い場合のみマッチとする
    if (bestMatch) {
      const validMatch = bestMatch as {
        group: SemanticGroup;
        similarity: number;
        index: number;
        visualScore: number;
      };
      if (validMatch.visualScore > 0.5) {
        matchedGroups.push({
          group1,
          group2: validMatch.group,
          similarity: validMatch.similarity
        });
        used1.add(idx1);
        used2.add(validMatch.index);
      }
    }
  });

  // タイプ別のカバレッジを計算
  const typeGroups1 = groupByType(flat1);
  const typeGroups2 = groupByType(flat2);
  
  let totalTypeSimilarity = 0;
  let typeCount = 0;

  Object.keys(typeGroups1).forEach(type => {
    const count1 = typeGroups1[type].length;
    const count2 = typeGroups2[type]?.length || 0;
    const matchedCount = matchedGroups.filter(m => m.group1.type === type).length;
    
    if (count1 > 0 || count2 > 0) {
      const coverage = matchedCount / Math.max(count1, count2);
      totalTypeSimilarity += coverage;
      typeCount++;
    }
  });

  const typeSimilarity = typeCount > 0 ? totalTypeSimilarity / typeCount : 0;

  // 全体的な類似度
  const matchRatio = matchedGroups.length / Math.max(flat1.length, flat2.length);
  const avgSimilarity = matchedGroups.length > 0
    ? matchedGroups.reduce((sum, m) => sum + m.similarity, 0) / matchedGroups.length
    : 0;

  const overallSimilarity = matchRatio * 0.4 + avgSimilarity * 0.4 + typeSimilarity * 0.2;

  // メトリクスを計算
  const metrics = calculateVisualMetrics(flat1, flat2, options);

  // マッチしなかった矩形を収集
  const unmatchedRects: Array<{ x: number; y: number; width: number; height: number }> = [];
  flat1.forEach((group, idx) => {
    if (!used1.has(idx)) {
      unmatchedRects.push(group.bounds);
    }
  });
  flat2.forEach((group, idx) => {
    if (!used2.has(idx)) {
      unmatchedRects.push(group.bounds);
    }
  });

  return {
    similarity: overallSimilarity,
    metrics,
    matchedGroups,
    matchedElements: matchedGroups.length,
    totalElements: flat1.length + flat2.length,
    unmatchedRects
  };
}

/**
 * タイプ別にグループ化
 */
function groupByType(groups: SemanticGroup[]): Record<string, SemanticGroup[]> {
  const result: Record<string, SemanticGroup[]> = {};
  
  groups.forEach(group => {
    if (!result[group.type]) {
      result[group.type] = [];
    }
    result[group.type].push(group);
  });

  return result;
}

/**
 * 視覚的なメトリクスを計算
 */
function calculateVisualMetrics(
  groups1: SemanticGroup[],
  groups2: SemanticGroup[],
  options: RectDistanceOptions = {}
): LayoutSimilarity['metrics'] {
  const viewport = options.viewport || { width: 1920, height: 1080 };
  
  // 画面を9分割のグリッドに分けて、各エリアの要素数を比較
  const grid1 = createVisualGrid(groups1, viewport);
  const grid2 = createVisualGrid(groups2, viewport);
  
  let gridDistance = 0;
  for (let i = 0; i < 9; i++) {
    const diff = Math.abs(grid1[i] - grid2[i]);
    gridDistance += diff / Math.max(grid1[i], grid2[i], 1);
  }
  gridDistance /= 9;

  // 全体的な配置の重心を比較
  const centroid1 = calculateCentroid(groups1);
  const centroid2 = calculateCentroid(groups2);
  
  const centroidDistance = Math.sqrt(
    Math.pow((centroid1.x - centroid2.x) / viewport.width, 2) +
    Math.pow((centroid1.y - centroid2.y) / viewport.height, 2)
  );

  return {
    positionDistance: gridDistance,
    sizeDistance: 0, // この実装では個別に計算しない
    aspectRatioDistance: 0, // この実装では個別に計算しない
    euclideanDistance: centroidDistance
  };
}

/**
 * 9分割グリッドでの要素分布を計算
 */
function createVisualGrid(
  groups: SemanticGroup[],
  viewport: { width: number; height: number }
): number[] {
  const grid = new Array(9).fill(0);
  const cellWidth = viewport.width / 3;
  const cellHeight = viewport.height / 3;

  groups.forEach(group => {
    const centerX = group.bounds.x + group.bounds.width / 2;
    const centerY = group.bounds.y + group.bounds.height / 2;
    
    const col = Math.floor(centerX / cellWidth);
    const row = Math.floor(centerY / cellHeight);
    const index = row * 3 + col;
    
    if (index >= 0 && index < 9) {
      grid[index]++;
    }
  });

  return grid;
}

/**
 * グループの重心を計算
 */
function calculateCentroid(groups: SemanticGroup[]): { x: number; y: number } {
  if (groups.length === 0) return { x: 0, y: 0 };

  let totalX = 0;
  let totalY = 0;
  let totalArea = 0;

  groups.forEach(group => {
    const area = group.bounds.width * group.bounds.height;
    const centerX = group.bounds.x + group.bounds.width / 2;
    const centerY = group.bounds.y + group.bounds.height / 2;
    
    totalX += centerX * area;
    totalY += centerY * area;
    totalArea += area;
  });

  return {
    x: totalArea > 0 ? totalX / totalArea : 0,
    y: totalArea > 0 ? totalY / totalArea : 0
  };
}

/**
 * 視覚的に同じレイアウト構造かチェック
 */
export function isVisuallyEqualLayout(
  groups1: SemanticGroup[],
  groups2: SemanticGroup[],
  threshold: number = 0.7
): boolean {
  const similarity = calculateVisualSimilarity(groups1, groups2);
  return similarity.similarity >= threshold;
}