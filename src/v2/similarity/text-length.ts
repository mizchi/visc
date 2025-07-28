/**
 * V2 Text Length Similarity - テキスト長の近似度計算
 */

import { LayoutSummary, SummarizedNode, TextLengthSimilarityDetails } from '../types/index.js';

/**
 * テキスト長の類似度を計算
 */
export function calculateTextLengthSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary
): { similarity: number; details: TextLengthSimilarityDetails } {
  // 各レイアウトの総テキスト長を計算
  const totalLength1 = calculateTotalTextLength(layout1.nodes);
  const totalLength2 = calculateTotalTextLength(layout2.nodes);
  
  // ノードごとのテキスト長の差を計算
  const matches = findNodeMatches(layout1.nodes, layout2.nodes);
  let totalLengthDifference = 0;
  let matchedNodesWithText = 0;
  
  for (const match of matches) {
    if (match.node1.text || match.node2?.text) {
      const len1 = match.node1.text?.length || 0;
      const len2 = match.node2?.text?.length || 0;
      totalLengthDifference += Math.abs(len1 - len2);
      matchedNodesWithText++;
    }
  }
  
  const avgLengthDifference = matchedNodesWithText > 0 ? 
    totalLengthDifference / matchedNodesWithText : 0;
  
  // 長さの比率（0〜1）
  const lengthRatio = Math.min(totalLength1, totalLength2) / 
                     Math.max(totalLength1, totalLength2) || 1;
  
  // 平均差分に基づくスコア（20文字以上の差で0になる）
  const differenceScore = Math.max(0, 1 - avgLengthDifference / 20);
  
  // 全体的な類似度
  const similarity = (lengthRatio * 0.6 + differenceScore * 0.4);
  
  return {
    similarity,
    details: {
      totalLength1,
      totalLength2,
      lengthRatio,
      averageLengthDifference: avgLengthDifference
    }
  };
}

/**
 * ノードの総テキスト長を計算
 */
function calculateTotalTextLength(nodes: SummarizedNode[]): number {
  return nodes.reduce((total, node) => {
    return total + (node.text?.length || 0);
  }, 0);
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
  
  if (node1.tagName === node2.tagName) {
    score += 0.3;
  }
  
  if (node1.semanticType === node2.semanticType) {
    score += 0.2;
  }
  
  // テキスト長の類似度も考慮
  if (node1.text || node2.text) {
    const len1 = node1.text?.length || 0;
    const len2 = node2.text?.length || 0;
    const lengthRatio = Math.min(len1, len2) / Math.max(len1, len2) || 0;
    score += lengthRatio * 0.2;
  }
  
  const distance = Math.sqrt(
    Math.pow(node1.position.x - node2.position.x, 2) +
    Math.pow(node1.position.y - node2.position.y, 2)
  );
  const maxDistance = 200;
  const positionScore = Math.max(0, 1 - distance / maxDistance);
  score += positionScore * 0.3;
  
  return score;
}