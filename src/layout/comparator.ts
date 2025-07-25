/**
 * レイアウト比較関数
 *
 * このモジュールは、AIの画像入力コストを削減するための中間データ比較機能を提供します。
 * 画像の代わりにレイアウトの構造データを比較することで、視覚的な差分を効率的に検出します。
 */

import type {
  LayoutElement,
  SemanticGroup,
  LayoutAnalysisResult,
} from "./extractor.js";
import { normalizedTextSimilarity, normalizeText } from "./text-utils.js";

export interface LayoutDifference {
  type: "added" | "removed" | "modified" | "moved";
  path: string; // 要素のパス（例: "section[0]/container[2]/element[1]"）
  element?: LayoutElement | SemanticGroup;
  previousElement?: LayoutElement | SemanticGroup;
  changes?: {
    property: string;
    before: unknown;
    after: unknown;
  }[];
}

export interface LayoutComparisonResult {
  identical: boolean;
  differences: LayoutDifference[];
  similarity: number; // 0-100の類似度スコア
  summary: {
    added: number;
    removed: number;
    modified: number;
    moved: number;
  };
}

// 内部で使用する型定義
type MatchedGroup = { group: SemanticGroup; index: number };

/**
 * 矩形の類似度を計算
 */
function calculateRectSimilarity(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  const xDiff = Math.abs(rect1.x - rect2.x);
  const yDiff = Math.abs(rect1.y - rect2.y);
  const widthDiff = Math.abs(rect1.width - rect2.width);
  const heightDiff = Math.abs(rect1.height - rect2.height);

  // 位置と大きさの差分を正規化
  const positionDiff =
    (xDiff + yDiff) / (rect1.width + rect1.height + rect2.width + rect2.height);
  const sizeDiff =
    (widthDiff + heightDiff) /
    (rect1.width + rect1.height + rect2.width + rect2.height);

  return Math.max(0, 1 - (positionDiff + sizeDiff));
}

/**
 * 要素の同一性を判定
 */
function isSameElement(
  elem1: LayoutElement | SemanticGroup,
  elem2: LayoutElement | SemanticGroup,
  ignoreType: boolean = false
): boolean {
  // SemanticGroupの場合
  if ("type" in elem1 && "type" in elem2) {
    const group1 = elem1 as SemanticGroup;
    const group2 = elem2 as SemanticGroup;
    // タイプと位置の類似性で判定（ラベルは変わる可能性があるため）
    const typeMatch = ignoreType || group1.type === group2.type;
    return (
      typeMatch && calculateRectSimilarity(group1.bounds, group2.bounds) > 0.7
    );
  }

  // LayoutElementの場合
  if ("tagName" in elem1 && "tagName" in elem2) {
    const el1 = elem1 as LayoutElement;
    const el2 = elem2 as LayoutElement;
    return (
      el1.tagName === el2.tagName &&
      el1.id === el2.id &&
      el1.className === el2.className &&
      calculateRectSimilarity(el1.rect, el2.rect) > 0.7
    );
  }

  return false;
}

/**
 * 要素の変更を検出
 */
function detectElementChanges(
  elem1: LayoutElement | SemanticGroup,
  elem2: LayoutElement | SemanticGroup,
  options: {
    ignoreText?: boolean;
    ignoreStyle?: boolean;
    threshold?: number;
    textCompareMode?: 'exact' | 'normalized' | 'similarity';
    textSimilarityThreshold?: number;
    textNormalizeOptions?: {
      caseSensitive?: boolean;
      removeExtraSpaces?: boolean;
      trimLines?: boolean;
    };
  } = {}
): { property: string; before: unknown; after: unknown }[] {
  const changes: { property: string; before: unknown; after: unknown }[] = [];
  const { 
    ignoreText = false, 
    ignoreStyle = false, 
    threshold = 2,
    textCompareMode = 'exact',
    textSimilarityThreshold = 0.8,
    textNormalizeOptions = {}
  } = options;

  // 共通のプロパティをチェック
  if ("bounds" in elem1 && "bounds" in elem2) {
    const rect1 = (elem1 as SemanticGroup).bounds;
    const rect2 = (elem2 as SemanticGroup).bounds;

    if (Math.abs(rect1.x - rect2.x) > threshold) {
      changes.push({ property: "x", before: rect1.x, after: rect2.x });
    }
    if (Math.abs(rect1.y - rect2.y) > threshold) {
      changes.push({ property: "y", before: rect1.y, after: rect2.y });
    }
    if (Math.abs(rect1.width - rect2.width) > threshold) {
      changes.push({
        property: "width",
        before: rect1.width,
        after: rect2.width,
      });
    }
    if (Math.abs(rect1.height - rect2.height) > threshold) {
      changes.push({
        property: "height",
        before: rect1.height,
        after: rect2.height,
      });
    }

    if ("importance" in elem1 && "importance" in elem2) {
      if (Math.abs(elem1.importance - elem2.importance) > 5) {
        changes.push({
          property: "importance",
          before: elem1.importance,
          after: elem2.importance,
        });
      }
    }

    // SemanticGroupのラベル変更をチェック（ignoreTextオプションを考慮）
    if (!ignoreText && "label" in elem1 && "label" in elem2) {
      if (elem1.label !== elem2.label) {
        changes.push({
          property: "label",
          before: elem1.label,
          after: elem2.label,
        });
      }
    }
  }

  if ("rect" in elem1 && "rect" in elem2) {
    const rect1 = (elem1 as LayoutElement).rect;
    const rect2 = (elem2 as LayoutElement).rect;

    if (Math.abs(rect1.x - rect2.x) > threshold) {
      changes.push({ property: "x", before: rect1.x, after: rect2.x });
    }
    if (Math.abs(rect1.y - rect2.y) > threshold) {
      changes.push({ property: "y", before: rect1.y, after: rect2.y });
    }
    if (Math.abs(rect1.width - rect2.width) > threshold) {
      changes.push({
        property: "width",
        before: rect1.width,
        after: rect2.width,
      });
    }
    if (Math.abs(rect1.height - rect2.height) > threshold) {
      changes.push({
        property: "height",
        before: rect1.height,
        after: rect2.height,
      });
    }

    const el1 = elem1 as LayoutElement;
    const el2 = elem2 as LayoutElement;

    // テキストの変更をチェック（ignoreTextオプションを考慮）
    if (!ignoreText && el1.text !== undefined && el2.text !== undefined) {
      let textChanged = false;
      
      switch (textCompareMode) {
        case 'exact':
          textChanged = el1.text !== el2.text;
          break;
          
        case 'normalized':
          const normalized1 = normalizeText(el1.text, textNormalizeOptions);
          const normalized2 = normalizeText(el2.text, textNormalizeOptions);
          textChanged = normalized1 !== normalized2;
          break;
          
        case 'similarity':
          const { similarity } = normalizedTextSimilarity(
            el1.text,
            el2.text,
            textNormalizeOptions
          );
          textChanged = similarity < textSimilarityThreshold;
          break;
      }
      
      if (textChanged) {
        changes.push({ property: "text", before: el1.text, after: el2.text });
      }
    }

    // スタイルの変更をチェック（ignoreStyleオプションを考慮）
    if (
      !ignoreStyle &&
      el1.computedStyle?.fontSize !== el2.computedStyle?.fontSize
    ) {
      changes.push({
        property: "fontSize",
        before: el1.computedStyle?.fontSize,
        after: el2.computedStyle?.fontSize,
      });
    }
  }

  return changes;
}

/**
 * セマンティックグループの子要素を再帰的に比較
 */
function compareSemanticGroupChildren(
  baselineGroup: SemanticGroup,
  currentGroup: SemanticGroup,
  parentPath: string,
  differences: LayoutDifference[],
  options: { 
    ignoreText?: boolean; 
    ignoreStyle?: boolean; 
    threshold?: number;
    textCompareMode?: 'exact' | 'normalized' | 'similarity';
    textSimilarityThreshold?: number;
    textNormalizeOptions?: {
      caseSensitive?: boolean;
      removeExtraSpaces?: boolean;
      trimLines?: boolean;
    };
  }
): void {
  if (baselineGroup.children && currentGroup.children) {
    // 子要素の削除を検出
    baselineGroup.children.forEach((child, index) => {
      const found = currentGroup.children.find((c) => isSameElement(child, c));
      if (!found) {
        differences.push({
          type: "removed",
          path: `${parentPath}/child[${index}]`,
          previousElement: child,
        });
      }
    });

    // 子要素の追加・変更を検出
    currentGroup.children.forEach((child, index) => {
      const found = baselineGroup.children.find((c) => isSameElement(child, c));
      if (!found) {
        differences.push({
          type: "added",
          path: `${parentPath}/child[${index}]`,
          element: child,
        });
      } else {
        const changes = detectElementChanges(found, child, options);
        if (changes.length > 0) {
          const isOnlyPositionChange = changes.every((c) =>
            ["x", "y"].includes(c.property)
          );
          differences.push({
            type: isOnlyPositionChange ? "moved" : "modified",
            path: `${parentPath}/child[${index}]`,
            element: child,
            previousElement: found,
            changes,
          });
        }
        // 再帰的に子要素を比較
        compareSemanticGroupChildren(
          found,
          child,
          `${parentPath}/child[${index}]`,
          differences,
          options
        );
      }
    });
  }
}

/**
 * レイアウトデータを比較
 */
export function compareLayouts(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  options: {
    threshold?: number; // 位置の変更を検出する閾値（ピクセル）
    ignoreText?: boolean; // テキストの変更を無視
    ignoreStyle?: boolean; // スタイルの変更を無視
    textCompareMode?: 'exact' | 'normalized' | 'similarity'; // テキスト比較モード
    textSimilarityThreshold?: number; // テキスト類似度の閾値（0-1）
    textNormalizeOptions?: { // テキスト正規化オプション
      caseSensitive?: boolean;
      removeExtraSpaces?: boolean;
      trimLines?: boolean;
    };
  } = {}
): LayoutComparisonResult {
  const differences: LayoutDifference[] = [];
  const { 
    threshold = 2, 
    ignoreText = false, 
    ignoreStyle = false,
    textCompareMode = 'exact',
    textSimilarityThreshold = 0.8,
    textNormalizeOptions = {}
  } = options;

  // elements配列の比較（LayoutElementの比較）
  if (baseline.elements && current.elements) {
    const baselineElements = baseline.elements;
    const currentElements = current.elements;
    
    // マッチング済みの要素を記録
    const matchedBaselineElements = new Set<number>();
    const matchedCurrentElements = new Set<number>();
    
    // 要素をマッチング
    currentElements.forEach((currentEl, currentIndex) => {
      let bestMatch: { element: LayoutElement; index: number } | null = null;
      let bestSimilarity = 0;
      
      baselineElements.forEach((baselineEl, baselineIndex) => {
        if (matchedBaselineElements.has(baselineIndex)) return;
        
        // 同じタグかつ位置が近い要素を優先
        if (baselineEl.tagName === currentEl.tagName &&
            baselineEl.className === currentEl.className &&
            baselineEl.id === currentEl.id) {
          const similarity = calculateRectSimilarity(baselineEl.rect, currentEl.rect);
          if (similarity > bestSimilarity && similarity > 0.7) {
            bestMatch = { element: baselineEl, index: baselineIndex };
            bestSimilarity = similarity;
          }
        }
      });
      
      if (bestMatch !== null) {
        const match = bestMatch as { element: LayoutElement; index: number };
        matchedBaselineElements.add(match.index);
        matchedCurrentElements.add(currentIndex);
        
        const changes = detectElementChanges(match.element, currentEl, {
          ignoreText,
          ignoreStyle,
          threshold,
          textCompareMode,
          textSimilarityThreshold,
          textNormalizeOptions,
        });
        
        if (changes.length > 0) {
          const isOnlyPositionChange = changes.every((c) =>
            ["x", "y"].includes(c.property)
          );
          differences.push({
            type: isOnlyPositionChange ? "moved" : "modified",
            path: `element[${currentIndex}]`,
            element: currentEl,
            previousElement: match.element,
            changes,
          });
        }
      }
    });
    
    // 削除された要素を検出
    baselineElements.forEach((element, index) => {
      if (!matchedBaselineElements.has(index)) {
        differences.push({
          type: "removed",
          path: `element[${index}]`,
          previousElement: element,
        });
      }
    });
    
    // 追加された要素を検出
    currentElements.forEach((element, index) => {
      if (!matchedCurrentElements.has(index)) {
        differences.push({
          type: "added",
          path: `element[${index}]`,
          element: element,
        });
      }
    });
  }

  // セマンティックグループの比較
  if (baseline.semanticGroups && current.semanticGroups) {
    const baselineGroups = baseline.semanticGroups;
    const currentGroups = current.semanticGroups;

    // マッチング済みの要素を記録
    const matchedBaseline = new Set<number>();
    const matchedCurrent = new Set<number>();

    // まず同じ要素をマッチング
    currentGroups.forEach((currentGroup, currentIndex) => {
      let bestMatch: MatchedGroup | null = null;
      let bestSimilarity = 0;

      baselineGroups.forEach((baselineGroup, baselineIndex) => {
        if (matchedBaseline.has(baselineIndex)) return;

        // 同じタイプかつ位置が近い要素を優先
        if (baselineGroup.type === currentGroup.type) {
          const similarity = calculateRectSimilarity(
            baselineGroup.bounds,
            currentGroup.bounds
          );
          if (similarity > bestSimilarity && similarity > 0.7) {
            bestMatch = { group: baselineGroup, index: baselineIndex };
            bestSimilarity = similarity;
          }
        }
      });

      if (bestMatch !== null) {
        // TypeScriptの型推論を助けるために、明示的な型アサーション
        const match = bestMatch as MatchedGroup;
        matchedBaseline.add(match.index);
        matchedCurrent.add(currentIndex);

        const changes = detectElementChanges(match.group, currentGroup, {
          ignoreText,
          ignoreStyle,
          threshold,
          textCompareMode,
          textSimilarityThreshold,
          textNormalizeOptions,
        });
        if (changes.length > 0) {
          const isOnlyPositionChange = changes.every((c) =>
            ["x", "y"].includes(c.property)
          );
          differences.push({
            type: isOnlyPositionChange ? "moved" : "modified",
            path: `semanticGroup[${currentIndex}]`,
            element: currentGroup,
            previousElement: match.group,
            changes,
          });
        }

        // 子要素の再帰的な比較
        compareSemanticGroupChildren(
          match.group,
          currentGroup,
          `semanticGroup[${currentIndex}]`,
          differences,
          { ignoreText, ignoreStyle, threshold, textCompareMode, textSimilarityThreshold, textNormalizeOptions }
        );
      }
    });

    // タイプが変更された可能性のある要素を再度チェック
    currentGroups.forEach((currentGroup, currentIndex) => {
      if (matchedCurrent.has(currentIndex)) return;

      let bestMatch: MatchedGroup | null = null;
      let bestSimilarity = 0;

      baselineGroups.forEach((baselineGroup, baselineIndex) => {
        if (matchedBaseline.has(baselineIndex)) return;

        // タイプに関わらず位置が近い要素を探す
        const similarity = calculateRectSimilarity(
          baselineGroup.bounds,
          currentGroup.bounds
        );
        if (similarity > bestSimilarity && similarity > 0.85) {
          // より厳しい閾値
          bestMatch = { group: baselineGroup, index: baselineIndex };
          bestSimilarity = similarity;
        }
      });

      if (bestMatch !== null) {
        // TypeScriptの型推論を助けるために、明示的な型アサーション
        const match = bestMatch as MatchedGroup;
        matchedBaseline.add(match.index);
        matchedCurrent.add(currentIndex);

        const changes = detectElementChanges(match.group, currentGroup, {
          ignoreText,
          ignoreStyle,
          threshold,
          textCompareMode,
          textSimilarityThreshold,
          textNormalizeOptions,
        });
        changes.push({
          property: "type",
          before: match.group.type,
          after: currentGroup.type,
        });
        differences.push({
          type: "modified",
          path: `semanticGroup[${currentIndex}]`,
          element: currentGroup,
          previousElement: match.group,
          changes,
        });

        compareSemanticGroupChildren(
          match.group,
          currentGroup,
          `semanticGroup[${currentIndex}]`,
          differences,
          { ignoreText, ignoreStyle, threshold, textCompareMode, textSimilarityThreshold, textNormalizeOptions }
        );
      }
    });

    // 削除された要素を検出
    baselineGroups.forEach((group, index) => {
      if (!matchedBaseline.has(index)) {
        differences.push({
          type: "removed",
          path: `semanticGroup[${index}]`,
          previousElement: group,
        });
      }
    });

    // 追加された要素を検出
    currentGroups.forEach((group, index) => {
      if (!matchedCurrent.has(index)) {
        differences.push({
          type: "added",
          path: `semanticGroup[${index}]`,
          element: group,
        });
      }
    });
  }

  // 統計情報の計算
  const summary = {
    added: differences.filter((d) => d.type === "added").length,
    removed: differences.filter((d) => d.type === "removed").length,
    modified: differences.filter((d) => d.type === "modified").length,
    moved: differences.filter((d) => d.type === "moved").length,
  };

  // 類似度の計算
  // moved は小さな変更なので重みを減らす
  const weightedChanges =
    summary.added + summary.removed + summary.modified + summary.moved * 0.2;
  const totalElements = Math.max(
    (baseline.semanticGroups?.length || 0) + (baseline.elements?.length || 0),
    (current.semanticGroups?.length || 0) + (current.elements?.length || 0)
  );

  const similarity =
    totalElements > 0
      ? Math.max(0, 1 - weightedChanges / totalElements) * 100
      : 100;

  return {
    identical: differences.length === 0,
    differences,
    similarity,
    summary,
  };
}

/**
 * シンプルな差分チェック関数（boolean返却）
 */
export function hasLayoutChanged(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  options?: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreStyle?: boolean;
    textCompareMode?: 'exact' | 'normalized' | 'similarity';
    textSimilarityThreshold?: number;
    textNormalizeOptions?: {
      caseSensitive?: boolean;
      removeExtraSpaces?: boolean;
      trimLines?: boolean;
    };
  }
): boolean {
  const result = compareLayouts(baseline, current, options);
  return !result.identical;
}

/**
 * 類似度ベースの差分チェック関数
 */
export function isLayoutSimilar(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  similarityThreshold: number = 95,
  options?: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreStyle?: boolean;
    textCompareMode?: 'exact' | 'normalized' | 'similarity';
    textSimilarityThreshold?: number;
    textNormalizeOptions?: {
      caseSensitive?: boolean;
      removeExtraSpaces?: boolean;
      trimLines?: boolean;
    };
  }
): boolean {
  const result = compareLayouts(baseline, current, options);
  return result.similarity >= similarityThreshold;
}
