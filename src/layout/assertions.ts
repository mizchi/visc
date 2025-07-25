/**
 * フレームワーク非依存のレイアウトアサーション関数
 * 
 * AIの画像入力コストを削減するため、レイアウトの構造データを使用した
 * 視覚的な差分検証を行います。各テストフレームワークに応じて
 * 適切なエラーハンドリングを実装してください。
 */

import { compareLayouts, type LayoutComparisonResult } from './comparator.js';
import type { LayoutAnalysisResult } from './extractor.js';

export class LayoutAssertionError extends Error {
  constructor(
    message: string,
    public comparisonResult: LayoutComparisonResult,
    public baseline: LayoutAnalysisResult,
    public current: LayoutAnalysisResult
  ) {
    super(message);
    this.name = 'LayoutAssertionError';
  }

  /**
   * 差分の詳細を取得
   */
  getDifferenceDetails(): string {
    const { differences, summary, similarity } = this.comparisonResult;
    
    let details = `Layout Comparison Failed\n`;
    details += `Similarity: ${similarity.toFixed(2)}%\n`;
    details += `Changes: ${summary.added} added, ${summary.removed} removed, `;
    details += `${summary.modified} modified, ${summary.moved} moved\n\n`;
    
    if (differences.length > 0) {
      details += 'Differences:\n';
      differences.forEach((diff, index) => {
        details += `${index + 1}. ${diff.type.toUpperCase()} - ${diff.path}\n`;
        if (diff.changes) {
          diff.changes.forEach(change => {
            details += `   ${change.property}: ${change.before} → ${change.after}\n`;
          });
        }
      });
    }
    
    return details;
  }
}

/**
 * レイアウトが同一であることを検証
 */
export function assertLayoutsIdentical(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  options?: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreStyle?: boolean;
  }
): void {
  const result = compareLayouts(baseline, current, options);
  
  if (!result.identical) {
    throw new LayoutAssertionError(
      'Layouts are not identical',
      result,
      baseline,
      current
    );
  }
}

/**
 * レイアウトが指定した類似度以上であることを検証
 */
export function assertLayoutsSimilar(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  similarityThreshold: number = 95,
  options?: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreStyle?: boolean;
  }
): void {
  const result = compareLayouts(baseline, current, options);
  
  if (result.similarity < similarityThreshold) {
    throw new LayoutAssertionError(
      `Layout similarity ${result.similarity.toFixed(2)}% is below threshold ${similarityThreshold}%`,
      result,
      baseline,
      current
    );
  }
}

/**
 * 特定の変更タイプがないことを検証
 */
export function assertNoLayoutChanges(
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  changeTypes: Array<'added' | 'removed' | 'modified' | 'moved'>,
  options?: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreStyle?: boolean;
  }
): void {
  const result = compareLayouts(baseline, current, options);
  
  const foundChanges = changeTypes.filter(type => result.summary[type] > 0);
  
  if (foundChanges.length > 0) {
    const changeDetails = foundChanges.map(type => `${result.summary[type]} ${type}`).join(', ');
    throw new LayoutAssertionError(
      `Found prohibited layout changes: ${changeDetails}`,
      result,
      baseline,
      current
    );
  }
}

/**
 * Jest/Vitestなど向けのカスタムマッチャー生成関数
 */
export function createLayoutMatchers() {
  return {
    toHaveIdenticalLayout(
      received: LayoutAnalysisResult,
      expected: LayoutAnalysisResult,
      options?: {
        threshold?: number;
        ignoreText?: boolean;
        ignoreStyle?: boolean;
      }
    ) {
      const result = compareLayouts(expected, received, options);
      
      return {
        pass: result.identical,
        message: () => {
          if (result.identical) {
            return 'Expected layouts to be different, but they are identical';
          }
          
          const error = new LayoutAssertionError(
            'Layouts are not identical',
            result,
            expected,
            received
          );
          
          return error.getDifferenceDetails();
        }
      };
    },
    
    toHaveSimilarLayout(
      received: LayoutAnalysisResult,
      expected: LayoutAnalysisResult,
      similarityThreshold: number = 95,
      options?: {
        threshold?: number;
        ignoreText?: boolean;
        ignoreStyle?: boolean;
      }
    ) {
      const result = compareLayouts(expected, received, options);
      
      return {
        pass: result.similarity >= similarityThreshold,
        message: () => {
          if (result.similarity >= similarityThreshold) {
            return `Expected layout similarity to be below ${similarityThreshold}%, but it was ${result.similarity.toFixed(2)}%`;
          }
          
          const error = new LayoutAssertionError(
            `Layout similarity ${result.similarity.toFixed(2)}% is below threshold ${similarityThreshold}%`,
            result,
            expected,
            received
          );
          
          return error.getDifferenceDetails();
        }
      };
    }
  };
}

/**
 * Playwrightテスト向けのユーティリティ
 */
export async function expectLayoutsToMatch(
  page: any, // Playwright Page type
  baseline: LayoutAnalysisResult,
  extractScript: string,
  options?: {
    threshold?: number;
    ignoreText?: boolean;
    ignoreStyle?: boolean;
    similarityThreshold?: number;
  }
): Promise<void> {
  const current = await page.evaluate(extractScript) as LayoutAnalysisResult;
  
  if (options?.similarityThreshold !== undefined) {
    assertLayoutsSimilar(baseline, current, options.similarityThreshold, options);
  } else {
    assertLayoutsIdentical(baseline, current, options);
  }
}