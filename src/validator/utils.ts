/**
 * バリデーターユーティリティ関数
 */

import type { 
  Validator, 
  ValidatorChain, 
  ValidationResult, 
  ValidationContext,
  ValidatorConfig,
  LayoutValidatorInput,
  ImageValidatorInput,
  PixelmatchValidatorInput
} from './types.js';
import { ValidatorFactory, ValidatorPreset } from './validator-factory.js';
import { ErrorType, WorkflowAction } from '../workflow/types.js';

/**
 * バリデーションパイプラインを作成
 */
export function createValidationPipeline(
  preset: ValidatorPreset | ValidatorChain,
  config?: ValidatorConfig
): (input: any, context: ValidationContext) => Promise<ValidationPipelineResult> {
  const factory = new ValidatorFactory(config);
  const chain = typeof preset === 'string' 
    ? factory.createFromPreset(preset)
    : preset;
  
  return async (input: any, context: ValidationContext) => {
    const results = await chain.validateAll(input, context);
    return analyzeValidationResults(results);
  };
}

/**
 * バリデーション結果の分析
 */
export interface ValidationPipelineResult {
  /** 全体の合格/不合格 */
  passed: boolean;
  /** 全体の信頼度 */
  overallConfidence: number;
  /** 個別の結果 */
  results: ValidationResult[];
  /** サマリー */
  summary: {
    totalValidators: number;
    passedValidators: number;
    failedValidators: number;
    averageConfidence: number;
  };
  /** 推奨アクション */
  recommendedAction: WorkflowAction;
  /** 主要なエラータイプ */
  primaryErrorType?: ErrorType;
}

function analyzeValidationResults(results: ValidationResult[]): ValidationPipelineResult {
  const passed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
  const averageConfidence = results.length > 0 ? totalConfidence / results.length : 0;
  
  // エラータイプの集計
  const errorTypes = results
    .filter(r => !r.passed && r.errorType)
    .map(r => r.errorType!);
  
  // 最も深刻なエラータイプを選択
  let primaryErrorType: ErrorType | undefined;
  if (errorTypes.includes(ErrorType.BROKEN)) {
    primaryErrorType = ErrorType.BROKEN;
  } else if (errorTypes.includes(ErrorType.MEANINGFUL_CHANGE)) {
    primaryErrorType = ErrorType.MEANINGFUL_CHANGE;
  } else if (errorTypes.includes(ErrorType.STOCHASTIC)) {
    primaryErrorType = ErrorType.STOCHASTIC;
  } else if (errorTypes.includes(ErrorType.UNKNOWN)) {
    primaryErrorType = ErrorType.UNKNOWN;
  }
  
  // 推奨アクションを決定
  const suggestedActions = results
    .filter(r => !r.passed && r.suggestedAction)
    .map(r => r.suggestedAction!);
  
  let recommendedAction: WorkflowAction;
  if (passed) {
    recommendedAction = WorkflowAction.CONTINUE;
  } else if (suggestedActions.includes(WorkflowAction.STOP)) {
    recommendedAction = WorkflowAction.STOP;
  } else if (suggestedActions.includes(WorkflowAction.UPDATE_BASELINE)) {
    recommendedAction = WorkflowAction.UPDATE_BASELINE;
  } else if (suggestedActions.includes(WorkflowAction.MANUAL_REVIEW)) {
    recommendedAction = WorkflowAction.MANUAL_REVIEW;
  } else if (suggestedActions.includes(WorkflowAction.RETRY)) {
    recommendedAction = WorkflowAction.RETRY;
  } else if (suggestedActions.includes(WorkflowAction.IGNORE_ELEMENT)) {
    recommendedAction = WorkflowAction.IGNORE_ELEMENT;
  } else {
    recommendedAction = WorkflowAction.CONTINUE;
  }
  
  return {
    passed,
    overallConfidence: averageConfidence,
    results,
    summary: {
      totalValidators: results.length,
      passedValidators: passedCount,
      failedValidators: results.length - passedCount,
      averageConfidence
    },
    recommendedAction,
    primaryErrorType
  };
}

/**
 * バリデーション結果をフォーマット
 */
export function formatValidationResults(
  pipelineResult: ValidationPipelineResult,
  options: {
    verbose?: boolean;
    includeDetails?: boolean;
    colorize?: boolean;
  } = {}
): string {
  const { verbose = false, includeDetails = false, colorize = false } = options;
  
  let output = '';
  
  // ヘッダー
  const status = pipelineResult.passed ? '✅ PASSED' : '❌ FAILED';
  output += `${status} - 信頼度: ${(pipelineResult.overallConfidence * 100).toFixed(1)}%\n`;
  output += `${pipelineResult.summary.passedValidators}/${pipelineResult.summary.totalValidators} バリデーターが成功\n`;
  
  if (pipelineResult.primaryErrorType) {
    output += `主要なエラータイプ: ${pipelineResult.primaryErrorType}\n`;
  }
  
  output += `推奨アクション: ${pipelineResult.recommendedAction}\n\n`;
  
  // 個別の結果
  if (verbose) {
    output += '詳細結果:\n';
    for (const result of pipelineResult.results) {
      const icon = result.passed ? '✓' : '✗';
      output += `${icon} ${result.validatorName}: ${result.message}\n`;
      
      if (includeDetails && result.details) {
        output += `  詳細: ${JSON.stringify(result.details, null, 2)}\n`;
      }
    }
  }
  
  return output;
}

/**
 * レイアウトとPixelmatch結果を組み合わせた検証
 */
export async function validateCombined(
  layoutInput: LayoutValidatorInput,
  pixelmatchInput: PixelmatchValidatorInput,
  context: ValidationContext,
  config?: ValidatorConfig
): Promise<ValidationPipelineResult> {
  const factory = new ValidatorFactory(config);
  const builder = factory.createChainBuilder('weighted');
  
  // レイアウト構造（重み: 高）
  builder.addWeighted(
    factory.createValidator('layout-structure', { threshold: 0.95 }),
    2.0
  );
  
  // Pixelmatch（重み: 中）
  builder.addWeighted(
    factory.createValidator('pixelmatch', { threshold: 0.01 }),
    1.0
  );
  
  // AI分析（設定されている場合）
  if (config?.enableAI && config.aiProvider) {
    builder.addWeighted(
      factory.createValidator('ai-pixelmatch'),
      1.5
    );
  }
  
  const chain = builder.build();
  
  // 両方の入力を組み合わせる
  const combinedInput = {
    ...layoutInput,
    ...pixelmatchInput
  };
  
  const results = await chain.validateAll(combinedInput, context);
  return analyzeValidationResults(results);
}

/**
 * 複数のスナップショットから安定性を検証
 */
export async function validateStability(
  snapshots: Array<{
    layout: LayoutValidatorInput;
    pixelmatch?: PixelmatchValidatorInput;
  }>,
  context: ValidationContext,
  config?: ValidatorConfig
): Promise<ValidationPipelineResult> {
  const factory = new ValidatorFactory(config);
  
  // レイアウトの安定性をチェック
  const stabilityValidator = factory.createValidator('layout-stability', {
    stabilityThreshold: 0.98,
    minSamples: snapshots.length
  });
  
  const layoutInputs = snapshots.map(s => s.layout);
  const result = await stabilityValidator.validate(layoutInputs, context);
  
  return analyzeValidationResults([result]);
}