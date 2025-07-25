/**
 * バリデーターシステムの型定義
 */

import type { LayoutAnalysisResult } from '../layout/extractor.js';
import type { LayoutComparisonResult } from '../layout/comparator.js';
import type { ErrorType, WorkflowAction } from '../workflow/types.js';

/**
 * バリデーション結果
 */
export interface ValidationResult {
  /** バリデーションが成功したか */
  passed: boolean;
  /** バリデーター名 */
  validatorName: string;
  /** 信頼度 (0-1) */
  confidence: number;
  /** 結果の説明 */
  message: string;
  /** 詳細情報 */
  details?: Record<string, any>;
  /** 推奨アクション */
  suggestedAction?: WorkflowAction;
  /** エラータイプ（該当する場合） */
  errorType?: ErrorType;
}

/**
 * バリデーションコンテキスト
 */
export interface ValidationContext {
  /** テストURL */
  url: string;
  /** テスト名 */
  testName: string;
  /** ビューポート */
  viewport?: { width: number; height: number };
  /** 追加のメタデータ */
  metadata?: Record<string, any>;
}

/**
 * 基本的なバリデーターインターフェース
 */
export interface Validator<TInput = any> {
  /** バリデーター名 */
  name: string;
  
  /**
   * バリデーションを実行
   */
  validate(input: TInput, context: ValidationContext): Promise<ValidationResult>;
}

/**
 * レイアウトバリデーター用の入力
 */
export interface LayoutValidatorInput {
  baseline: LayoutAnalysisResult;
  current: LayoutAnalysisResult;
  comparison?: LayoutComparisonResult;
}

/**
 * 画像バリデーター用の入力
 */
export interface ImageValidatorInput {
  baselineImage: string | Buffer;
  currentImage: string | Buffer;
  diffImage?: string | Buffer;
}

/**
 * Pixelmatchバリデーター用の入力
 */
export interface PixelmatchValidatorInput extends ImageValidatorInput {
  pixelDifference: number;
  totalPixels: number;
  threshold?: number;
}

/**
 * バリデーターチェーン
 */
export interface ValidatorChain {
  /** チェーンに含まれるバリデーター */
  validators: Validator[];
  
  /**
   * すべてのバリデーターを実行
   */
  validateAll<T>(input: T, context: ValidationContext): Promise<ValidationResult[]>;
  
  /**
   * 最初に失敗したバリデーターで停止
   */
  validateUntilFail<T>(input: T, context: ValidationContext): Promise<ValidationResult[]>;
  
  /**
   * 並列でバリデーターを実行
   */
  validateParallel<T>(input: T, context: ValidationContext): Promise<ValidationResult[]>;
}

/**
 * バリデーター設定
 */
export interface ValidatorConfig {
  /** レイアウト差分の閾値 */
  layoutThreshold?: number;
  /** Pixelmatchの閾値 */
  pixelThreshold?: number;
  /** AI分析を有効にするか */
  enableAI?: boolean;
  /** AIプロバイダーの設定 */
  aiProvider?: {
    type: 'gemini' | 'openai' | 'claude';
    apiKey: string;
    model?: string;
  };
  /** カスタムバリデーター */
  customValidators?: Validator[];
}