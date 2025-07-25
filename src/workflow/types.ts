/**
 * AIワークフローシステムの型定義
 */

import type { LayoutComparisonResult } from '../layout/comparator.js';
import type { SemanticGroup } from '../layout/extractor.js';

/**
 * エラータイプの分類
 */
export enum ErrorType {
  /** 明確に壊れているエラー（要素が消失、レイアウト崩壊など） */
  BROKEN = 'BROKEN',
  /** 意味のある変更（仕様変更の可能性） */
  MEANINGFUL_CHANGE = 'MEANINGFUL_CHANGE',
  /** 確率的な出力（広告、ランダムコンテンツなど） */
  STOCHASTIC = 'STOCHASTIC',
  /** 分類不能 */
  UNKNOWN = 'UNKNOWN'
}

/**
 * エラー分析結果
 */
export interface ErrorAnalysis {
  /** エラータイプ */
  errorType: ErrorType | string;
  /** 信頼度（0-1） */
  confidence: number;
  /** 判断理由 */
  reasoning: string;
  /** 推奨アクション */
  suggestedAction: WorkflowAction | string;
  /** 影響を受けた要素 */
  affectedElements?: string[];
  /** 詳細情報 */
  details?: Record<string, any>;
  
  // 互換性のための追加フィールド
  type?: ErrorType;
  description?: string;
}

/**
 * ワークフローアクション
 */
export enum WorkflowAction {
  /** テストを続行 */
  CONTINUE = 'CONTINUE',
  /** 基準を更新して続行 */
  UPDATE_BASELINE = 'UPDATE_BASELINE',
  /** 該当要素を無視して続行 */
  IGNORE_ELEMENT = 'IGNORE_ELEMENT',
  /** リトライ */
  RETRY = 'RETRY',
  /** 手動確認が必要 */
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  /** テストを停止 */
  STOP = 'STOP'
}

/**
 * ワークフロー設定
 */
export interface WorkflowConfig {
  /** AI分析プロバイダー */
  aiProvider: AIProvider;
  /** エラータイプごとのアクション設定 */
  errorActions: {
    [ErrorType.BROKEN]: WorkflowAction;
    [ErrorType.MEANINGFUL_CHANGE]: WorkflowAction;
    [ErrorType.STOCHASTIC]: WorkflowAction;
    [ErrorType.UNKNOWN]: WorkflowAction;
  };
  /** リトライ設定 */
  retry: {
    /** 最大リトライ回数 */
    maxAttempts: number;
    /** リトライ間隔（ミリ秒） */
    delay: number;
    /** 確率的エラーの場合の追加リトライ */
    stochasticRetries: number;
  };
  /** 無視する要素のパターン */
  ignorePatterns?: string[];
  /** 信頼度の閾値 */
  confidenceThreshold?: number;
  /** 詳細ログを出力 */
  verbose?: boolean;
}

/**
 * AI分析プロバイダーのインターフェース
 */
export interface AIProvider {
  /** プロバイダー名 */
  name: string;
  
  /**
   * レイアウトの変更を分析してエラータイプを分類
   */
  analyzeLayoutChange(
    comparison: LayoutComparisonResult,
    context: AnalysisContext,
    screenshots?: {
      baseline?: string;
      current?: string;
    }
  ): Promise<ErrorAnalysis>;
}

/**
 * 分析コンテキスト
 */
export interface AnalysisContext {
  /** ページURL */
  url: string;
  /** テスト名 */
  testName: string;
  /** テストID（互換性のため） */
  testId?: string;
  /** 前回の分析結果（ある場合） */
  previousAnalysis?: ErrorAnalysis;
  /** カスタムメタデータ */
  metadata?: Record<string, any>;
  /** ビューポートサイズ */
  viewport?: { width: number; height: number };
  /** タイムスタンプ */
  timestamp: string;
}

/**
 * ワークフロー実行結果
 */
export interface WorkflowResult {
  /** 最終的な成功/失敗 */
  success: boolean;
  /** 実行されたアクション */
  actions: ExecutedAction[];
  /** エラー分析結果 */
  errorAnalysis?: ErrorAnalysis;
  /** 最終的なレイアウト比較結果 */
  finalComparison?: LayoutComparisonResult;
  /** 実行時間 */
  duration: number;
  /** リトライ回数 */
  retryCount: number;
}

/**
 * 実行されたアクション
 */
export interface ExecutedAction {
  /** アクションタイプ */
  action: WorkflowAction;
  /** タイムスタンプ */
  timestamp: string;
  /** アクションの結果 */
  result: 'success' | 'failure' | 'skipped';
  /** 詳細メッセージ */
  message?: string;
}

/**
 * ワークフロー定義
 */
export interface WorkflowDefinition {
  /** ワークフロー名 */
  name: string;
  /** 説明 */
  description?: string;
  /** ステップの定義 */
  steps: WorkflowStep[];
  /** グローバル設定 */
  config: WorkflowConfig;
}

/**
 * ワークフローステップ
 */
export interface WorkflowStep {
  /** ステップ名 */
  name: string;
  /** ステップタイプ */
  type: 'test' | 'analyze' | 'action' | 'condition';
  /** 実行条件 */
  condition?: (context: WorkflowContext) => boolean;
  /** ステップの設定 */
  config?: any;
  /** 次のステップ */
  next?: string | ((result: any) => string | null);
}

/**
 * ワークフローコンテキスト
 */
export interface WorkflowContext {
  /** 現在のステップ */
  currentStep: string;
  /** ステップの履歴 */
  history: string[];
  /** 実行結果 */
  results: Map<string, any>;
  /** グローバル状態 */
  state: Record<string, any>;
  /** エラー */
  errors: Error[];
}

/**
 * カスタムルール
 */
export interface CustomRule {
  /** ルール名 */
  name: string;
  /** 適用条件 */
  condition: (analysis: ErrorAnalysis, context: AnalysisContext) => boolean;
  /** 実行アクション */
  action: WorkflowAction;
  /** 優先度（高い方が優先） */
  priority?: number;
}