/**
 * V2 Stability Analyzer - レイアウト類似度を使った安定性分析
 */

import { LayoutSummary, SummarizedNode } from '../types/index.js';
import { calculateLayoutSimilarity } from '../similarity/index.js';
import {
  StabilityAnalysisResult,
  NodeVariation,
  StabilityRecommendations
} from './types.js';

/**
 * 複数のレイアウトサマリーから安定性を分析
 */
export function analyzeLayoutStability(
  summaries: LayoutSummary[]
): StabilityAnalysisResult {
  if (summaries.length < 2) {
    throw new Error('安定性分析には少なくとも2つのレイアウトが必要です');
  }

  // ノードの変動を追跡
  const nodeVariations = trackNodeVariations(summaries);
  
  // 不安定なノードを特定
  const unstableNodes = nodeVariations.filter(v => v.stabilityScore < 0.9);
  const stableNodes = nodeVariations.length - unstableNodes.length;
  
  // 全体的な安定性スコアを計算
  const overallStabilityScore = calculateOverallStability(summaries);
  
  // 推奨設定を生成
  const recommendations = generateRecommendations(unstableNodes, nodeVariations);
  
  return {
    totalNodes: nodeVariations.length,
    stableNodes,
    unstableNodes,
    overallStabilityScore,
    iterations: summaries.length,
    recommendations,
    layoutSummaries: summaries
  };
}

/**
 * ノードの変動を追跡
 */
function trackNodeVariations(summaries: LayoutSummary[]): NodeVariation[] {
  // 全ノードを収集（最初のサマリーをベースに）
  const baseNodes = summaries[0].nodes;
  const variations: NodeVariation[] = [];
  
  for (const baseNode of baseNodes) {
    const variation: NodeVariation = {
      nodeId: baseNode.id,
      tagName: baseNode.tagName,
      className: baseNode.className,
      variations: {
        position: { count: 0, values: [] },
        text: { count: 0, values: [] },
        visibility: { count: 0, values: [] },
        importance: { count: 0, values: [] }
      },
      stabilityScore: 0
    };
    
    // 各イテレーションでの値を収集
    for (const summary of summaries) {
      const node = findMatchingNode(baseNode, summary.nodes);
      if (node) {
        variation.variations.position.values.push(node.position);
        if (node.text) variation.variations.text.values.push(node.text);
        variation.variations.visibility.values.push(!node.accessibility.hidden);
        variation.variations.importance.values.push(node.importance);
      }
    }
    
    // 変動カウントを計算
    variation.variations.position.count = countUniquePositions(variation.variations.position.values);
    variation.variations.text.count = countUniqueValues(variation.variations.text.values);
    variation.variations.visibility.count = countUniqueValues(variation.variations.visibility.values);
    variation.variations.importance.count = countUniqueValues(variation.variations.importance.values);
    
    // 安定性スコアを計算
    variation.stabilityScore = calculateNodeStability(variation);
    
    variations.push(variation);
  }
  
  return variations;
}

/**
 * マッチするノードを見つける
 */
function findMatchingNode(targetNode: SummarizedNode, nodes: SummarizedNode[]): SummarizedNode | null {
  // まずIDで探す
  let match = nodes.find(n => n.id === targetNode.id);
  if (match) return match;
  
  // IDが見つからない場合は、タグ名、クラス名、位置で探す
  match = nodes.find(n => 
    n.tagName === targetNode.tagName &&
    n.className === targetNode.className &&
    Math.abs(n.position.x - targetNode.position.x) < 50 &&
    Math.abs(n.position.y - targetNode.position.y) < 50
  );
  
  return match || null;
}

/**
 * ユニークな位置の数を数える
 */
function countUniquePositions(positions: Array<{ x: number; y: number; width: number; height: number }>): number {
  const unique = new Set<string>();
  for (const pos of positions) {
    // 5px以内の変動は同じとみなす
    const key = `${Math.round(pos.x/5)*5},${Math.round(pos.y/5)*5},${Math.round(pos.width/5)*5},${Math.round(pos.height/5)*5}`;
    unique.add(key);
  }
  return unique.size;
}

/**
 * ユニークな値の数を数える
 */
function countUniqueValues<T>(values: T[]): number {
  return new Set(values).size;
}

/**
 * ノードの安定性スコアを計算
 */
function calculateNodeStability(variation: NodeVariation): number {
  const iterations = variation.variations.position.values.length;
  if (iterations === 0) return 0;
  
  // 各要素の安定性を計算
  const positionStability = 1 - (variation.variations.position.count - 1) / iterations;
  const textStability = variation.variations.text.values.length > 0 ?
    1 - (variation.variations.text.count - 1) / iterations : 1;
  const visibilityStability = 1 - (variation.variations.visibility.count - 1) / iterations;
  const importanceStability = 1 - (variation.variations.importance.count - 1) / iterations;
  
  // 重み付き平均
  return (
    positionStability * 0.4 +
    textStability * 0.3 +
    visibilityStability * 0.2 +
    importanceStability * 0.1
  );
}

/**
 * 全体的な安定性を計算（レイアウト類似度を使用）
 */
function calculateOverallStability(summaries: LayoutSummary[]): number {
  if (summaries.length < 2) return 100;
  
  let totalSimilarity = 0;
  let comparisons = 0;
  
  // 連続するレイアウト間の類似度を計算
  for (let i = 0; i < summaries.length - 1; i++) {
    const similarity = calculateLayoutSimilarity(summaries[i], summaries[i + 1]);
    totalSimilarity += similarity.overallSimilarity;
    comparisons++;
  }
  
  // 平均類似度を安定性スコアとして使用
  return comparisons > 0 ? (totalSimilarity / comparisons) * 100 : 100;
}

/**
 * 推奨設定を生成
 */
function generateRecommendations(
  unstableNodes: NodeVariation[],
  allNodes: NodeVariation[]
): StabilityRecommendations {
  const recommendations: StabilityRecommendations = {
    confidenceLevel: calculateConfidenceLevel(allNodes),
    pixelTolerance: calculatePixelTolerance(unstableNodes),
    percentageTolerance: calculatePercentageTolerance(unstableNodes),
    ignoreSelectors: [],
    ignoreAttributes: [],
    unstableAreas: []
  };
  
  // 不安定な要素のセレクタを特定
  for (const node of unstableNodes) {
    const selector = generateSelector(node);
    const variationType = determineVariationType(node);
    
    if (node.stabilityScore < 0.5) {
      // 非常に不安定な要素は無視リストに追加
      recommendations.ignoreSelectors.push(selector);
    }
    
    recommendations.unstableAreas.push({
      selector,
      reason: getInstabilityReason(node),
      variationType
    });
  }
  
  // 共通の不安定な属性を特定
  if (hasCommonClassPattern(unstableNodes, 'animate')) {
    recommendations.ignoreAttributes.push('class*=animate');
  }
  if (hasCommonClassPattern(unstableNodes, 'dynamic')) {
    recommendations.ignoreAttributes.push('class*=dynamic');
  }
  
  return recommendations;
}

/**
 * 信頼度レベルを計算
 */
function calculateConfidenceLevel(nodes: NodeVariation[]): number {
  const stableNodes = nodes.filter(n => n.stabilityScore >= 0.9).length;
  const totalNodes = nodes.length;
  
  if (totalNodes === 0) return 0;
  
  const stabilityRatio = stableNodes / totalNodes;
  const iterations = nodes[0]?.variations.position.values.length || 0;
  
  // イテレーション数と安定性の比率から信頼度を計算
  let confidence = stabilityRatio;
  if (iterations >= 5) confidence *= 1.1;
  if (iterations >= 10) confidence *= 1.1;
  
  return Math.min(confidence, 1);
}

/**
 * ピクセル許容値を計算
 */
function calculatePixelTolerance(unstableNodes: NodeVariation[]): number {
  if (unstableNodes.length === 0) return 0;
  
  let maxDelta = 0;
  
  for (const node of unstableNodes) {
    const positions = node.variations.position.values;
    for (let i = 1; i < positions.length; i++) {
      const deltaX = Math.abs(positions[i].x - positions[i-1].x);
      const deltaY = Math.abs(positions[i].y - positions[i-1].y);
      maxDelta = Math.max(maxDelta, deltaX, deltaY);
    }
  }
  
  // 最大変動の1.5倍を許容値とする
  return Math.ceil(maxDelta * 1.5);
}

/**
 * パーセント許容値を計算
 */
function calculatePercentageTolerance(unstableNodes: NodeVariation[]): number {
  if (unstableNodes.length === 0) return 0;
  
  // 不安定なノードの割合から計算
  const unstableRatio = unstableNodes.filter(n => n.stabilityScore < 0.7).length / unstableNodes.length;
  
  // 0.1% から 5% の範囲で設定
  return Math.min(5, Math.max(0.1, unstableRatio * 10));
}

/**
 * セレクタを生成
 */
function generateSelector(node: NodeVariation): string {
  if (node.className) {
    const classes = node.className.split(' ').filter(c => c.length > 0);
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  return node.tagName;
}

/**
 * 変動タイプを判定
 */
function determineVariationType(node: NodeVariation): 'position' | 'text' | 'visibility' | 'mixed' {
  const types: string[] = [];
  
  if (node.variations.position.count > 1) types.push('position');
  if (node.variations.text.count > 1) types.push('text');
  if (node.variations.visibility.count > 1) types.push('visibility');
  
  if (types.length === 0) return 'position';
  if (types.length === 1) return types[0] as any;
  return 'mixed';
}

/**
 * 不安定性の理由を取得
 */
function getInstabilityReason(node: NodeVariation): string {
  const reasons: string[] = [];
  
  if (node.variations.position.count > 1) {
    reasons.push(`位置が${node.variations.position.count}パターンに変動`);
  }
  if (node.variations.text.count > 1) {
    reasons.push(`テキストが${node.variations.text.count}パターンに変動`);
  }
  if (node.variations.visibility.count > 1) {
    reasons.push('表示/非表示が変動');
  }
  
  return reasons.join('、');
}

/**
 * 共通のクラスパターンを持つかチェック
 */
function hasCommonClassPattern(nodes: NodeVariation[], pattern: string): boolean {
  const matchingNodes = nodes.filter(n => 
    n.className && n.className.toLowerCase().includes(pattern.toLowerCase())
  );
  
  // 不安定なノードの30%以上が該当パターンを持つ場合
  return matchingNodes.length > nodes.length * 0.3;
}