/**
 * V2 Text Similarity - テキストの近似度計算
 */

import { LayoutSummary, SummarizedNode, TextSimilarityDetails } from '../types/index.js';

/**
 * テキストの類似度を計算
 */
export function calculateTextSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary
): { similarity: number; details: TextSimilarityDetails } {
  const matches = findNodeMatches(layout1.nodes, layout2.nodes);
  
  let exactMatches = 0;
  let partialMatches = 0;
  let totalTexts = 0;
  let totalLevenshteinDistance = 0;
  
  for (const match of matches) {
    if (match.node1.text || match.node2?.text) {
      totalTexts++;
      
      const text1 = match.node1.text || '';
      const text2 = match.node2?.text || '';
      
      if (text1 === text2 && text1 !== '') {
        exactMatches++;
      } else if (text1 && text2) {
        const similarity = calculateTextSimilarityScore(text1, text2);
        if (similarity > 0.7) {
          partialMatches++;
        }
        totalLevenshteinDistance += levenshteinDistance(text1, text2);
      }
    }
  }
  
  const avgLevenshteinDistance = totalTexts > 0 ? totalLevenshteinDistance / totalTexts : 0;
  
  // 類似度を計算
  const exactMatchRatio = totalTexts > 0 ? exactMatches / totalTexts : 1;
  const partialMatchRatio = totalTexts > 0 ? (exactMatches + partialMatches) / totalTexts : 1;
  const distanceScore = Math.max(0, 1 - avgLevenshteinDistance / 50); // 50文字以上の差で0
  
  const similarity = (
    exactMatchRatio * 0.5 +
    partialMatchRatio * 0.3 +
    distanceScore * 0.2
  );
  
  return {
    similarity,
    details: {
      exactMatches,
      partialMatches,
      totalTexts,
      averageLevenshteinDistance: avgLevenshteinDistance
    }
  };
}

/**
 * テキストの類似度スコアを計算
 */
function calculateTextSimilarityScore(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  
  // 正規化
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  
  if (normalized1 === normalized2) return 0.95;
  
  // 長さの比率
  const lengthRatio = Math.min(text1.length, text2.length) / 
                     Math.max(text1.length, text2.length);
  
  // 共通部分文字列の比率
  const commonSubstringRatio = longestCommonSubstring(text1, text2).length / 
                              Math.max(text1.length, text2.length);
  
  // レーベンシュタイン距離に基づくスコア
  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  const distanceScore = 1 - (distance / maxLength);
  
  return (lengthRatio * 0.3 + commonSubstringRatio * 0.3 + distanceScore * 0.4);
}

/**
 * テキストを正規化
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

/**
 * レーベンシュタイン距離を計算
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // 置換
          matrix[i][j - 1] + 1,     // 挿入
          matrix[i - 1][j] + 1      // 削除
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * 最長共通部分文字列を見つける
 */
function longestCommonSubstring(str1: string, str2: string): string {
  const matrix: number[][] = Array(str1.length + 1)
    .fill(null)
    .map(() => Array(str2.length + 1).fill(0));
  
  let maxLength = 0;
  let endPos = 0;
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1] + 1;
        if (matrix[i][j] > maxLength) {
          maxLength = matrix[i][j];
          endPos = i;
        }
      }
    }
  }
  
  return str1.substring(endPos - maxLength, endPos);
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
  
  // テキストの類似度も考慮
  if (node1.text && node2.text) {
    const textSimilarity = calculateTextSimilarityScore(node1.text, node2.text);
    score += textSimilarity * 0.2;
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