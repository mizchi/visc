import { SemanticSummary, SummaryNode, compareSummaries } from '../layout/semantic-summary.js';

export interface SummaryStabilityAnalysis {
  overallStability: number;
  nodeStability: number;
  groupStability: number;
  recommendations: {
    toleranceThreshold: number;
    ignoreClasses: string[];
    ignoreTypes: string[];
    confidenceLevel: number;
  };
  unstableNodes: Array<{
    type: string;
    className?: string;
    semanticType: string;
    variationScore: number;
    variations: string[];
  }>;
  statistics: {
    totalNodes: number;
    stableNodes: number;
    unstableNodes: number;
    avgImportance: number;
    stabilityByType: Record<string, number>;
  };
}

/**
 * 要約ベースの安定性分析
 */
export function analyzeSummaryStability(
  iterations: Array<{
    iteration: number;
    summary: SemanticSummary;
  }>
): SummaryStabilityAnalysis {
  if (iterations.length < 2) {
    throw new Error('少なくとも2回の反復が必要です');
  }

  // ノードの安定性を追跡
  const nodeVariations = new Map<string, Set<string>>();
  const nodeAppearances = new Map<string, number>();
  const nodeImportances = new Map<string, number[]>();
  const typeStability = new Map<string, { stable: number; total: number }>();

  // 各反復間でノードを比較
  for (let i = 0; i < iterations.length - 1; i++) {
    const current = iterations[i].summary;
    const next = iterations[i + 1].summary;
    
    const comparison = compareSummaries(current, next);
    
    // ノードごとの変動を記録
    for (const node of current.nodes) {
      const key = getNodeKey(node);
      
      if (!nodeVariations.has(key)) {
        nodeVariations.set(key, new Set());
        nodeAppearances.set(key, 0);
        nodeImportances.set(key, []);
      }
      
      nodeAppearances.set(key, (nodeAppearances.get(key) || 0) + 1);
      nodeImportances.get(key)!.push(node.importance);
      
      // 位置の変動を記録
      const variation = `${Math.round(node.position.x)},${Math.round(node.position.y)}`;
      nodeVariations.get(key)!.add(variation);
      
      // タイプ別の安定性を追跡
      if (!typeStability.has(node.semanticType)) {
        typeStability.set(node.semanticType, { stable: 0, total: 0 });
      }
      const typeStats = typeStability.get(node.semanticType)!;
      typeStats.total++;
      
      // 次の反復で同じノードが存在するか確認
      const nextNode = findMatchingNode(node, next.nodes);
      if (nextNode && isNodeStable(node, nextNode)) {
        typeStats.stable++;
      }
    }
  }

  // 不安定なノードを特定
  const unstableNodes: SummaryStabilityAnalysis['unstableNodes'] = [];
  let totalImportance = 0;
  let stableNodeCount = 0;

  for (const [key, variations] of nodeVariations.entries()) {
    const appearances = nodeAppearances.get(key) || 0;
    const importances = nodeImportances.get(key) || [];
    const avgImportance = importances.reduce((a, b) => a + b, 0) / importances.length;
    totalImportance += avgImportance;
    
    // 変動スコアを計算（出現率と位置の変動を考慮）
    const appearanceRate = appearances / iterations.length;
    const positionVariations = variations.size;
    const variationScore = (1 - appearanceRate) * 50 + (positionVariations - 1) * 10;
    
    if (variationScore > 10 || appearanceRate < 0.8) {
      const [type, className] = key.split('::');
      const semanticType = getSemanticTypeFromKey(type);
      
      unstableNodes.push({
        type,
        className: className || undefined,
        semanticType,
        variationScore,
        variations: Array.from(variations)
      });
    } else {
      stableNodeCount++;
    }
  }

  // タイプ別の安定性を計算
  const stabilityByType: Record<string, number> = {};
  for (const [type, stats] of typeStability.entries()) {
    stabilityByType[type] = stats.total > 0 ? (stats.stable / stats.total) * 100 : 100;
  }

  // 全体的な安定性スコアを計算
  const totalNodes = nodeVariations.size;
  const nodeStability = totalNodes > 0 ? (stableNodeCount / totalNodes) * 100 : 100;
  
  // グループの安定性を評価
  const groupStability = calculateGroupStability(iterations);
  
  // 総合的な安定性（ノードとグループの加重平均）
  const overallStability = nodeStability * 0.7 + groupStability * 0.3;

  // 推奨設定を生成
  const recommendations = generateRecommendations(unstableNodes, overallStability, iterations.length);

  return {
    overallStability,
    nodeStability,
    groupStability,
    recommendations,
    unstableNodes: unstableNodes.sort((a, b) => b.variationScore - a.variationScore),
    statistics: {
      totalNodes,
      stableNodes: stableNodeCount,
      unstableNodes: unstableNodes.length,
      avgImportance: totalNodes > 0 ? totalImportance / totalNodes : 0,
      stabilityByType
    }
  };
}

/**
 * ノードの一意キーを生成
 */
function getNodeKey(node: SummaryNode): string {
  const classStr = typeof node.className === 'string' ? node.className : '';
  const className = classStr.split(' ')[0] || '';
  const text = node.text?.substring(0, 20) || '';
  return `${node.type}::${className}::${text}`;
}

/**
 * セマンティックタイプを取得
 */
function getSemanticTypeFromKey(type: string): string {
  const tag = type.toLowerCase();
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (['nav', 'menu'].includes(tag)) return 'navigation';
  if (['button', 'a', 'input'].includes(tag)) return 'interactive';
  if (['img', 'svg', 'video'].includes(tag)) return 'media';
  return 'content';
}

/**
 * マッチするノードを検索
 */
function findMatchingNode(node: SummaryNode, nodes: SummaryNode[]): SummaryNode | undefined {
  const key = getNodeKey(node);
  return nodes.find(n => getNodeKey(n) === key);
}

/**
 * ノードが安定しているか判定
 */
function isNodeStable(node1: SummaryNode, node2: SummaryNode, threshold: number = 10): boolean {
  const positionDiff = 
    Math.abs(node1.position.x - node2.position.x) +
    Math.abs(node1.position.y - node2.position.y);
  
  const sizeDiff = 
    Math.abs(node1.position.width - node2.position.width) +
    Math.abs(node1.position.height - node2.position.height);
  
  return positionDiff < threshold && sizeDiff < threshold;
}

/**
 * グループの安定性を計算
 */
function calculateGroupStability(iterations: Array<{ summary: SemanticSummary }>): number {
  if (iterations.length < 2) return 100;
  
  let totalComparisons = 0;
  let stableGroups = 0;
  
  for (let i = 0; i < iterations.length - 1; i++) {
    const currentGroups = iterations[i].summary.groups;
    const nextGroups = iterations[i + 1].summary.groups;
    
    for (const group of currentGroups) {
      totalComparisons++;
      
      // 同じタイプで近い位置のグループを探す
      const matchingGroup = nextGroups.find(g => 
        g.type === group.type &&
        Math.abs(g.bounds.x - group.bounds.x) < 50 &&
        Math.abs(g.bounds.y - group.bounds.y) < 50
      );
      
      if (matchingGroup) {
        stableGroups++;
      }
    }
  }
  
  return totalComparisons > 0 ? (stableGroups / totalComparisons) * 100 : 100;
}

/**
 * 推奨設定を生成
 */
function generateRecommendations(
  unstableNodes: SummaryStabilityAnalysis['unstableNodes'],
  overallStability: number,
  iterations: number
): SummaryStabilityAnalysis['recommendations'] {
  // 許容閾値の推奨
  let toleranceThreshold = 5;
  if (overallStability < 90) toleranceThreshold = 10;
  if (overallStability < 80) toleranceThreshold = 20;
  if (overallStability < 70) toleranceThreshold = 30;
  
  // 無視すべきクラスとタイプ
  const ignoreClasses = new Set<string>();
  const ignoreTypes = new Set<string>();
  
  for (const node of unstableNodes) {
    if (node.variationScore > 50) {
      if (node.className) {
        ignoreClasses.add(node.className);
      }
      if (node.semanticType === 'media' || node.type === 'img') {
        ignoreTypes.add(node.type);
      }
    }
  }
  
  // 信頼度レベル
  const confidenceLevel = Math.min(iterations / 10, 1);
  
  return {
    toleranceThreshold,
    ignoreClasses: Array.from(ignoreClasses),
    ignoreTypes: Array.from(ignoreTypes),
    confidenceLevel
  };
}