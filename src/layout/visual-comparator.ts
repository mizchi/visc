/**
 * ビジュアルノードグループを比較するための新しい比較エンジン
 */

import type { 
  VisualTreeAnalysis, 
  VisualNodeGroup, 
  VisualNode,
  BoundingRect 
} from '../types.js';

export interface VisualGroupDifference {
  groupPath: string;
  type: 'added' | 'removed' | 'modified' | 'moved' | 'resized';
  oldGroup?: VisualNodeGroup;
  newGroup?: VisualNodeGroup;
  changes?: {
    bounds?: Partial<BoundingRect>;
    childrenCount?: { old: number; new: number };
    importance?: { old: number; new: number };
  };
}

export interface VisualGroupComparisonResult {
  differences: VisualGroupDifference[];
  addedGroups: string[];
  removedGroups: string[];
  modifiedGroups: string[];
  similarity: number;
  summary: {
    totalGroups: number;
    totalChanged: number;
    totalAdded: number;
    totalRemoved: number;
  };
}

/**
 * ビジュアルノードグループからパスを生成
 */
function generateGroupPath(group: VisualNodeGroup, parentPath: string = ''): string {
  const path = parentPath ? `${parentPath}/${group.type}:${group.label}` : `${group.type}:${group.label}`;
  return path.substring(0, 100); // 長すぎるパスを制限
}

/**
 * ビジュアルノードグループをフラット化してマップに変換
 */
function flattenVisualNodeGroups(
  groups: VisualNodeGroup[], 
  parentPath: string = ''
): Map<string, VisualNodeGroup> {
  const map = new Map<string, VisualNodeGroup>();
  
  function traverse(group: VisualNodeGroup, currentPath: string) {
    const path = generateGroupPath(group, currentPath);
    map.set(path, group);
    
    // 子要素がセマンティックグループの場合のみ再帰
    group.children.forEach(child => {
      if ('type' in child && 'bounds' in child) {
        traverse(child as VisualNodeGroup, path);
      }
    });
  }
  
  groups.forEach(group => traverse(group, parentPath));
  return map;
}

/**
 * 境界の変更を検出
 */
function detectBoundsChanges(
  oldBounds: BoundingRect,
  newBounds: BoundingRect,
  threshold: number = 5
): { hasChange: boolean; changes?: Partial<BoundingRect> } {
  const changes: Partial<BoundingRect> = {};
  let hasChange = false;
  
  if (Math.abs(oldBounds.x - newBounds.x) > threshold) {
    changes.x = newBounds.x;
    hasChange = true;
  }
  if (Math.abs(oldBounds.y - newBounds.y) > threshold) {
    changes.y = newBounds.y;
    hasChange = true;
  }
  if (Math.abs(oldBounds.width - newBounds.width) > threshold) {
    changes.width = newBounds.width;
    hasChange = true;
  }
  if (Math.abs(oldBounds.height - newBounds.height) > threshold) {
    changes.height = newBounds.height;
    hasChange = true;
  }
  
  return { hasChange, changes: hasChange ? changes : undefined };
}

/**
 * セマンティックグループを比較
 */
export function compareVisualNodeGroups(
  baseline: VisualTreeAnalysis,
  current: VisualTreeAnalysis,
  options: {
    positionThreshold?: number;
    sizeThreshold?: number;
    importanceThreshold?: number;
  } = {}
): VisualGroupComparisonResult {
  const { 
    positionThreshold = 5, 
    sizeThreshold = 5,
    importanceThreshold = 10 
  } = options;
  
  // セマンティックグループが存在しない場合は空の結果を返す
  if (!baseline.visualNodeGroups || !current.visualNodeGroups) {
    return {
      differences: [],
      addedGroups: [],
      removedGroups: [],
      modifiedGroups: [],
      similarity: 100,
      summary: {
        totalGroups: 0,
        totalChanged: 0,
        totalAdded: 0,
        totalRemoved: 0
      }
    };
  }
  
  const baselineMap = flattenVisualNodeGroups(baseline.visualNodeGroups);
  const currentMap = flattenVisualNodeGroups(current.visualNodeGroups);
  
  const differences: VisualGroupDifference[] = [];
  const addedGroups: string[] = [];
  const removedGroups: string[] = [];
  const modifiedGroups: string[] = [];
  const processedPaths = new Set<string>();
  
  // ベースラインのグループをチェック
  baselineMap.forEach((baselineGroup, groupPath) => {
    processedPaths.add(groupPath);
    const currentGroup = currentMap.get(groupPath);
    
    if (!currentGroup) {
      // グループが削除された
      removedGroups.push(groupPath);
      differences.push({
        groupPath,
        type: 'removed',
        oldGroup: baselineGroup
      });
    } else {
      // グループの変更をチェック
      const boundsResult = detectBoundsChanges(
        baselineGroup.bounds, 
        currentGroup.bounds,
        Math.max(positionThreshold, sizeThreshold)
      );
      
      const childrenCountChanged = baselineGroup.children.length !== currentGroup.children.length;
      const importanceChanged = Math.abs(
        (baselineGroup.importance || 0) - (currentGroup.importance || 0)
      ) > importanceThreshold;
      
      if (boundsResult.hasChange || childrenCountChanged || importanceChanged) {
        const diff: VisualGroupDifference = {
          groupPath,
          type: 'modified',
          oldGroup: baselineGroup,
          newGroup: currentGroup,
          changes: {}
        };
        
        if (boundsResult.hasChange) {
          // 位置とサイズの変更を区別
          const positionChanged = boundsResult.changes?.x !== undefined || 
                                boundsResult.changes?.y !== undefined;
          const sizeChanged = boundsResult.changes?.width !== undefined || 
                             boundsResult.changes?.height !== undefined;
          
          if (positionChanged && !sizeChanged) {
            diff.type = 'moved';
          } else if (sizeChanged && !positionChanged) {
            diff.type = 'resized';
          }
          
          diff.changes!.bounds = boundsResult.changes;
        }
        
        if (childrenCountChanged) {
          diff.changes!.childrenCount = {
            old: baselineGroup.children.length,
            new: currentGroup.children.length
          };
        }
        
        if (importanceChanged) {
          diff.changes!.importance = {
            old: baselineGroup.importance || 0,
            new: currentGroup.importance || 0
          };
        }
        
        modifiedGroups.push(groupPath);
        differences.push(diff);
      }
    }
  });
  
  // 新しく追加されたグループをチェック
  currentMap.forEach((currentGroup, groupPath) => {
    if (!processedPaths.has(groupPath)) {
      addedGroups.push(groupPath);
      differences.push({
        groupPath,
        type: 'added',
        newGroup: currentGroup
      });
    }
  });
  
  // サマリーを計算
  const summary = {
    totalGroups: currentMap.size,
    totalChanged: modifiedGroups.length,
    totalAdded: addedGroups.length,
    totalRemoved: removedGroups.length
  };
  
  // 類似度を計算（グループレベル）
  const totalChanges = summary.totalChanged + summary.totalAdded + summary.totalRemoved;
  const similarity = summary.totalGroups > 0
    ? Math.max(0, (1 - totalChanges / summary.totalGroups)) * 100
    : 100;
  
  return {
    differences,
    addedGroups,
    removedGroups,
    modifiedGroups,
    similarity,
    summary
  };
}

/**
 * セマンティックグループの統計情報を取得
 */
export function getVisualNodeGroupStatistics(groups: VisualNodeGroup[]): {
  totalGroups: number;
  groupsByType: Record<string, number>;
  maxDepth: number;
  averageChildrenPerGroup: number;
} {
  const stats = {
    totalGroups: 0,
    groupsByType: {} as Record<string, number>,
    maxDepth: 0,
    totalChildren: 0
  };
  
  function traverse(group: VisualNodeGroup, depth: number = 0) {
    stats.totalGroups++;
    stats.groupsByType[group.type] = (stats.groupsByType[group.type] || 0) + 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);
    stats.totalChildren += group.children.length;
    
    group.children.forEach(child => {
      if ('type' in child && 'bounds' in child) {
        traverse(child as VisualNodeGroup, depth + 1);
      }
    });
  }
  
  groups.forEach(group => traverse(group));
  
  return {
    totalGroups: stats.totalGroups,
    groupsByType: stats.groupsByType,
    maxDepth: stats.maxDepth,
    averageChildrenPerGroup: stats.totalGroups > 0 
      ? stats.totalChildren / stats.totalGroups 
      : 0
  };
}