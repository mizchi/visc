/**
 * バリデーターファクトリーとプリセット
 */

import type { Validator, ValidatorConfig, ValidatorChain } from './types.js';
import { 
  LayoutStructureValidator, 
  LayoutVisualValidator, 
  LayoutStabilityValidator 
} from './layout-validator.js';
import { 
  createPixelmatchValidator,
  createRegionPixelmatchValidator,
  createAnimationDetectorValidator,
  createSmartPixelmatchValidator
} from './pixelmatch-validator.js';
import { 
  AIPixelmatchValidator,
  AIPatternLearningValidator 
} from './ai-pixelmatch-validator.js';
import { 
  AIImageComparisonValidator,
  AIResponsiveValidator 
} from './ai-image-validator.js';
import { ValidatorChainBuilder } from './validator-chain.js';

/**
 * バリデータープリセット
 */
export enum ValidatorPreset {
  /** 厳密な比較（ピクセル単位） */
  STRICT = 'strict',
  /** バランス型（レイアウト+画像） */
  BALANCED = 'balanced',
  /** レイアウト重視 */
  LAYOUT_FOCUSED = 'layout-focused',
  /** AI分析重視 */
  AI_ENHANCED = 'ai-enhanced',
  /** 高速チェック */
  FAST = 'fast',
  /** カスタム */
  CUSTOM = 'custom'
}

/**
 * バリデーターファクトリー
 */
export class ValidatorFactory {
  constructor(private config: ValidatorConfig = {}) {}
  
  /**
   * プリセットからバリデーターチェーンを作成
   */
  createFromPreset(preset: ValidatorPreset): ValidatorChain {
    switch (preset) {
      case ValidatorPreset.STRICT:
        return this.createStrictChain();
        
      case ValidatorPreset.BALANCED:
        return this.createBalancedChain();
        
      case ValidatorPreset.LAYOUT_FOCUSED:
        return this.createLayoutFocusedChain();
        
      case ValidatorPreset.AI_ENHANCED:
        return this.createAIEnhancedChain();
        
      case ValidatorPreset.FAST:
        return this.createFastChain();
        
      default:
        return new ValidatorChainBuilder().build();
    }
  }
  
  /**
   * 厳密な比較チェーン
   */
  private createStrictChain(): ValidatorChain {
    const builder = new ValidatorChainBuilder('sequential');
    
    // Pixelmatch（非常に厳しい閾値）
    builder.add(createPixelmatchValidator(0.0001)); // 0.01%
    
    // レイアウト構造（完全一致）
    builder.add(new LayoutStructureValidator(1.0));
    
    // AI画像比較（厳密モード）
    if (this.config.enableAI && this.config.aiProvider) {
      builder.add(new AIImageComparisonValidator(
        this.config.aiProvider,
        { comparisonMode: 'strict' }
      ));
    }
    
    return builder.build();
  }
  
  /**
   * バランス型チェーン
   */
  private createBalancedChain(): ValidatorChain {
    const builder = new ValidatorChainBuilder('weighted');
    
    // レイアウト構造（重み: 高）
    builder.addWeighted(
      new LayoutStructureValidator(0.95),
      2.0
    );
    
    // 視覚的類似度（重み: 中）
    builder.addWeighted(
      new LayoutVisualValidator(0.90),
      1.5
    );
    
    // Pixelmatch（重み: 低）
    builder.addWeighted(
      createPixelmatchValidator(0.01), // 1%
      1.0
    );
    
    // AI分析（重み: 中）
    if (this.config.enableAI && this.config.aiProvider) {
      builder.addWeighted(
        new AIImageComparisonValidator(
          this.config.aiProvider,
          { comparisonMode: 'layout' }
        ),
        1.5
      );
    }
    
    return builder.build();
  }
  
  /**
   * レイアウト重視チェーン
   */
  private createLayoutFocusedChain(): ValidatorChain {
    const builder = new ValidatorChainBuilder('sequential');
    
    // レイアウト構造
    builder.add(new LayoutStructureValidator(0.90));
    
    // 視覚的類似度（DOM構造無視）
    builder.add(new LayoutVisualValidator(0.85, {
      ignoreColors: true,
      ignoreTextContent: true
    }));
    
    // アニメーション検出
    builder.add(createAnimationDetectorValidator());
    
    return builder.build();
  }
  
  /**
   * AI強化チェーン
   */
  private createAIEnhancedChain(): ValidatorChain {
    if (!this.config.enableAI || !this.config.aiProvider) {
      throw new Error('AI provider configuration required for AI-enhanced preset');
    }
    
    const builder = new ValidatorChainBuilder('conditional');
    
    // 基本的なPixelmatchチェック
    builder.add(createPixelmatchValidator(0.05)); // 5%
    
    // Pixelmatchで差分が検出された場合のみAI分析
    builder.addIf(
      new AIPixelmatchValidator(this.config.aiProvider),
      (input: any) => {
        if ('pixelDifference' in input) {
          const diffPercentage = input.pixelDifference / input.totalPixels;
          return diffPercentage > 0.001; // 0.1%以上の差分
        }
        return false;
      }
    );
    
    // AI画像比較
    builder.add(new AIImageComparisonValidator(
      this.config.aiProvider,
      { comparisonMode: 'layout' }
    ));
    
    // パターン学習（履歴がある場合）
    builder.addIf(
      new AIPatternLearningValidator(this.config.aiProvider),
      (input: any) => 'history' in input && input.history.length > 0
    );
    
    return builder.build();
  }
  
  /**
   * 高速チェーンチェーン
   */
  private createFastChain(): ValidatorChain {
    const builder = new ValidatorChainBuilder('sequential');
    
    // レイアウト視覚的類似度のみ（最も高速）
    builder.add(new LayoutVisualValidator(0.80, {
      ignoreColors: true,
      positionTolerance: 10
    }));
    
    // 大きな差分のみ検出
    builder.add(createPixelmatchValidator(0.1)); // 10%
    
    return builder.build();
  }
  
  /**
   * 個別のバリデーターを作成
   */
  createValidator(type: string, options?: any): Validator {
    switch (type) {
      case 'layout-structure':
        return new LayoutStructureValidator(
          options?.threshold || 0.95,
          options
        );
        
      case 'layout-visual':
        return new LayoutVisualValidator(
          options?.threshold || 0.90,
          options
        );
        
      case 'layout-stability':
        return new LayoutStabilityValidator(
          options?.stabilityThreshold || 0.98,
          options?.minSamples || 3
        );
        
      case 'pixelmatch':
        return createPixelmatchValidator(
          options?.threshold || 0.001,
          options
        );
        
      case 'region-pixelmatch':
        return createRegionPixelmatchValidator(
          options?.defaultThreshold || 0.001
        );
        
      case 'animation-detector':
        return createAnimationDetectorValidator(
          options?.animationThreshold || 0.05
        );
        
      case 'ai-pixelmatch':
        if (!this.config.aiProvider) {
          throw new Error('AI provider required for ai-pixelmatch validator');
        }
        return new AIPixelmatchValidator(
          this.config.aiProvider,
          options
        );
        
      case 'ai-pattern-learning':
        if (!this.config.aiProvider) {
          throw new Error('AI provider required for ai-pattern-learning validator');
        }
        return new AIPatternLearningValidator(
          this.config.aiProvider
        );
        
      case 'ai-image-comparison':
        if (!this.config.aiProvider) {
          throw new Error('AI provider required for ai-image-comparison validator');
        }
        return new AIImageComparisonValidator(
          this.config.aiProvider,
          options
        );
        
      case 'ai-responsive':
        if (!this.config.aiProvider) {
          throw new Error('AI provider required for ai-responsive validator');
        }
        return new AIResponsiveValidator(
          this.config.aiProvider
        );
        
      default:
        throw new Error(`Unknown validator type: ${type}`);
    }
  }
  
  /**
   * カスタムチェーンビルダーを作成
   */
  createChainBuilder(
    type: 'sequential' | 'conditional' | 'weighted' = 'sequential'
  ): ValidatorChainBuilder {
    return new ValidatorChainBuilder(type);
  }
}

/**
 * デフォルトのバリデーターファクトリーを取得
 */
export function getDefaultValidatorFactory(): ValidatorFactory {
  return new ValidatorFactory();
}