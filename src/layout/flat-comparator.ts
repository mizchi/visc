/**
 * フラットリスト化されたビジュアルノードグループの比較エンジン
 * 最近傍マッチングアルゴリズムを使用
 */

import type { 
  VisualTreeAnalysis, 
  VisualNodeGroup, 
  VisualNode,
  BoundingRect 
} from '../types.js';

export interface FlattenedGroup {
  id: string;
  type: string;
  label: string;
  bounds: BoundingRect;
  importance: number;
  elementCount: number; // 含まれる要素数
  path: string[]; // 親グループのパス
  depth: number;
}

export interface GroupMatch {
  baselineGroup: FlattenedGroup;
  currentGroup: FlattenedGroup;
  distance: number; // マッチングの距離（0が完全一致）
  similarity: number; // 類似度（0-100）
}

export interface FlatComparisonResult {
  matches: GroupMatch[];
  unmatchedBaseline: FlattenedGroup[]; // ベースラインにのみ存在
  unmatchedCurrent: FlattenedGroup[]; // 現在のレイアウトにのみ存在
  totalSimilarity: number; // 全体の類似度（0-100）
  statistics: {
    totalBaselineGroups: number;
    totalCurrentGroups: number;
    matchedGroups: number;
    unmatchedGroups: number;
    averageDistance: number;
  };
}

/**
 * ビジュアルノードグループをフラットリストに展開
 */
export function flattenVisualNodeGroups(
  groups: VisualNodeGroup[],
  parentPath: string[] = []
): FlattenedGroup[] {
  const flattened: FlattenedGroup[] = [];
  
  function traverse(group: VisualNodeGroup, path: string[], depth: number) {
    // グループのIDを生成（位置とタイプから）
    const id = `${group.type}_${Math.round(group.bounds.x)}_${Math.round(group.bounds.y)}`;
    
    // 要素数をカウント
    let elementCount = 0;
    group.children.forEach(child => {
      if (!('type' in child)) {
        // VisualNode
        elementCount++;
      }
    });
    
    // フラット化されたグループを追加
    flattened.push({
      id,
      type: group.type,
      label: group.label,
      bounds: { ...group.bounds },
      importance: group.importance || 0,
      elementCount,
      path: [...path],
      depth
    });
    
    // 子グループを再帰的に処理
    const newPath = [...path, `${group.type}:${group.label}`];
    group.children.forEach(child => {
      if ('type' in child && 'bounds' in child) {
        traverse(child as VisualNodeGroup, newPath, depth + 1);
      }
    });
  }
  
  groups.forEach(group => traverse(group, parentPath, 0));
  return flattened;
}

/**
 * 2つのグループ間の距離を計算
 * 位置、サイズ、タイプ、重要度を考慮
 */
function calculateGroupDistance(
  group1: FlattenedGroup,
  group2: FlattenedGroup,
  weights: {
    position: number;
    size: number;
    type: number;
    importance: number;
  } = { position: 0.4, size: 0.2, type: 0.3, importance: 0.1 }
): number {
  let distance = 0;
  
  // 位置の距離（正規化）
  const centerX1 = group1.bounds.x + group1.bounds.width / 2;
  const centerY1 = group1.bounds.y + group1.bounds.height / 2;
  const centerX2 = group2.bounds.x + group2.bounds.width / 2;
  const centerY2 = group2.bounds.y + group2.bounds.height / 2;
  
  const positionDistance = Math.hypot(centerX2 - centerX1, centerY2 - centerY1);
  const maxDistance = Math.hypot(1920, 1080); // 一般的な画面サイズを基準
  distance += (positionDistance / maxDistance) * weights.position;
  
  // サイズの差（相対的）
  const area1 = group1.bounds.width * group1.bounds.height;
  const area2 = group2.bounds.width * group2.bounds.height;
  const sizeRatio = Math.min(area1, area2) / Math.max(area1, area2);
  distance += (1 - sizeRatio) * weights.size;
  
  // タイプの違い
  if (group1.type !== group2.type) {
    distance += weights.type;
  }
  
  // 重要度の差
  const importanceDiff = Math.abs(group1.importance - group2.importance) / 100;
  distance += importanceDiff * weights.importance;
  
  return distance;
}

/**
 * 最近傍マッチングアルゴリズム
 * 各グループを最も近いグループとマッチング
 */
function findBestMatches(
  baselineGroups: FlattenedGroup[],
  currentGroups: FlattenedGroup[],
  maxDistance: number = 0.5
): { matches: GroupMatch[], unmatchedBaseline: Set<number>, unmatchedCurrent: Set<number> } {
  const matches: GroupMatch[] = [];
  const usedBaseline = new Set<number>();
  const usedCurrent = new Set<number>();
  
  // 距離行列を計算
  const distances: { baseline: number; current: number; distance: number }[] = [];
  
  baselineGroups.forEach((baselineGroup, baselineIdx) => {
    currentGroups.forEach((currentGroup, currentIdx) => {
      const distance = calculateGroupDistance(baselineGroup, currentGroup);
      if (distance <= maxDistance) {
        distances.push({ baseline: baselineIdx, current: currentIdx, distance });
      }
    });
  });
  
  // 距離でソート（最も近いものから）
  distances.sort((a, b) => a.distance - b.distance);
  
  // 貪欲法でマッチング
  for (const { baseline, current, distance } of distances) {
    if (!usedBaseline.has(baseline) && !usedCurrent.has(current)) {
      matches.push({
        baselineGroup: baselineGroups[baseline],
        currentGroup: currentGroups[current],
        distance,
        similarity: Math.max(0, (1 - distance) * 100)
      });
      usedBaseline.add(baseline);
      usedCurrent.add(current);
    }
  }
  
  // 未マッチのインデックスを収集
  const unmatchedBaseline = new Set<number>();
  const unmatchedCurrent = new Set<number>();
  
  baselineGroups.forEach((_, idx) => {
    if (!usedBaseline.has(idx)) {
      unmatchedBaseline.add(idx);
    }
  });
  
  currentGroups.forEach((_, idx) => {
    if (!usedCurrent.has(idx)) {
      unmatchedCurrent.add(idx);
    }
  });
  
  return { matches, unmatchedBaseline, unmatchedCurrent };
}

/**
 * フラットリスト化されたビジュアルノードグループを比較
 */
export function compareFlattenedGroups(
  baseline: VisualTreeAnalysis,
  current: VisualTreeAnalysis,
  options: {
    maxMatchDistance?: number;
    weights?: {
      position: number;
      size: number;
      type: number;
      importance: number;
    };
  } = {}
): FlatComparisonResult {
  const { maxMatchDistance = 0.5, weights } = options;
  
  // ビジュアルノードグループが存在しない場合
  if (!baseline.visualNodeGroups || !current.visualNodeGroups) {
    return {
      matches: [],
      unmatchedBaseline: [],
      unmatchedCurrent: [],
      totalSimilarity: 100,
      statistics: {
        totalBaselineGroups: 0,
        totalCurrentGroups: 0,
        matchedGroups: 0,
        unmatchedGroups: 0,
        averageDistance: 0
      }
    };
  }
  
  // グループをフラット化
  const baselineFlat = flattenVisualNodeGroups(baseline.visualNodeGroups);
  const currentFlat = flattenVisualNodeGroups(current.visualNodeGroups);
  
  // 最近傍マッチング
  const { matches, unmatchedBaseline, unmatchedCurrent } = findBestMatches(
    baselineFlat,
    currentFlat,
    maxMatchDistance
  );
  
  // 未マッチのグループを収集
  const unmatchedBaselineGroups = Array.from(unmatchedBaseline).map(idx => baselineFlat[idx]);
  const unmatchedCurrentGroups = Array.from(unmatchedCurrent).map(idx => currentFlat[idx]);
  
  // 統計を計算
  const totalGroups = Math.max(baselineFlat.length, currentFlat.length);
  const unmatchedCount = unmatchedBaselineGroups.length + unmatchedCurrentGroups.length;
  const averageDistance = matches.length > 0
    ? matches.reduce((sum, match) => sum + match.distance, 0) / matches.length
    : 0;
  
  // 全体の類似度を計算
  // マッチしたグループの類似度 + 未マッチによるペナルティ
  const matchSimilarity = matches.length > 0
    ? matches.reduce((sum, match) => sum + match.similarity, 0) / matches.length
    : 0;
  
  const unmatchedPenalty = totalGroups > 0 ? (unmatchedCount / totalGroups) * 50 : 0;
  const totalSimilarity = Math.max(0, matchSimilarity - unmatchedPenalty);
  
  return {
    matches,
    unmatchedBaseline: unmatchedBaselineGroups,
    unmatchedCurrent: unmatchedCurrentGroups,
    totalSimilarity,
    statistics: {
      totalBaselineGroups: baselineFlat.length,
      totalCurrentGroups: currentFlat.length,
      matchedGroups: matches.length,
      unmatchedGroups: unmatchedCount,
      averageDistance
    }
  };
}

/**
 * 比較結果から変更サマリーを生成
 */
export function generateChangeSummary(result: FlatComparisonResult): string {
  const { statistics, totalSimilarity } = result;
  const lines: string[] = [];
  
  lines.push(`Overall Similarity: ${totalSimilarity.toFixed(1)}%`);
  lines.push(`Matched Groups: ${statistics.matchedGroups}/${statistics.totalBaselineGroups}`);
  
  if (result.unmatchedBaseline.length > 0) {
    lines.push(`Removed Groups: ${result.unmatchedBaseline.length}`);
    result.unmatchedBaseline.slice(0, 3).forEach(group => {
      lines.push(`  - ${group.type}: ${group.label}`);
    });
    if (result.unmatchedBaseline.length > 3) {
      lines.push(`  ... and ${result.unmatchedBaseline.length - 3} more`);
    }
  }
  
  if (result.unmatchedCurrent.length > 0) {
    lines.push(`Added Groups: ${result.unmatchedCurrent.length}`);
    result.unmatchedCurrent.slice(0, 3).forEach(group => {
      lines.push(`  - ${group.type}: ${group.label}`);
    });
    if (result.unmatchedCurrent.length > 3) {
      lines.push(`  ... and ${result.unmatchedCurrent.length - 3} more`);
    }
  }
  
  return lines.join('\n');
}