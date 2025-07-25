/**
 * レイアウト差分バリデーター
 */

import type { 
  Validator, 
  LayoutValidatorInput, 
  ValidationResult, 
  ValidationContext 
} from './types.js';
import { compareLayouts } from '../layout/comparator.js';
import { calculateLayoutSimilarity } from '../layout/rect-distance.js';
import { calculateVisualSimilarity } from '../layout/rect-distance-visual.js';
import { ErrorType, WorkflowAction } from '../workflow/types.js';
import { toExtendedComparisonResult } from '../workflow/extended-types.js';

/**
 * レイアウト構造バリデーター
 */
export class LayoutStructureValidator implements Validator<LayoutValidatorInput> {
  name = 'layout-structure';
  
  constructor(
    private threshold: number = 0.95,
    private options: {
      checkMissingElements?: boolean;
      checkUnexpectedElements?: boolean;
      checkStructureOnly?: boolean;
    } = {}
  ) {}

  async validate(
    input: LayoutValidatorInput,
    context: ValidationContext
  ): Promise<ValidationResult> {
    const baseComparison = input.comparison || compareLayouts(input.baseline, input.current);
    const comparison = toExtendedComparisonResult(baseComparison);
    
    // 構造の類似度をチェック
    const structuralSimilarity = comparison.similarities.structure;
    
    if (structuralSimilarity >= this.threshold) {
      return {
        passed: true,
        validatorName: this.name,
        confidence: structuralSimilarity,
        message: `レイアウト構造は${(structuralSimilarity * 100).toFixed(1)}%一致しています`,
        details: {
          structuralSimilarity,
          threshold: this.threshold
        }
      };
    }
    
    // 失敗の詳細を分析
    const missingCount = comparison.elementsComparison.missing.length;
    const unexpectedCount = comparison.elementsComparison.unexpected.length;
    
    let errorType: ErrorType = ErrorType.UNKNOWN;
    let message = `レイアウト構造が異なります (類似度: ${(structuralSimilarity * 100).toFixed(1)}%)`;
    
    if (missingCount > 5) {
      errorType = ErrorType.BROKEN;
      message = `${missingCount}個の重要な要素が失われています`;
    } else if (unexpectedCount > missingCount * 2) {
      errorType = ErrorType.MEANINGFUL_CHANGE;
      message = `新しい要素が${unexpectedCount}個追加されています（意図的な変更の可能性）`;
    }
    
    return {
      passed: false,
      validatorName: this.name,
      confidence: 1 - structuralSimilarity,
      message,
      errorType,
      suggestedAction: this.determineSuggestedAction(errorType),
      details: {
        structuralSimilarity,
        threshold: this.threshold,
        missingElements: missingCount,
        unexpectedElements: unexpectedCount,
        comparison
      }
    };
  }
  
  private determineSuggestedAction(errorType: ErrorType): WorkflowAction {
    switch (errorType) {
      case ErrorType.BROKEN:
        return WorkflowAction.STOP;
      case ErrorType.MEANINGFUL_CHANGE:
        return WorkflowAction.UPDATE_BASELINE;
      default:
        return WorkflowAction.MANUAL_REVIEW;
    }
  }
}

/**
 * レイアウト視覚的類似度バリデーター
 */
export class LayoutVisualValidator implements Validator<LayoutValidatorInput> {
  name = 'layout-visual';
  
  constructor(
    private threshold: number = 0.90,
    private options: {
      ignoreColors?: boolean;
      ignoreTextContent?: boolean;
      positionTolerance?: number;
    } = {}
  ) {}

  async validate(
    input: LayoutValidatorInput,
    context: ValidationContext
  ): Promise<ValidationResult> {
    // DOM構造を無視して視覚的な類似度を計算
    const visualSimilarity = calculateVisualSimilarity(
      input.baseline.semanticGroups || [],
      input.current.semanticGroups || [],
      {
        positionWeight: 0.5,
        sizeWeight: 0.3,
        aspectRatioWeight: 0.2,
        viewport: context.viewport
      }
    );
    
    const similarity = visualSimilarity.similarity;
    
    if (similarity >= this.threshold) {
      return {
        passed: true,
        validatorName: this.name,
        confidence: similarity,
        message: `視覚的に${(similarity * 100).toFixed(1)}%類似しています`,
        details: {
          visualSimilarity: similarity,
          threshold: this.threshold,
          matchedElements: visualSimilarity.matchedElements,
          totalElements: visualSimilarity.totalElements
        }
      };
    }
    
    // 視覚的な差異を分析
    let message = `視覚的な差異が検出されました (類似度: ${(similarity * 100).toFixed(1)}%)`;
    let errorType = ErrorType.UNKNOWN;
    
    if (similarity < 0.5) {
      errorType = ErrorType.BROKEN;
      message = `レイアウトが大幅に変更されています`;
    } else if (similarity < 0.8) {
      errorType = ErrorType.MEANINGFUL_CHANGE;
      message = `デザインの更新が検出されました`;
    }
    
    return {
      passed: false,
      validatorName: this.name,
      confidence: 1 - similarity,
      message,
      errorType,
      suggestedAction: WorkflowAction.MANUAL_REVIEW,
      details: {
        visualSimilarity: similarity,
        threshold: this.threshold,
        matchedElements: visualSimilarity.matchedElements,
        totalElements: visualSimilarity.totalElements,
        unmatchedRects: visualSimilarity.unmatchedRects
      }
    };
  }
}

/**
 * レイアウトの安定性バリデーター
 */
export class LayoutStabilityValidator implements Validator<LayoutValidatorInput[]> {
  name = 'layout-stability';
  
  constructor(
    private stabilityThreshold: number = 0.98,
    private minSamples: number = 3
  ) {}

  async validate(
    inputs: LayoutValidatorInput[],
    context: ValidationContext
  ): Promise<ValidationResult> {
    if (inputs.length < this.minSamples) {
      return {
        passed: false,
        validatorName: this.name,
        confidence: 0,
        message: `安定性チェックには最低${this.minSamples}個のサンプルが必要です`,
        details: {
          providedSamples: inputs.length,
          requiredSamples: this.minSamples
        }
      };
    }
    
    // すべてのレイアウト間の類似度を計算
    const similarities: number[] = [];
    
    for (let i = 0; i < inputs.length - 1; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        const comparison = compareLayouts(
          inputs[i].current,
          inputs[j].current
        );
        similarities.push(comparison.similarity / 100); // 0-100を0-1に変換
      }
    }
    
    // 平均類似度を計算
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    const minSimilarity = Math.min(...similarities);
    
    if (minSimilarity >= this.stabilityThreshold) {
      return {
        passed: true,
        validatorName: this.name,
        confidence: avgSimilarity,
        message: `レイアウトは安定しています (最小類似度: ${(minSimilarity * 100).toFixed(1)}%)`,
        details: {
          averageSimilarity: avgSimilarity,
          minimumSimilarity: minSimilarity,
          samples: inputs.length,
          threshold: this.stabilityThreshold
        }
      };
    }
    
    // 不安定な要素を特定
    const errorType = minSimilarity < 0.9 ? ErrorType.STOCHASTIC : ErrorType.UNKNOWN;
    
    return {
      passed: false,
      validatorName: this.name,
      confidence: 1 - avgSimilarity,
      message: `レイアウトが不安定です (最小類似度: ${(minSimilarity * 100).toFixed(1)}%)`,
      errorType,
      suggestedAction: WorkflowAction.RETRY,
      details: {
        averageSimilarity: avgSimilarity,
        minimumSimilarity: minSimilarity,
        samples: inputs.length,
        threshold: this.stabilityThreshold,
        similarities
      }
    };
  }
}