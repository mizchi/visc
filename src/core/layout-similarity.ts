import { LayoutSummary, SummarizedNode } from './layout-summarizer.js';

export interface SimilarityResult {
  overallSimilarity: number;
  structuralSimilarity: number;
  semanticSimilarity: number;
  accessibilitySimilarity: number;
  details: {
    matchedNodes: number;
    addedNodes: number;
    removedNodes: number;
    movedNodes: number;
    changedNodes: number;
  };
  nodeMatches: NodeMatch[];
}

export interface NodeMatch {
  node1: SummarizedNode;
  node2: SummarizedNode | null;
  similarity: number;
  matchType: 'exact' | 'moved' | 'changed' | 'removed';
  differences?: {
    position?: { deltaX: number; deltaY: number };
    size?: { deltaWidth: number; deltaHeight: number };
    text?: { before: string; after: string };
    accessibility?: string[];
  };
}

/**
 * 2つのレイアウトサマリー間の類似度を計算
 */
export function calculateLayoutSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary
): SimilarityResult {
  const nodeMatches = findNodeMatches(layout1.nodes, layout2.nodes);
  
  // 構造的類似度を計算
  const structuralSimilarity = calculateStructuralSimilarity(
    layout1,
    layout2,
    nodeMatches
  );
  
  // セマンティック類似度を計算
  const semanticSimilarity = calculateSemanticSimilarity(
    layout1,
    layout2,
    nodeMatches
  );
  
  // アクセシビリティ類似度を計算
  const accessibilitySimilarity = calculateAccessibilitySimilarity(
    nodeMatches
  );
  
  // 詳細情報を集計
  const details = aggregateMatchDetails(nodeMatches);
  
  // 全体的な類似度（重み付き平均）
  const overallSimilarity = 
    structuralSimilarity * 0.4 +
    semanticSimilarity * 0.4 +
    accessibilitySimilarity * 0.2;
  
  return {
    overallSimilarity,
    structuralSimilarity,
    semanticSimilarity,
    accessibilitySimilarity,
    details,
    nodeMatches
  };
}

/**
 * ノード間のマッチングを見つける
 */
function findNodeMatches(
  nodes1: SummarizedNode[],
  nodes2: SummarizedNode[]
): NodeMatch[] {
  const matches: NodeMatch[] = [];
  const matched1 = new Set<string>();
  const matched2 = new Set<string>();
  
  // 各ノード1に対して最適なマッチを見つける
  for (const node1 of nodes1) {
    let bestMatch: SummarizedNode | null = null;
    let bestSimilarity = 0;
    
    for (const node2 of nodes2) {
      if (matched2.has(node2.id)) continue;
      
      const similarity = calculateNodeSimilarity(node1, node2);
      if (similarity > bestSimilarity && similarity > 0.3) {
        bestMatch = node2;
        bestSimilarity = similarity;
      }
    }
    
    if (bestMatch) {
      matched1.add(node1.id);
      matched2.add(bestMatch.id);
      const matchType = determineMatchType(node1, bestMatch, bestSimilarity);
      const differences = matchType !== 'exact' ? 
        calculateNodeDifferences(node1, bestMatch) : undefined;
      
      matches.push({
        node1,
        node2: bestMatch,
        similarity: bestSimilarity,
        matchType,
        differences
      });
    }
  }
  
  // マッチしなかったnode1は削除されたノード
  for (const node1 of nodes1) {
    if (!matched1.has(node1.id)) {
      matches.push({
        node1,
        node2: null,
        similarity: 0,
        matchType: 'removed',
        differences: undefined
      });
    }
  }
  
  // マッチしなかったnode2は追加されたノード  
  for (const node2 of nodes2) {
    if (!matched2.has(node2.id)) {
      // 追加されたノードを表現するための特別な処理
      matches.push({
        node1: { ...node2, id: `added_${node2.id}` }, // 区別のためIDを変更
        node2: null,
        similarity: 0,
        matchType: 'removed', // aggregateMatchDetailsで処理
        differences: undefined
      });
    }
  }
  
  return matches;
}

/**
 * 2つのノード間の類似度を計算
 */
function calculateNodeSimilarity(
  node1: SummarizedNode,
  node2: SummarizedNode
): number {
  let similarity = 0;
  let weight = 0;
  
  // タイプとセマンティックタイプの一致（最重要）
  if (node1.type === node2.type) {
    similarity += 0.3;
    weight += 0.3;
  }
  if (node1.semanticType === node2.semanticType) {
    similarity += 0.2;
    weight += 0.2;
  }
  
  // クラス名の類似度
  if (node1.className && node2.className) {
    const classSimilarity = calculateStringSetSimilarity(
      node1.className.split(' '),
      node2.className.split(' ')
    );
    similarity += classSimilarity * 0.15;
    weight += 0.15;
  }
  
  // テキストの類似度
  if (node1.text && node2.text) {
    const textSimilarity = calculateTextSimilarity(node1.text, node2.text);
    similarity += textSimilarity * 0.15;
    weight += 0.15;
  }
  
  // 位置の類似度（より重要に）
  const positionSimilarity = calculatePositionSimilarity(
    node1.position,
    node2.position
  );
  similarity += positionSimilarity * 0.2;
  weight += 0.2;
  
  // アクセシビリティ情報の類似度
  const accessibilitySimilarity = calculateNodeAccessibilitySimilarity(
    node1.accessibility,
    node2.accessibility
  );
  similarity += accessibilitySimilarity * 0.1;
  weight += 0.1;
  
  return weight > 0 ? similarity / weight : 0;
}

/**
 * 文字列セットの類似度を計算（Jaccard係数）
 */
function calculateStringSetSimilarity(set1: string[], set2: string[]): number {
  const s1 = new Set(set1);
  const s2 = new Set(set2);
  
  const intersection = new Set([...s1].filter(x => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * テキストの類似度を計算
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  
  // 文字数の差による減点
  const lengthRatio = Math.min(text1.length, text2.length) / 
                     Math.max(text1.length, text2.length);
  
  // 簡易的なレーベンシュタイン距離の近似
  const maxLen = Math.max(text1.length, text2.length);
  let matches = 0;
  for (let i = 0; i < Math.min(text1.length, text2.length); i++) {
    if (text1[i] === text2[i]) matches++;
  }
  
  return (matches / maxLen) * lengthRatio;
}

/**
 * 位置の類似度を計算
 */
function calculatePositionSimilarity(
  pos1: SummarizedNode['position'],
  pos2: SummarizedNode['position']
): number {
  const deltaX = Math.abs(pos1.x - pos2.x);
  const deltaY = Math.abs(pos1.y - pos2.y);
  const deltaW = Math.abs(pos1.width - pos2.width);
  const deltaH = Math.abs(pos1.height - pos2.height);
  
  // 位置の差分（ピクセル）を類似度に変換
  // 100ピクセル以上の移動で0になるように調整
  const positionScore = Math.max(0, 1 - Math.sqrt(deltaX * deltaX + deltaY * deltaY) / 100);
  const sizeScore = Math.max(0, 1 - (deltaW + deltaH) / 50);
  
  return (positionScore + sizeScore) / 2;
}

/**
 * ノードレベルのアクセシビリティ類似度を計算
 */
function calculateNodeAccessibilitySimilarity(
  acc1: SummarizedNode['accessibility'],
  acc2: SummarizedNode['accessibility']
): number {
  let score = 0;
  let factors = 0;
  
  // ロールの一致
  if (acc1.role === acc2.role) {
    score += 1;
  }
  factors++;
  
  // ラベルの類似度
  if (acc1.label && acc2.label) {
    score += calculateTextSimilarity(acc1.label, acc2.label);
    factors++;
  }
  
  // インタラクティブ性の一致
  if (acc1.interactive === acc2.interactive) {
    score += 1;
  }
  factors++;
  
  // フォーカス可能性の一致
  if (acc1.focusable === acc2.focusable) {
    score += 1;
  }
  factors++;
  
  // 状態の類似度
  if (acc1.state && acc2.state) {
    const stateKeys1 = Object.keys(acc1.state);
    const stateKeys2 = Object.keys(acc2.state);
    const stateSimilarity = calculateStringSetSimilarity(stateKeys1, stateKeys2);
    score += stateSimilarity;
    factors++;
  }
  
  return factors > 0 ? score / factors : 0;
}

/**
 * マッチタイプを判定
 */
function determineMatchType(
  node1: SummarizedNode,
  node2: SummarizedNode,
  similarity: number
): NodeMatch['matchType'] {
  // 位置の差分を確認
  const deltaX = Math.abs(node1.position.x - node2.position.x);
  const deltaY = Math.abs(node1.position.y - node2.position.y);
  const deltaW = Math.abs(node1.position.width - node2.position.width);
  const deltaH = Math.abs(node1.position.height - node2.position.height);
  
  // 完全一致（位置もサイズも同じ、かつ類似度が完全）
  if (similarity >= 0.999 && deltaX < 1 && deltaY < 1 && deltaW < 1 && deltaH < 1) {
    return 'exact';
  }
  
  // 移動（位置が大きく変わっているが、他の属性は似ている）
  if ((deltaX > 50 || deltaY > 50) && similarity > 0.6) {
    return 'moved';
  }
  
  return 'changed';
}

/**
 * ノード間の差分を計算
 */
function calculateNodeDifferences(
  node1: SummarizedNode,
  node2: SummarizedNode
): NodeMatch['differences'] {
  const differences: NodeMatch['differences'] = {};
  
  // 位置の差分
  const deltaX = node2.position.x - node1.position.x;
  const deltaY = node2.position.y - node1.position.y;
  if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
    differences.position = { deltaX, deltaY };
  }
  
  // サイズの差分
  const deltaWidth = node2.position.width - node1.position.width;
  const deltaHeight = node2.position.height - node1.position.height;
  if (Math.abs(deltaWidth) > 5 || Math.abs(deltaHeight) > 5) {
    differences.size = { deltaWidth, deltaHeight };
  }
  
  // テキストの差分
  if (node1.text !== node2.text) {
    differences.text = {
      before: node1.text || '',
      after: node2.text || ''
    };
  }
  
  // アクセシビリティの差分
  const accDiffs: string[] = [];
  if (node1.accessibility.role !== node2.accessibility.role) {
    accDiffs.push(`role: ${node1.accessibility.role} → ${node2.accessibility.role}`);
  }
  if (node1.accessibility.label !== node2.accessibility.label) {
    accDiffs.push(`label changed`);
  }
  if (node1.accessibility.interactive !== node2.accessibility.interactive) {
    accDiffs.push(`interactive: ${node1.accessibility.interactive} → ${node2.accessibility.interactive}`);
  }
  if (node1.accessibility.focusable !== node2.accessibility.focusable) {
    accDiffs.push(`focusable: ${node1.accessibility.focusable} → ${node2.accessibility.focusable}`);
  }
  
  // 状態の差分
  const state1 = node1.accessibility.state || {};
  const state2 = node2.accessibility.state || {};
  const allStateKeys = new Set([...Object.keys(state1), ...Object.keys(state2)]);
  for (const key of allStateKeys) {
    if (state1[key] !== state2[key]) {
      accDiffs.push(`state.${key}: ${state1[key]} → ${state2[key]}`);
    }
  }
  
  if (accDiffs.length > 0) {
    differences.accessibility = accDiffs;
  }
  
  return Object.keys(differences).length > 0 ? differences : undefined;
}

/**
 * 構造的類似度を計算
 */
function calculateStructuralSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary,
  nodeMatches: NodeMatch[]
): number {
  // グループの類似度
  const groupSimilarity = calculateGroupSimilarity(layout1.groups, layout2.groups);
  
  // ノード数の類似度
  const nodeCountRatio = layout1.nodes.length === 0 && layout2.nodes.length === 0 ? 1 :
                        Math.min(layout1.nodes.length, layout2.nodes.length) /
                        Math.max(layout1.nodes.length, layout2.nodes.length);
  
  // 位置関係の保持率
  const positionPreservation = calculatePositionPreservation(nodeMatches);
  
  return (groupSimilarity + nodeCountRatio + positionPreservation) / 3;
}

/**
 * グループの類似度を計算
 */
function calculateGroupSimilarity(
  groups1: LayoutSummary['groups'],
  groups2: LayoutSummary['groups']
): number {
  if (groups1.length === 0 && groups2.length === 0) return 1;
  if (groups1.length === 0 || groups2.length === 0) return 0;
  
  const typeCount1 = new Map<string, number>();
  const typeCount2 = new Map<string, number>();
  
  for (const g of groups1) {
    typeCount1.set(g.type, (typeCount1.get(g.type) || 0) + 1);
  }
  for (const g of groups2) {
    typeCount2.set(g.type, (typeCount2.get(g.type) || 0) + 1);
  }
  
  let similarity = 0;
  const allTypes = new Set([...typeCount1.keys(), ...typeCount2.keys()]);
  
  for (const type of allTypes) {
    const count1 = typeCount1.get(type) || 0;
    const count2 = typeCount2.get(type) || 0;
    similarity += Math.min(count1, count2) / Math.max(count1, count2);
  }
  
  return similarity / allTypes.size;
}

/**
 * 位置関係の保持率を計算
 */
function calculatePositionPreservation(nodeMatches: NodeMatch[]): number {
  const exact = nodeMatches.filter(m => m.matchType === 'exact');
  
  if (nodeMatches.length === 0) return 1;
  // 完全一致のノードのみを位置関係保持としてカウント
  return exact.length / nodeMatches.length;
}

/**
 * セマンティック類似度を計算
 */
function calculateSemanticSimilarity(
  layout1: LayoutSummary,
  layout2: LayoutSummary,
  nodeMatches: NodeMatch[]
): number {
  // セマンティックタイプの分布を比較
  const dist1 = layout1.statistics.bySemanticType;
  const dist2 = layout2.statistics.bySemanticType;
  
  const allTypes = new Set([...Object.keys(dist1), ...Object.keys(dist2)]);
  let similarity = 0;
  
  for (const type of allTypes) {
    const count1 = dist1[type] || 0;
    const count2 = dist2[type] || 0;
    const maxCount = Math.max(count1, count2);
    if (maxCount > 0) {
      similarity += 1 - Math.abs(count1 - count2) / maxCount;
    }
  }
  
  return allTypes.size > 0 ? similarity / allTypes.size : 1;
}

/**
 * アクセシビリティ類似度を計算
 */
function calculateAccessibilitySimilarity(nodeMatches: NodeMatch[]): number {
  if (nodeMatches.length === 0) return 1;
  
  let totalSimilarity = 0;
  let count = 0;
  
  for (const match of nodeMatches) {
    if (match.node2) {
      const similarity = calculateNodeAccessibilitySimilarity(
        match.node1.accessibility,
        match.node2.accessibility
      );
      totalSimilarity += similarity;
      count++;
    }
  }
  
  return count > 0 ? totalSimilarity / count : 0;
}

/**
 * マッチの詳細を集計
 */
function aggregateMatchDetails(
  nodeMatches: NodeMatch[]
): SimilarityResult['details'] {
  const details = {
    matchedNodes: 0,
    addedNodes: 0,
    removedNodes: 0,
    movedNodes: 0,
    changedNodes: 0
  };
  
  for (const match of nodeMatches) {
    switch (match.matchType) {
      case 'exact':
        details.matchedNodes++;
        break;
      case 'moved':
        details.movedNodes++;
        break;
      case 'changed':
        details.changedNodes++;
        break;
      case 'removed':
        if (match.node2 === null) {
          // IDプレフィックスで追加か削除かを判断
          if (match.node1.id.startsWith('added_')) {
            details.addedNodes++;
          } else {
            details.removedNodes++;
          }
        }
        break;
    }
  }
  
  return details;
}

/**
 * 類似度の詳細レポートを生成
 */
export function generateSimilarityReport(result: SimilarityResult): string {
  const report: string[] = [];
  
  report.push('# レイアウト類似度レポート\n');
  report.push(`## 全体的な類似度: ${(result.overallSimilarity * 100).toFixed(1)}%\n`);
  report.push(`- 構造的類似度: ${(result.structuralSimilarity * 100).toFixed(1)}%`);
  report.push(`- セマンティック類似度: ${(result.semanticSimilarity * 100).toFixed(1)}%`);
  report.push(`- アクセシビリティ類似度: ${(result.accessibilitySimilarity * 100).toFixed(1)}%\n`);
  
  report.push('## ノードの変更\n');
  report.push(`- 完全一致: ${result.details.matchedNodes}個`);
  report.push(`- 移動: ${result.details.movedNodes}個`);
  report.push(`- 変更: ${result.details.changedNodes}個`);
  report.push(`- 追加: ${result.details.addedNodes}個`);
  report.push(`- 削除: ${result.details.removedNodes}個\n`);
  
  // 重要な変更を表示
  const significantChanges = result.nodeMatches
    .filter(m => m.matchType !== 'exact' && m.node1.importance > 50)
    .sort((a, b) => b.node1.importance - a.node1.importance)
    .slice(0, 10);
  
  if (significantChanges.length > 0) {
    report.push('## 重要な変更（上位10件）\n');
    for (const match of significantChanges) {
      report.push(`### ${match.node1.type} (${match.node1.semanticType})`);
      report.push(`- 重要度: ${match.node1.importance}`);
      report.push(`- 変更タイプ: ${match.matchType}`);
      
      if (match.differences) {
        if (match.differences.position) {
          report.push(`- 位置変更: X${match.differences.position.deltaX > 0 ? '+' : ''}${match.differences.position.deltaX}, Y${match.differences.position.deltaY > 0 ? '+' : ''}${match.differences.position.deltaY}`);
        }
        if (match.differences.text) {
          report.push(`- テキスト変更: "${match.differences.text.before}" → "${match.differences.text.after}"`);
        }
      }
      report.push('');
    }
  }
  
  return report.join('\n');
}