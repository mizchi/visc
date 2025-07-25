/**
 * ワークフロー用の拡張型定義
 */

import type { LayoutComparisonResult as BaseLayoutComparisonResult } from '../layout/comparator.js';

/**
 * ワークフローで使用する拡張されたLayoutComparisonResult
 */
export interface ExtendedLayoutComparisonResult extends BaseLayoutComparisonResult {
  /** 要素の比較結果 */
  elementsComparison: {
    missing: string[];
    unexpected: string[];
    changed: string[];
  };
  /** レイアウトの類似度 (0-1) */
  layoutSimilarity: number;
  /** 詳細な類似度 */
  similarities: {
    position: number;
    size: number;
    structure: number;
  };
  /** 変更があるかどうか */
  hasChanges: boolean;
}

/**
 * 基本のLayoutComparisonResultを拡張型に変換
 */
export function toExtendedComparisonResult(
  base: BaseLayoutComparisonResult
): ExtendedLayoutComparisonResult {
  const missingCount = base.differences.filter(d => d.type === 'removed').length;
  const unexpectedCount = base.differences.filter(d => d.type === 'added').length;
  const changedCount = base.differences.filter(d => d.type === 'modified').length;
  
  return {
    ...base,
    elementsComparison: {
      missing: base.differences
        .filter(d => d.type === 'removed')
        .map(d => d.path),
      unexpected: base.differences
        .filter(d => d.type === 'added')
        .map(d => d.path),
      changed: base.differences
        .filter(d => d.type === 'modified')
        .map(d => d.path)
    },
    layoutSimilarity: base.similarity / 100, // 0-100を0-1に変換
    similarities: {
      position: base.similarity / 100,
      size: base.similarity / 100,
      structure: base.similarity / 100
    },
    hasChanges: base.differences.length > 0
  };
}