/**
 * レイアウト変更のエラー分析エンジン
 */

import type { 
  LayoutComparisonResult, 
  LayoutDifference 
} from '../layout/comparator.js';
import type { SemanticGroup } from '../layout/extractor.js';
import { 
  ErrorType, 
  type ErrorAnalysis,
  WorkflowAction,
  type AnalysisContext 
} from './types.js';

/**
 * エラー分析結果を作成するヘルパー関数
 */
function createErrorAnalysis(
  errorType: ErrorType,
  confidence: number,
  reasoning: string,
  suggestedAction: WorkflowAction,
  affectedElements: string[] = [],
  details?: Record<string, any>
): ErrorAnalysis {
  return {
    errorType,
    type: errorType, // 互換性のため
    confidence,
    reasoning,
    description: reasoning, // 互換性のため
    suggestedAction,
    affectedElements,
    details
  };
}

/**
 * レイアウト変更を分析してエラータイプを判定
 */
export class ErrorAnalyzer {
  /**
   * レイアウト比較結果からエラーを分析
   */
  analyzeLayoutDifferences(
    comparison: LayoutComparisonResult,
    context: AnalysisContext
  ): ErrorAnalysis {
    // 変更がない場合
    if (comparison.identical || comparison.differences.length === 0) {
      return createErrorAnalysis(
        ErrorType.UNKNOWN,
        1,
        'No layout changes detected',
        WorkflowAction.CONTINUE
      );
    }

    // 要素の消失をチェック
    const missingElements = this.detectMissingElements(comparison);
    if (missingElements.length > 0) {
      return this.analyzeMissingElements(missingElements, comparison);
    }

    // レイアウト崩壊をチェック
    const layoutBreakdown = this.detectLayoutBreakdown(comparison);
    if (layoutBreakdown) {
      return this.analyzeLayoutBreakdown(layoutBreakdown, comparison);
    }

    // 確率的な変更をチェック
    const stochasticChanges = this.detectStochasticChanges(comparison, context);
    if (stochasticChanges) {
      return this.analyzeStochasticChanges(stochasticChanges, comparison);
    }

    // 意味のある変更をチェック
    const meaningfulChanges = this.detectMeaningfulChanges(comparison);
    if (meaningfulChanges) {
      return this.analyzeMeaningfulChanges(meaningfulChanges, comparison);
    }

    // 分類できない場合
    return {
      errorType: ErrorType.UNKNOWN,
      confidence: 0.5,
      reasoning: 'Layout changes detected but cannot be classified',
      affectedElements: comparison.differences.map(d => d.path),
      suggestedAction: WorkflowAction.MANUAL_REVIEW,
      details: {
        severity: this.calculateSeverity(comparison),
        changeType: 'mixed'
      }
    };
  }

  /**
   * 要素の消失を検出
   */
  private detectMissingElements(comparison: LayoutComparisonResult): LayoutDifference[] {
    return comparison.differences.filter(diff => 
      diff.type === 'removed' || 
      (diff.type === 'modified' && diff.changes?.some(c => c.property === 'visibility' && c.after === false))
    );
  }

  /**
   * 消失した要素を分析
   */
  private analyzeMissingElements(
    missingElements: LayoutDifference[],
    comparison: LayoutComparisonResult
  ): ErrorAnalysis {
    const criticalElements = missingElements.filter(el => 
      this.isCriticalElement(el.path)
    );

    if (criticalElements.length > 0) {
      return {
        errorType: ErrorType.BROKEN,
        confidence: 0.95,
        reasoning: `Critical elements are missing: ${criticalElements.map(e => e.path).join(', ')}`,
        affectedElements: criticalElements.map(e => e.path),
        suggestedAction: WorkflowAction.STOP,
        details: {
          severity: 'critical',
          changeType: 'layout',
          selectors: criticalElements.map(e => e.path)
        }
      };
    }

    return {
      errorType: ErrorType.MEANINGFUL_CHANGE,
      confidence: 0.8,
      reasoning: `${missingElements.length} elements removed from layout`,
      affectedElements: missingElements.map(e => e.path),
      suggestedAction: WorkflowAction.MANUAL_REVIEW,
      details: {
        severity: 'medium',
        changeType: 'layout'
      }
    };
  }

  /**
   * レイアウト崩壊を検出
   */
  private detectLayoutBreakdown(comparison: LayoutComparisonResult): LayoutDifference[] | null {
    const majorPositionChanges = comparison.differences.filter(diff => {
      if (diff.type !== 'modified' || !diff.changes) return false;
      
      // 位置変更を検出
      const posChangeX = diff.changes.find(c => c.property === 'x');
      const posChangeY = diff.changes.find(c => c.property === 'y');
      
      // 大幅な位置変更（100px以上）
      if (posChangeX || posChangeY) {
        const xDiff = posChangeX ? Math.abs(Number(posChangeX.after) - Number(posChangeX.before)) : 0;
        const yDiff = posChangeY ? Math.abs(Number(posChangeY.after) - Number(posChangeY.before)) : 0;
        if (xDiff > 100 || yDiff > 100) {
          return true;
        }
      }
      
      // サイズ変更を検出
      const widthChange = diff.changes.find(c => c.property === 'width');
      const heightChange = diff.changes.find(c => c.property === 'height');
      
      // 大幅なサイズ変更（50%以上）
      if (widthChange || heightChange) {
        if (widthChange) {
          const widthRatio = Math.abs(Number(widthChange.after) - Number(widthChange.before)) / (Number(widthChange.before) || 1);
          if (widthRatio > 0.5) return true;
        }
        if (heightChange) {
          const heightRatio = Math.abs(Number(heightChange.after) - Number(heightChange.before)) / (Number(heightChange.before) || 1);
          if (heightRatio > 0.5) return true;
        }
      }
      
      return false;
    });

    return majorPositionChanges.length > 3 ? majorPositionChanges : null;
  }

  /**
   * レイアウト崩壊を分析
   */
  private analyzeLayoutBreakdown(
    breakdownElements: LayoutDifference[],
    comparison: LayoutComparisonResult
  ): ErrorAnalysis {
    return {
      errorType: ErrorType.BROKEN,
      confidence: 0.9,
      reasoning: 'Layout breakdown detected - multiple elements have significant position/size changes',
      affectedElements: breakdownElements.map(e => e.path),
      suggestedAction: WorkflowAction.STOP,
      details: {
        severity: 'critical',
        changeType: 'layout',
        metrics: {
          affectedElementCount: breakdownElements.length,
          totalElementCount: (comparison.summary.added + comparison.summary.removed + comparison.summary.modified + comparison.summary.moved)
        }
      }
    };
  }

  /**
   * 確率的な変更を検出
   */
  private detectStochasticChanges(
    comparison: LayoutComparisonResult,
    context: AnalysisContext
  ): LayoutDifference[] | null {
    const stochasticPatterns = [
      /advertisement|ad-|banner|carousel|random|dynamic/i,
      /timestamp|date|time/i,
      /user-generated|comment|review/i
    ];

    const stochasticElements = comparison.differences.filter(diff => {
      // パスやクラス名から確率的要素を検出
      return stochasticPatterns.some(pattern => 
        pattern.test(diff.path) || 
        (diff.element && 'className' in diff.element && pattern.test(diff.element.className))
      );
    });

    // 前回の分析で確率的と判定された要素
    if (context.previousAnalysis?.type === ErrorType.STOCHASTIC) {
      const previousElements = new Set(context.previousAnalysis.affectedElements);
      const matchingElements = comparison.differences.filter(diff => 
        previousElements.has(diff.path)
      );
      
      if (matchingElements.length > 0) {
        return matchingElements;
      }
    }

    return stochasticElements.length > 0 ? stochasticElements : null;
  }

  /**
   * 確率的な変更を分析
   */
  private analyzeStochasticChanges(
    stochasticElements: LayoutDifference[],
    comparison: LayoutComparisonResult
  ): ErrorAnalysis {
    return {
      errorType: ErrorType.STOCHASTIC,
      confidence: 0.85,
      reasoning: 'Stochastic content changes detected (ads, timestamps, dynamic content)',
      affectedElements: stochasticElements.map(e => e.path),
      suggestedAction: WorkflowAction.IGNORE_ELEMENT,
      details: {
        severity: 'low',
        changeType: 'content',
        selectors: stochasticElements.map(e => e.path)
      }
    };
  }

  /**
   * 意味のある変更を検出
   */
  private detectMeaningfulChanges(comparison: LayoutComparisonResult): LayoutDifference[] | null {
    const meaningfulChanges = comparison.differences.filter(diff => {
      // 新しい要素の追加
      if (diff.type === 'added') return true;
      
      // テキストコンテンツの変更
      if (diff.type === 'modified' && diff.changes?.some(c => c.property === 'text')) return true;
      
      // スタイルの意図的な変更（色、フォントなど）
      if (diff.type === 'modified' && diff.changes) {
        const styleChanges = diff.changes.filter(c => 
          ['color', 'backgroundColor', 'fontSize', 'fontFamily'].includes(c.property)
        );
        return styleChanges.length > 0;
      }
      
      return false;
    });

    return meaningfulChanges.length > 0 ? meaningfulChanges : null;
  }

  /**
   * 意味のある変更を分析
   */
  private analyzeMeaningfulChanges(
    meaningfulChanges: LayoutDifference[],
    comparison: LayoutComparisonResult
  ): ErrorAnalysis {
    const hasNewFeatures = meaningfulChanges.some(c => c.type === 'added');
    const hasContentUpdates = meaningfulChanges.some(c => 
      c.type === 'modified' && c.changes?.some(ch => ch.property === 'text')
    );

    return {
      errorType: ErrorType.MEANINGFUL_CHANGE,
      confidence: 0.75,
      reasoning: hasNewFeatures 
        ? 'New features or content added to the page'
        : 'Content or style updates detected',
      affectedElements: meaningfulChanges.map(e => e.path),
      suggestedAction: WorkflowAction.UPDATE_BASELINE,
      details: {
        severity: 'medium',
        changeType: hasContentUpdates ? 'content' : 'style',
        metrics: {
          addedElements: meaningfulChanges.filter(c => c.type === 'added').length,
          modifiedElements: meaningfulChanges.filter(c => c.type === 'modified').length
        }
      }
    };
  }

  /**
   * 重要な要素かどうかを判定
   */
  private isCriticalElement(path: string): boolean {
    const criticalPatterns = [
      /header|nav|navigation|menu/i,
      /login|signin|auth/i,
      /checkout|cart|payment/i,
      /submit|button|cta/i,
      /main|content|article/i
    ];

    return criticalPatterns.some(pattern => pattern.test(path));
  }

  /**
   * 変更の重要度を計算
   */
  private calculateSeverity(comparison: LayoutComparisonResult): 'low' | 'medium' | 'high' | 'critical' {
    const totalChanges = comparison.summary.added + comparison.summary.removed + 
                         comparison.summary.modified + comparison.summary.moved;
    const estimatedTotalElements = totalChanges + 20; // 推定値
    const changeRatio = comparison.differences.length / estimatedTotalElements;
    
    if (changeRatio > 0.5) return 'critical';
    if (changeRatio > 0.3) return 'high';
    if (changeRatio > 0.1) return 'medium';
    return 'low';
  }

  /**
   * パターンベースの分析
   */
  analyzeWithPatterns(
    comparison: LayoutComparisonResult,
    patterns: AnalysisPattern[]
  ): ErrorAnalysis | null {
    for (const pattern of patterns) {
      if (pattern.matches(comparison)) {
        return pattern.analyze(comparison);
      }
    }
    return null;
  }
}

/**
 * 分析パターンのインターフェース
 */
export interface AnalysisPattern {
  name: string;
  matches(comparison: LayoutComparisonResult): boolean;
  analyze(comparison: LayoutComparisonResult): ErrorAnalysis;
}

/**
 * デフォルトのエラー分析器インスタンス
 */
export const defaultErrorAnalyzer = new ErrorAnalyzer();