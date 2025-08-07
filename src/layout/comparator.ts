/**
 * 新しいフォーマットのレイアウト比較機能
 */

import type { VisualTreeAnalysis, VisualNode } from './extractor.js';

export interface VisualDifference {
  elementId: string;
  type: 'position' | 'size' | 'both' | 'text' | 'visibility' | 'added' | 'removed' | 'modified';
  element?: VisualNode;
  changes?: {
    rect?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    text?: string;
    visibility?: boolean;
  };
  oldValue?: VisualNode;
  newValue?: VisualNode;
  positionDiff?: number;
  sizeDiff?: number;
}

export interface VisualComparisonResult {
  differences: VisualDifference[];
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
export function generateElementId(element: VisualNode, index?: number): string {
  // tagName, className, id の組み合わせで一意のIDを生成
  const tag = element.tagName || 'unknown';
  const className = element.className || 'no-class';
  const id = element.id || 'no-id';
  
  // インデックスが提供されている場合はそれを使用
  // 同じ位置順序の要素は同じIDになる
  if (index !== undefined) {
    return `${tag}-${className}-${id}-${index}`;
  }
  
  // それ以外の場合は基本情報のみ
  return `${tag}-${className}-${id}`;
}

/**
 * 要素が無視リストにマッチするかチェック
 */
function shouldIgnoreElement(element: VisualNode, ignoreSelectors: string[]): boolean {
  if (ignoreSelectors.length === 0) return false;
  
  for (const selector of ignoreSelectors) {
    // IDセレクタ
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      if (element.id === id) return true;
    }
    // クラスセレクタ
    else if (selector.startsWith('.')) {
      const className = selector.substring(1);
      if (element.className && element.className.includes(className)) return true;
    }
    // タグセレクタ
    else if (!selector.includes('#') && !selector.includes('.')) {
      if (element.tagName && element.tagName.toLowerCase() === selector.toLowerCase()) return true;
    }
    // 複合セレクタ（簡易的な実装）
    else {
      // タグ#ID or タグ.クラス の形式をサポート
      const parts = selector.match(/^(\w+)?(#[\w-]+)?(\.[\w-]+)?$/);
      if (parts) {
        const [, tag, id, className] = parts;
        let matches = true;
        
        if (tag && element.tagName?.toLowerCase() !== tag.toLowerCase()) matches = false;
        if (id && element.id !== id.substring(1)) matches = false;
        if (className && (!element.className || !element.className.includes(className.substring(1)))) matches = false;
        
        if (matches) return true;
      }
    }
  }
  
  return false;
}

/**
 * 要素のマップを作成
 */
function createElementMap(elements: VisualNode[]): Map<string, VisualNode> {
  const map = new Map<string, VisualNode>();
  elements.forEach((element, index) => {
    const id = generateElementId(element, index);
    map.set(id, element);
  });
  return map;
}

/**
 * 矩形の変更を検出
 */
function detectRectChanges(
  rect1: VisualNode['rect'],
  rect2: VisualNode['rect'],
  threshold: number = 2
): { hasChange: boolean; type: 'position' | 'size' | 'both' | null; changes: any; positionDiff: number; sizeDiff: number } {
  const changes: any = {};
  let hasPositionChange = false;
  let hasSizeChange = false;
  let positionDiff = 0;
  let sizeDiff = 0;

  const xDiff = Math.abs(rect1.x - rect2.x);
  const yDiff = Math.abs(rect1.y - rect2.y);
  const widthDiff = Math.abs(rect1.width - rect2.width);
  const heightDiff = Math.abs(rect1.height - rect2.height);

  if (xDiff > threshold) {
    changes.x = rect2.x - rect1.x;
    hasPositionChange = true;
  }
  if (yDiff > threshold) {
    changes.y = rect2.y - rect1.y;
    hasPositionChange = true;
  }
  if (widthDiff > threshold) {
    changes.width = rect2.width - rect1.width;
    hasSizeChange = true;
  }
  if (heightDiff > threshold) {
    changes.height = rect2.height - rect1.height;
    hasSizeChange = true;
  }

  // 位置の変化量を計算（ユークリッド距離）
  positionDiff = Math.sqrt(xDiff * xDiff + yDiff * yDiff);
  // サイズの変化量を計算
  sizeDiff = Math.sqrt(widthDiff * widthDiff + heightDiff * heightDiff);

  const hasChange = hasPositionChange || hasSizeChange;
  let type: 'position' | 'size' | 'both' | null = null;
  if (hasPositionChange && hasSizeChange) type = 'both';
  else if (hasPositionChange) type = 'position';
  else if (hasSizeChange) type = 'size';

  return { hasChange, type, changes, positionDiff, sizeDiff };
}

/**
 * レイアウトを比較（新フォーマット）
 */
export function compareLayoutTrees(
  baseline: VisualTreeAnalysis,
  current: VisualTreeAnalysis,
  options: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreElements?: string[];
  } = {}
): VisualComparisonResult {
  const { threshold = 2, ignoreText = false, ignoreElements = [] } = options;
  
  const baselineMap = createElementMap(baseline.elements);
  const currentMap = createElementMap(current.elements);
  
  const differences: VisualDifference[] = [];
  const addedElements: string[] = [];
  const removedElements: string[] = [];
  const processedIds = new Set<string>();

  // ベースラインの要素をチェック
  baselineMap.forEach((baselineElement, elementId) => {
    processedIds.add(elementId);
    
    // 無視要素はスキップ
    if (shouldIgnoreElement(baselineElement, ignoreElements)) {
      return;
    }
    
    const currentElement = currentMap.get(elementId);
    
    if (!currentElement) {
      // 要素が削除された
      removedElements.push(elementId);
      differences.push({
        elementId,
        type: 'removed',
        element: baselineElement,
        oldValue: baselineElement
      });
    } else {
      // 無視要素はスキップ
      if (shouldIgnoreElement(currentElement, ignoreElements)) {
        return;
      }
      
      // 要素の変更をチェック
      const rectResult = detectRectChanges(baselineElement.rect, currentElement.rect, threshold);
      const textChanged = !ignoreText && baselineElement.text !== currentElement.text;
      
      if (rectResult.hasChange || textChanged) {
        const diff: VisualDifference = {
          elementId,
          type: rectResult.hasChange || textChanged ? 'modified' : 'text',
          element: currentElement,
          changes: {},
          oldValue: baselineElement,
          newValue: currentElement,
          positionDiff: rectResult.positionDiff,
          sizeDiff: rectResult.sizeDiff
        };
        
        if (rectResult.hasChange && diff.changes) {
          diff.changes.rect = rectResult.changes;
        }
        if (textChanged && diff.changes) {
          diff.changes.text = currentElement.text;
        }
        
        differences.push(diff);
      }
    }
  });

  // 新しく追加された要素をチェック
  currentMap.forEach((currentElement, elementId) => {
    if (!processedIds.has(elementId)) {
      // 無視要素はスキップ
      if (!shouldIgnoreElement(currentElement, ignoreElements)) {
        addedElements.push(elementId);
        differences.push({
          elementId,
          type: 'added',
          element: currentElement,
          newValue: currentElement
        });
      }
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
  // 差分の程度に基づいて重みを計算
  let totalImpact = 0;
  differences.forEach(diff => {
    if (diff.type === 'added' || diff.type === 'removed') {
      totalImpact += 1.0; // 要素の追加・削除は重い
    } else if (diff.type === 'modified') {
      // 変更の程度に応じて重みを調整
      const positionImpact = diff.positionDiff ? Math.min(diff.positionDiff / 200, 0.3) : 0;
      const sizeImpact = diff.sizeDiff ? Math.min(diff.sizeDiff / 200, 0.3) : 0;
      totalImpact += Math.max(positionImpact, sizeImpact, 0.05);
    }
  });
  
  const maxElements = Math.max(baselineMap.size, currentMap.size);
  const similarity = maxElements > 0
    ? Math.max(0, 100 - (totalImpact / maxElements) * 100)
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
  baseline: VisualTreeAnalysis,
  current: VisualTreeAnalysis,
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
  baseline: VisualTreeAnalysis,
  current: VisualTreeAnalysis,
  similarityThreshold: number = 90,
  positionThreshold: number = 2
): boolean {
  const result = compareLayoutTrees(baseline, current, { threshold: positionThreshold });
  return result.similarity >= similarityThreshold;
}