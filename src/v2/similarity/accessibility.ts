/**
 * V2 Accessibility Similarity - アクセシビリティの近似度計算
 */

import { LayoutSummary, SummarizedNode, AccessibilitySimilarityDetails } from '../types/index.js';

/**
 * アクセシビリティの類似度を計算
 */
export function calculateAccessibilitySimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary
): { similarity: number; details: AccessibilitySimilarityDetails } {
  const matches = findNodeMatches(layout1.nodes, layout2.nodes);
  
  let matchedRoles = 0;
  let totalRoles = 0;
  let matchedLabels = 0;
  let totalLabels = 0;
  let matchedStates = 0;
  let totalStates = 0;
  
  for (const match of matches) {
    if (match.node2) {
      // ロールの比較
      if (match.node1.accessibility.role || match.node2.accessibility.role) {
        totalRoles++;
        if (match.node1.accessibility.role === match.node2.accessibility.role) {
          matchedRoles++;
        }
      }
      
      // ラベルの比較
      if (match.node1.accessibility.label || match.node2.accessibility.label) {
        totalLabels++;
        if (match.node1.accessibility.label === match.node2.accessibility.label) {
          matchedLabels++;
        }
      }
      
      // 状態の比較
      const states1 = Object.keys(match.node1.accessibility.state || {});
      const states2 = Object.keys(match.node2.accessibility.state || {});
      const allStates = new Set([...states1, ...states2]);
      
      for (const state of allStates) {
        totalStates++;
        const value1 = match.node1.accessibility.state?.[state];
        const value2 = match.node2.accessibility.state?.[state];
        if (value1 === value2) {
          matchedStates++;
        }
      }
    }
  }
  
  // 各要素の類似度を計算
  const roleSimilarity = totalRoles > 0 ? matchedRoles / totalRoles : 1;
  const labelSimilarity = totalLabels > 0 ? matchedLabels / totalLabels : 1;
  const stateSimilarity = totalStates > 0 ? matchedStates / totalStates : 1;
  
  // 全体的な類似度（重み付き平均）
  const similarity = (
    roleSimilarity * 0.4 +
    labelSimilarity * 0.4 +
    stateSimilarity * 0.2
  );
  
  return {
    similarity,
    details: {
      matchedRoles,
      totalRoles,
      matchedLabels,
      totalLabels,
      matchedStates,
      totalStates
    }
  };
}

/**
 * ノードのマッチングを見つける（座標モジュールと同じロジック）
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
  
  // ロールが一致
  if (node1.accessibility.role === node2.accessibility.role && node1.accessibility.role) {
    score += 0.2;
  }
  
  // 位置の近さ
  const distance = Math.sqrt(
    Math.pow(node1.position.x - node2.position.x, 2) +
    Math.pow(node1.position.y - node2.position.y, 2)
  );
  const maxDistance = 200;
  const positionScore = Math.max(0, 1 - distance / maxDistance);
  score += positionScore * 0.3;
  
  return score;
}