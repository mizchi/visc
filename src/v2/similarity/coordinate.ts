/**
 * V2 Coordinate Similarity - レイアウトの座標の近似度計算
 */

import { LayoutSummary, SummarizedNode, CoordinateSimilarityDetails } from '../types/index.js';

/**
 * 座標の類似度を計算
 */
export function calculateCoordinateSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary
): { similarity: number; details: CoordinateSimilarityDetails } {
  const matches = findNodeMatches(layout1.nodes, layout2.nodes);
  
  let totalPositionDelta = { x: 0, y: 0 };
  let totalSizeDelta = { width: 0, height: 0 };
  let matchedCount = 0;
  
  for (const match of matches) {
    if (match.node2) {
      const posDelta = calculatePositionDelta(match.node1.position, match.node2.position);
      const sizeDelta = calculateSizeDelta(match.node1.position, match.node2.position);
      
      totalPositionDelta.x += Math.abs(posDelta.x);
      totalPositionDelta.y += Math.abs(posDelta.y);
      totalSizeDelta.width += Math.abs(sizeDelta.width);
      totalSizeDelta.height += Math.abs(sizeDelta.height);
      matchedCount++;
    }
  }
  
  const avgPositionDelta = matchedCount > 0 ? {
    x: totalPositionDelta.x / matchedCount,
    y: totalPositionDelta.y / matchedCount
  } : { x: 0, y: 0 };
  
  const avgSizeDelta = matchedCount > 0 ? {
    width: totalSizeDelta.width / matchedCount,
    height: totalSizeDelta.height / matchedCount
  } : { width: 0, height: 0 };
  
  // 類似度を計算（位置と大きさの変化が少ないほど高い）
  const positionSimilarity = calculatePositionSimilarityScore(avgPositionDelta);
  const sizeSimilarity = calculateSizeSimilarityScore(avgSizeDelta);
  const matchRatio = matchedCount / Math.max(layout1.nodes.length, layout2.nodes.length);
  
  const similarity = (positionSimilarity * 0.5 + sizeSimilarity * 0.3 + matchRatio * 0.2);
  
  return {
    similarity,
    details: {
      matchedNodes: matchedCount,
      totalNodes: Math.max(layout1.nodes.length, layout2.nodes.length),
      averagePositionDelta: avgPositionDelta,
      averageSizeDelta: avgSizeDelta
    }
  };
}

/**
 * ノードのマッチングを見つける
 */
interface NodeMatch {
  node1: SummarizedNode;
  node2: SummarizedNode | null;
}

function findNodeMatches(nodes1: SummarizedNode[], nodes2: SummarizedNode[]): NodeMatch[] {
  const matches: NodeMatch[] = [];
  const matched2 = new Set<string>();
  
  for (const node1 of nodes1) {
    let bestMatch: SummarizedNode | null = null;
    let bestScore = 0;
    
    for (const node2 of nodes2) {
      if (matched2.has(node2.id)) continue;
      
      const score = calculateNodeMatchScore(node1, node2);
      if (score > bestScore && score > 0.3) {
        bestMatch = node2;
        bestScore = score;
      }
    }
    
    if (bestMatch) {
      matched2.add(bestMatch.id);
      matches.push({ node1, node2: bestMatch });
    } else {
      matches.push({ node1, node2: null });
    }
  }
  
  return matches;
}

/**
 * ノードのマッチスコアを計算
 */
function calculateNodeMatchScore(node1: SummarizedNode, node2: SummarizedNode): number {
  let score = 0;
  
  // タグ名が一致
  if (node1.tagName === node2.tagName) {
    score += 0.3;
  }
  
  // セマンティックタイプが一致
  if (node1.semanticType === node2.semanticType) {
    score += 0.2;
  }
  
  // クラス名の類似度
  if (node1.className && node2.className) {
    const classes1 = new Set(node1.className.split(' '));
    const classes2 = new Set(node2.className.split(' '));
    const intersection = new Set([...classes1].filter(x => classes2.has(x)));
    const union = new Set([...classes1, ...classes2]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;
    score += jaccard * 0.2;
  }
  
  // 位置の近さ
  const distance = Math.sqrt(
    Math.pow(node1.position.x - node2.position.x, 2) +
    Math.pow(node1.position.y - node2.position.y, 2)
  );
  const maxDistance = 200; // 200px以上離れていたら別の要素とみなす
  const positionScore = Math.max(0, 1 - distance / maxDistance);
  score += positionScore * 0.3;
  
  return score;
}

/**
 * 位置の差分を計算
 */
function calculatePositionDelta(
  pos1: SummarizedNode['position'],
  pos2: SummarizedNode['position']
): { x: number; y: number } {
  return {
    x: pos2.x - pos1.x,
    y: pos2.y - pos1.y
  };
}

/**
 * サイズの差分を計算
 */
function calculateSizeDelta(
  pos1: SummarizedNode['position'],
  pos2: SummarizedNode['position']
): { width: number; height: number } {
  return {
    width: pos2.width - pos1.width,
    height: pos2.height - pos1.height
  };
}

/**
 * 位置の類似度スコアを計算
 */
function calculatePositionSimilarityScore(delta: { x: number; y: number }): number {
  // 平均移動距離が大きいほどスコアが低い
  const avgDistance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
  // 50px以上の移動で0になるように調整
  return Math.max(0, 1 - avgDistance / 50);
}

/**
 * サイズの類似度スコアを計算
 */
function calculateSizeSimilarityScore(delta: { width: number; height: number }): number {
  // 平均サイズ変化が大きいほどスコアが低い
  const avgChange = Math.sqrt(delta.width * delta.width + delta.height * delta.height);
  // 30px以上の変化で0になるように調整
  return Math.max(0, 1 - avgChange / 30);
}