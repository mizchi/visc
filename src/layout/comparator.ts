/**
 * 新しいフォーマットのレイアウト比較機能
 */

import type { LayoutAnalysisResult, LayoutElement } from './extractor.js';

export interface LayoutDifference {
  elementId: string;
  type: 'position' | 'size' | 'both' | 'text' | 'visibility';
  changes: {
    rect?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    text?: string;
    visibility?: boolean;
  };
  oldValue: LayoutElement;
  newValue: LayoutElement;
}

export interface LayoutComparisonResult {
  differences: LayoutDifference[];
  addedElements: string[];
  removedElements: string[];
  similarity: number;
  summary: {
    totalElements: number;
    totalChanged: number;
    totalAdded: number;
    totalRemoved: number;
  };
}

/**
 * 要素のIDを生成
 */
export function generateElementId(element: LayoutElement): string {
  // tagName, className, id の組み合わせで一意のIDを生成
  const tag = element.tagName || 'unknown';
  const className = element.className || 'no-class';
  const id = element.id || 'no-id';
  const index = element.rect ? `${Math.round(element.rect.x)}-${Math.round(element.rect.y)}` : '0-0';
  return `${tag}-${className}-${id}-${index}`;
}

/**
 * 要素のマップを作成
 */
function createElementMap(elements: LayoutElement[]): Map<string, LayoutElement> {
  const map = new Map<string, LayoutElement>();
  elements.forEach(element => {
    const id = generateElementId(element);
    map.set(id, element);
  });
  return map;
}

/**
 * 矩形の変更を検出
 */
function detectRectChanges(
  rect1: LayoutElement['rect'],
  rect2: LayoutElement['rect'],
  threshold: number = 2
): { hasChange: boolean; type: 'position' | 'size' | 'both' | null; changes: any } {
  const changes: any = {};
  let hasPositionChange = false;
  let hasSizeChange = false;

  if (Math.abs(rect1.x - rect2.x) > threshold) {
    changes.x = rect2.x - rect1.x;
    hasPositionChange = true;
  }
  if (Math.abs(rect1.y - rect2.y) > threshold) {
    changes.y = rect2.y - rect1.y;
    hasPositionChange = true;
  }
  if (Math.abs(rect1.width - rect2.width) > threshold) {
    changes.width = rect2.width - rect1.width;
    hasSizeChange = true;
  }
  if (Math.abs(rect1.height - rect2.height) > threshold) {
    changes.height = rect2.height - rect1.height;
    hasSizeChange = true;
  }

  const hasChange = hasPositionChange || hasSizeChange;
  let type: 'position' | 'size' | 'both' | null = null;
  if (hasPositionChange && hasSizeChange) type = 'both';
  else if (hasPositionChange) type = 'position';
  else if (hasSizeChange) type = 'size';

  return { hasChange, type, changes };
}

/**
 * レイアウトを比較（新フォーマット）
 */
export function compareLayoutTrees(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  options: {
    threshold?: number;
    ignoreText?: boolean;
  } = {}
): LayoutComparisonResult {
  const { threshold = 2, ignoreText = false } = options;
  
  const baselineMap = createElementMap(baseline.elements);
  const currentMap = createElementMap(current.elements);
  
  const differences: LayoutDifference[] = [];
  const addedElements: string[] = [];
  const removedElements: string[] = [];
  const processedIds = new Set<string>();

  // ベースラインの要素をチェック
  baselineMap.forEach((baselineElement, elementId) => {
    processedIds.add(elementId);
    const currentElement = currentMap.get(elementId);
    
    if (!currentElement) {
      // 要素が削除された
      removedElements.push(elementId);
    } else {
      // 要素の変更をチェック
      const rectResult = detectRectChanges(baselineElement.rect, currentElement.rect, threshold);
      const textChanged = !ignoreText && baselineElement.text !== currentElement.text;
      
      if (rectResult.hasChange || textChanged) {
        const diff: LayoutDifference = {
          elementId,
          type: textChanged && rectResult.type ? 'both' : (rectResult.type || 'text'),
          changes: {},
          oldValue: baselineElement,
          newValue: currentElement
        };
        
        if (rectResult.hasChange) {
          diff.changes.rect = rectResult.changes;
        }
        if (textChanged) {
          diff.changes.text = currentElement.text;
        }
        
        differences.push(diff);
      }
    }
  });

  // 新しく追加された要素をチェック
  currentMap.forEach((currentElement, elementId) => {
    if (!processedIds.has(elementId)) {
      addedElements.push(elementId);
    }
  });

  // サマリーを計算
  const summary = {
    totalElements: currentMap.size,
    totalChanged: differences.length,
    totalAdded: addedElements.length,
    totalRemoved: removedElements.length
  };

  // 類似度を計算
  const totalChanges = summary.totalChanged + summary.totalAdded + summary.totalRemoved;
  const similarity = summary.totalElements > 0
    ? Math.max(0, (1 - totalChanges / summary.totalElements)) * 100
    : 100;

  return {
    differences,
    addedElements,
    removedElements,
    similarity,
    summary
  };
}

/**
 * レイアウトが変更されたかチェック
 */
export function hasLayoutChanged(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  threshold: number = 2
): boolean {
  const result = compareLayoutTrees(baseline, current, { threshold });
  return result.differences.length > 0 || 
         result.addedElements.length > 0 || 
         result.removedElements.length > 0;
}

/**
 * レイアウトの類似度をチェック
 */
export function calculateSimilarity(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  similarityThreshold: number = 90,
  positionThreshold: number = 2
): boolean {
  const result = compareLayoutTrees(baseline, current, { threshold: positionThreshold });
  return result.similarity >= similarityThreshold;
}