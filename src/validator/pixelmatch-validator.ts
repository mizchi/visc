/**
 * Pixelmatchベースのバリデーター関数
 */

import type { 
  Validator, 
  PixelmatchValidatorInput, 
  ImageValidatorInput,
  ValidationResult, 
  ValidationContext 
} from './types.js';
import { ErrorType, WorkflowAction } from '../workflow/types.js';
import { executePixelmatch, executeRegionPixelmatch } from './pixelmatch-executor.js';

/**
 * 基本的なPixelmatchバリデーターを作成
 */
export function createPixelmatchValidator(
  threshold: number = 0.001, // 0.1%のピクセル差分まで許容
  options: {
    ignoreAntialiasing?: boolean;
    ignoreColors?: boolean;
  } = {}
): Validator<PixelmatchValidatorInput> {
  return {
    name: 'pixelmatch',
    
    async validate(
      input: PixelmatchValidatorInput,
      _context: ValidationContext
    ): Promise<ValidationResult> {
      // 既に計算済みの場合はその値を使用
      let diffPercentage: number;
      let pixelDifference: number | undefined;
      let totalPixels: number | undefined;
      
      if ('pixelDifference' in input && 'totalPixels' in input) {
        pixelDifference = (input as PixelmatchValidatorInput).pixelDifference;
        totalPixels = (input as PixelmatchValidatorInput).totalPixels;
        diffPercentage = pixelDifference / totalPixels;
      } else {
        // 実際にPixelmatchを実行
        const result = executePixelmatch(
          (input as ImageValidatorInput).baselineImage,
          (input as ImageValidatorInput).currentImage,
          {
            threshold: options.ignoreAntialiasing ? 0.1 : 0,
            includeAA: !options.ignoreAntialiasing,
            outputDiffPath: typeof (input as ImageValidatorInput).diffImage === 'string' ? (input as ImageValidatorInput).diffImage as string : undefined
          }
        );
        diffPercentage = result.diffPercentage;
        pixelDifference = result.diffPixels;
        totalPixels = result.totalPixels;
      }
      
      const actualThreshold = (input as PixelmatchValidatorInput).threshold ?? threshold;
      
      if (diffPercentage <= actualThreshold) {
        return {
          passed: true,
          validatorName: 'pixelmatch',
          confidence: 1 - diffPercentage,
          message: `画像は${(100 - diffPercentage * 100).toFixed(2)}%一致しています`,
          details: {
            pixelDifference,
            totalPixels,
            diffPercentage,
            threshold: actualThreshold
          }
        };
      }
      
      // 差分の大きさに基づいてエラータイプを判定
      let errorType: ErrorType;
      let message: string;
      let suggestedAction: WorkflowAction;
      
      if (diffPercentage > 0.5) {
        // 50%以上の差分は明らかに壊れている
        errorType = ErrorType.BROKEN;
        message = `画像が大幅に異なります (${(diffPercentage * 100).toFixed(1)}%の差分)`;
        suggestedAction = WorkflowAction.STOP;
      } else if (diffPercentage > 0.1) {
        // 10%以上の差分は意味のある変更
        errorType = ErrorType.MEANINGFUL_CHANGE;
        message = `画像に大きな変更があります (${(diffPercentage * 100).toFixed(1)}%の差分)`;
        suggestedAction = WorkflowAction.UPDATE_BASELINE;
      } else if (diffPercentage > 0.01) {
        // 1%以上の差分は確認が必要
        errorType = ErrorType.UNKNOWN;
        message = `画像に変更があります (${(diffPercentage * 100).toFixed(2)}%の差分)`;
        suggestedAction = WorkflowAction.MANUAL_REVIEW;
      } else {
        // 小さな差分
        errorType = ErrorType.STOCHASTIC;
        message = `画像にわずかな差分があります (${(diffPercentage * 100).toFixed(3)}%の差分)`;
        suggestedAction = WorkflowAction.RETRY;
      }
      
      return {
        passed: false,
        validatorName: 'pixelmatch',
        confidence: diffPercentage,
        message,
        errorType,
        suggestedAction,
        details: {
          pixelDifference,
          totalPixels,
          diffPercentage,
          threshold: actualThreshold
        }
      };
    }
  };
}

/**
 * 領域ごとのPixelmatchバリデーターを作成
 */
export function createRegionPixelmatchValidator(
  defaultThreshold: number = 0.001
): Validator<PixelmatchValidatorInput & {
  regions: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    pixelDifference?: number;
    threshold?: number;
  }>;
}> {
  return {
    name: 'region-pixelmatch',
    
    async validate(
      input: PixelmatchValidatorInput & { regions: any[] },
      _context: ValidationContext
    ): Promise<ValidationResult> {
      const failedRegions: string[] = [];
      const regionResults: any[] = [];
      
      // 既に計算済みの場合
      if (input.regions.every(r => r.pixelDifference !== undefined)) {
        for (const region of input.regions) {
          const regionPixels = region.width * region.height;
          const diffPercentage = region.pixelDifference! / regionPixels;
          const threshold = region.threshold ?? defaultThreshold;
          
          const passed = diffPercentage <= threshold;
          
          regionResults.push({
            name: region.name,
            passed,
            diffPercentage,
            threshold
          });
          
          if (!passed) {
            failedRegions.push(region.name);
          }
        }
      } else {
        // 実際にPixelmatchを実行
        const results = executeRegionPixelmatch(
          input.baselineImage,
          input.currentImage,
          input.regions
        );
        
        for (const { region, result } of results) {
          const threshold = (region as any).threshold ?? defaultThreshold;
          const passed = result.diffPercentage <= threshold;
          
          regionResults.push({
            name: region.name,
            passed,
            diffPercentage: result.diffPercentage,
            threshold
          });
          
          if (!passed) {
            failedRegions.push(region.name);
          }
        }
      }
      
      const passed = failedRegions.length === 0;
      const confidence = passed ? 1 : 0.5;
      
      if (passed) {
        return {
          passed: true,
          validatorName: 'region-pixelmatch',
          confidence,
          message: 'すべての領域が一致しています',
          details: {
            regionResults,
            totalRegions: input.regions.length
          }
        };
      }
      
      // 失敗した領域の分析
      const criticalRegions = ['header', 'navigation', 'main-content'];
      const hasCriticalFailure = failedRegions.some(r => 
        criticalRegions.some(cr => r.toLowerCase().includes(cr))
      );
      
      const errorType = hasCriticalFailure ? ErrorType.BROKEN : ErrorType.MEANINGFUL_CHANGE;
      
      return {
        passed: false,
        validatorName: 'region-pixelmatch',
        confidence,
        message: `${failedRegions.length}個の領域で差分が検出されました: ${failedRegions.join(', ')}`,
        errorType,
        suggestedAction: hasCriticalFailure ? WorkflowAction.STOP : WorkflowAction.MANUAL_REVIEW,
        details: {
          failedRegions,
          regionResults,
          totalRegions: input.regions.length
        }
      };
    }
  };
}

/**
 * アニメーション検出バリデーターを作成
 */
export function createAnimationDetectorValidator(
  animationThreshold: number = 0.05 // 5%以上の変化をアニメーションとして検出
): Validator<{
  snapshots: Array<{
    baselineImage: string | Buffer;
    currentImage: string | Buffer;
    timestamp: number;
  }>;
  interval: number; // ミリ秒
}> {
  return {
    name: 'animation-detector',
    
    async validate(
      input: { snapshots: any[]; interval: number },
      _context: ValidationContext
    ): Promise<ValidationResult> {
      if (input.snapshots.length < 2) {
        return {
          passed: false,
          validatorName: 'animation-detector',
          confidence: 0,
          message: 'アニメーション検出には最低2枚のスナップショットが必要です',
          details: {
            providedSnapshots: input.snapshots.length
          }
        };
      }
      
      // 連続するスナップショット間の差分を分析
      const changes: number[] = [];
      let hasSignificantChange = false;
      
      for (let i = 0; i < input.snapshots.length - 1; i++) {
        const current = input.snapshots[i];
        const next = input.snapshots[i + 1];
        
        const result = executePixelmatch(
          current.baselineImage,
          next.currentImage
        );
        
        changes.push(result.diffPercentage);
        
        if (result.diffPercentage > animationThreshold) {
          hasSignificantChange = true;
        }
      }
      
      // 変化のパターンを分析
      const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
      const isAnimation = hasSignificantChange && avgChange > 0.01;
      
      if (isAnimation) {
        return {
          passed: false,
          validatorName: 'animation-detector',
          confidence: 0.8,
          message: 'ページにアニメーションが検出されました',
          errorType: ErrorType.STOCHASTIC,
          suggestedAction: WorkflowAction.IGNORE_ELEMENT,
          details: {
            detectedAnimation: true,
            averageChange: avgChange,
            changes,
            interval: input.interval,
            recommendation: 'アニメーション要素を無視リストに追加することを推奨'
          }
        };
      }
      
      return {
        passed: true,
        validatorName: 'animation-detector',
        confidence: 0.9,
        message: 'アニメーションは検出されませんでした',
        details: {
          detectedAnimation: false,
          averageChange: avgChange,
          changes,
          interval: input.interval
        }
      };
    }
  };
}

/**
 * スマートPixelmatchバリデーターを作成
 * 差分の位置や種類を分析して、より適切な判定を行う
 */
export function createSmartPixelmatchValidator(
  options: {
    threshold?: number;
    ignoredRegions?: Array<{ x: number; y: number; width: number; height: number }>;
    focusRegions?: Array<{ name: string; x: number; y: number; width: number; height: number; weight: number }>;
  } = {}
): Validator<PixelmatchValidatorInput> {
  return {
    name: 'smart-pixelmatch',
    
    async validate(
      input: PixelmatchValidatorInput,
      _context: ValidationContext
    ): Promise<ValidationResult> {
      // 全体のPixelmatchを実行
      const overallResult = executePixelmatch(
        input.baselineImage,
        input.currentImage,
        {
          threshold: 0.1,
          outputDiffPath: typeof input.diffImage === 'string' ? input.diffImage : undefined
        }
      );
      
      // フォーカス領域がある場合は重み付き評価
      if (options.focusRegions && options.focusRegions.length > 0) {
        const regionResults = executeRegionPixelmatch(
          input.baselineImage,
          input.currentImage,
          options.focusRegions
        );
        
        // 重み付きスコアを計算
        let weightedScore = 0;
        let totalWeight = 0;
        const failedCriticalRegions: string[] = [];
        
        for (let i = 0; i < options.focusRegions.length; i++) {
          const region = options.focusRegions[i];
          const result = regionResults[i].result;
          const weight = region.weight;
          
          totalWeight += weight;
          
          if (result.diffPercentage <= (options.threshold ?? 0.01)) {
            weightedScore += weight;
          } else if (weight > 0.5) {
            // 重要な領域での失敗
            failedCriticalRegions.push(region.name);
          }
        }
        
        const normalizedScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
        
        if (failedCriticalRegions.length > 0) {
          return {
            passed: false,
            validatorName: 'smart-pixelmatch',
            confidence: 0.8,
            message: `重要な領域で差分が検出されました: ${failedCriticalRegions.join(', ')}`,
            errorType: ErrorType.BROKEN,
            suggestedAction: WorkflowAction.STOP,
            details: {
              overallDifference: overallResult.diffPercentage,
              weightedScore: normalizedScore,
              failedCriticalRegions,
              regionResults: regionResults.map((r, i) => ({
                name: options.focusRegions![i].name,
                diffPercentage: r.result.diffPercentage,
                weight: options.focusRegions![i].weight
              }))
            }
          };
        }
        
        if (normalizedScore >= 0.9) {
          return {
            passed: true,
            validatorName: 'smart-pixelmatch',
            confidence: normalizedScore,
            message: `重要な領域は${(normalizedScore * 100).toFixed(1)}%一致しています`,
            details: {
              overallDifference: overallResult.diffPercentage,
              weightedScore: normalizedScore
            }
          };
        }
      }
      
      // 通常のPixelmatch判定にフォールバック
      const threshold = options.threshold ?? 0.01;
      if (overallResult.diffPercentage <= threshold) {
        return {
          passed: true,
          validatorName: 'smart-pixelmatch',
          confidence: 1 - overallResult.diffPercentage,
          message: `画像は${(100 - overallResult.diffPercentage * 100).toFixed(2)}%一致しています`,
          details: overallResult
        };
      }
      
      return {
        passed: false,
        validatorName: 'smart-pixelmatch',
        confidence: overallResult.diffPercentage,
        message: `画像に${(overallResult.diffPercentage * 100).toFixed(2)}%の差分があります`,
        errorType: overallResult.diffPercentage > 0.1 ? ErrorType.MEANINGFUL_CHANGE : ErrorType.UNKNOWN,
        suggestedAction: WorkflowAction.MANUAL_REVIEW,
        details: overallResult
      };
    }
  };
}

// 以前のクラスベースAPIとの互換性のため
export { createPixelmatchValidator as PixelmatchValidator };
export { createRegionPixelmatchValidator as RegionPixelmatchValidator };
export { createAnimationDetectorValidator as AnimationDetectorValidator };