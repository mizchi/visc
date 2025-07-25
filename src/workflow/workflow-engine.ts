/**
 * ワークフロー実行エンジン
 */

import type {
  WorkflowConfig,
  WorkflowResult,
  ErrorAnalysis,
  ExecutedAction,
  CustomRule,
  WorkflowDefinition,
  WorkflowContext,
  AnalysisContext
} from './types.js';
import { WorkflowAction } from './types.js';
import type { LayoutComparisonResult } from '../layout/comparator.js';
import type { VisualCheckConfig, UrlConfig } from '../types.js';
import { TestRunner } from '../test-runner.js';
import { MockAIProvider } from './ai-provider-mock.js';
import { createAIProvider, AIProviderConfig } from './ai-provider-factory.js';

/**
 * ワークフローエンジン
 */
export class WorkflowEngine {
  private config: WorkflowConfig;
  private customRules: CustomRule[] = [];
  private testRunner: TestRunner;
  private visualCheckConfig: VisualCheckConfig;

  constructor(
    testConfig: VisualCheckConfig,
    workflowConfig: WorkflowConfig
  ) {
    this.config = workflowConfig;
    this.testRunner = new TestRunner(testConfig);
    this.visualCheckConfig = testConfig;
  }

  /**
   * カスタムルールを追加
   */
  addRule(rule: CustomRule): void {
    this.customRules.push(rule);
    // 優先度でソート
    this.customRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * ワークフローを実行
   */
  async execute(urlConfig: UrlConfig): Promise<WorkflowResult> {
    const startTime = Date.now();
    const actions: ExecutedAction[] = [];
    let retryCount = 0;
    let lastComparison: LayoutComparisonResult | undefined;
    let lastAnalysis: ErrorAnalysis | undefined;

    try {
      // 初回実行
      let result = await this.runTest(urlConfig);
      lastComparison = result.comparison;

      // エラーがない場合は成功
      if (!result.comparison || result.comparison.similarity > 0.95) {
        return {
          success: true,
          actions: [{
            action: WorkflowAction.CONTINUE,
            timestamp: new Date().toISOString(),
            result: 'success',
            message: 'Test passed without errors'
          }],
          duration: Date.now() - startTime,
          retryCount: 0
        };
      }

      // エラー分析とアクション実行のループ
      while (retryCount < this.config.retry.maxAttempts) {
        // エラーを分析
        const context = this.createAnalysisContext(urlConfig, lastAnalysis);
        const analysis = await this.analyzeError(result.comparison!, context);
        lastAnalysis = analysis;

        // アクションを決定
        const action = this.determineAction(analysis);
        
        // アクションを記録
        const executedAction: ExecutedAction = {
          action,
          timestamp: new Date().toISOString(),
          result: 'success',
          message: `${analysis.errorType}: ${analysis.reasoning}`
        };
        actions.push(executedAction);

        // アクションを実行
        const continueExecution = await this.executeAction(action, urlConfig, analysis);
        
        if (!continueExecution) {
          return {
            success: action === WorkflowAction.UPDATE_BASELINE || 
                    action === WorkflowAction.CONTINUE,
            actions,
            errorAnalysis: analysis,
            finalComparison: lastComparison,
            duration: Date.now() - startTime,
            retryCount
          };
        }

        // リトライの場合は待機
        if (action === WorkflowAction.RETRY) {
          await this.wait(this.config.retry.delay);
          retryCount++;
          
          // 確率的エラーの場合は追加リトライ
          if (analysis.type === 'STOCHASTIC' && 
              retryCount < this.config.retry.stochasticRetries) {
            retryCount = Math.min(retryCount, this.config.retry.stochasticRetries);
          }
          
          // 再実行
          result = await this.runTest(urlConfig);
          lastComparison = result.comparison;
        } else {
          break;
        }
      }

      // 最大リトライ回数に達した
      return {
        success: false,
        actions,
        errorAnalysis: lastAnalysis,
        finalComparison: lastComparison,
        duration: Date.now() - startTime,
        retryCount
      };

    } catch (error) {
      return {
        success: false,
        actions: [...actions, {
          action: WorkflowAction.STOP,
          timestamp: new Date().toISOString(),
          result: 'failure',
          message: `Workflow error: ${error instanceof Error ? error.message : String(error)}`
        }],
        duration: Date.now() - startTime,
        retryCount
      };
    }
  }

  /**
   * テストを実行
   */
  private async runTest(urlConfig: UrlConfig): Promise<{
    comparison?: LayoutComparisonResult;
    error?: Error;
  }> {
    try {
      const results = await this.testRunner.runTests(false);
      const result = results.find(r => r.url.name === urlConfig.name);
      
      if (result && !result.passed && result.diffPercentage && result.diffPercentage > 0) {
        // テスト結果から簡易的なLayoutComparisonResultを作成
        const comparison: LayoutComparisonResult = {
          identical: false,
          differences: [],
          similarity: 1 - result.diffPercentage,
          summary: {
            added: 0,
            removed: 0,
            modified: 1,
            moved: 0
          }
        };
        return { comparison };
      }
      
      return {};
    } catch (error) {
      return { error: error as Error };
    }
  }

  /**
   * エラーを分析
   */
  private async analyzeError(
    comparison: LayoutComparisonResult,
    context: AnalysisContext
  ): Promise<ErrorAnalysis> {
    const provider = this.config.aiProvider || new MockAIProvider();
    const analysis = await provider.analyzeLayoutChange(comparison, context);
    
    // 信頼度の閾値チェック
    if (analysis.confidence < (this.config.confidenceThreshold || 0.7)) {
      analysis.errorType = 'UNKNOWN' as any;
      analysis.suggestedAction = WorkflowAction.MANUAL_REVIEW;
    }
    
    return analysis;
  }

  /**
   * アクションを決定
   */
  private determineAction(analysis: ErrorAnalysis): WorkflowAction {
    // カスタムルールをチェック
    for (const rule of this.customRules) {
      if (rule.condition(analysis, {} as AnalysisContext)) {
        return rule.action;
      }
    }
    
    // デフォルトのアクション設定を使用
    const errorType = analysis.errorType as keyof typeof this.config.errorActions;
    return this.config.errorActions[errorType] || analysis.suggestedAction as WorkflowAction;
  }

  /**
   * アクションを実行
   */
  private async executeAction(
    action: WorkflowAction,
    urlConfig: UrlConfig,
    analysis: ErrorAnalysis
  ): Promise<boolean> {
    if (this.config.verbose) {
      console.log(`Executing action: ${action} for ${analysis.type}`);
    }

    switch (action) {
      case WorkflowAction.CONTINUE:
        return false; // ワークフロー終了（成功）

      case WorkflowAction.UPDATE_BASELINE:
        await this.updateBaseline(urlConfig);
        return false; // ワークフロー終了（成功）

      case WorkflowAction.IGNORE_ELEMENT:
        this.addIgnorePatterns(analysis.affectedElements || []);
        return true; // 再実行

      case WorkflowAction.RETRY:
        return true; // 再実行

      case WorkflowAction.MANUAL_REVIEW:
        if (this.config.verbose) {
          console.log('Manual review required:', analysis.reasoning);
        }
        return false; // ワークフロー終了

      case WorkflowAction.STOP:
        return false; // ワークフロー終了（失敗）

      default:
        return false;
    }
  }

  /**
   * ベースラインを更新
   */
  private async updateBaseline(urlConfig: UrlConfig): Promise<void> {
    if (this.config.verbose) {
      console.log(`Updating baseline for ${urlConfig.name}`);
    }
    // TestRunnerの更新機能を使用
    await this.testRunner.runTests(true);
  }

  /**
   * 無視パターンを追加
   */
  private addIgnorePatterns(patterns: string[]): void {
    if (!this.config.ignorePatterns) {
      this.config.ignorePatterns = [];
    }
    this.config.ignorePatterns.push(...patterns);
  }

  /**
   * 分析コンテキストを作成
   */
  private createAnalysisContext(
    urlConfig: UrlConfig,
    previousAnalysis?: ErrorAnalysis
  ): AnalysisContext {
    return {
      url: urlConfig.url,
      testName: urlConfig.name,
      previousAnalysis,
      timestamp: new Date().toISOString(),
      viewport: this.visualCheckConfig.playwright?.viewport
    };
  }

  /**
   * 待機
   */
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * ワークフロー定義を実行
 */
export class WorkflowRunner {
  private definitions: Map<string, WorkflowDefinition> = new Map();

  /**
   * ワークフロー定義を登録
   */
  register(definition: WorkflowDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  /**
   * ワークフローを実行
   */
  async run(
    workflowName: string,
    testConfig: VisualCheckConfig
  ): Promise<WorkflowResult[]> {
    const definition = this.definitions.get(workflowName);
    if (!definition) {
      throw new Error(`Workflow '${workflowName}' not found`);
    }

    const engine = new WorkflowEngine(testConfig, definition.config);
    const results: WorkflowResult[] = [];

    // 各URLに対してワークフローを実行
    for (const urlConfig of testConfig.urls) {
      const result = await engine.execute(urlConfig);
      results.push(result);
    }

    return results;
  }
}

/**
 * デフォルトのワークフロー設定
 */
export const defaultWorkflowConfig: WorkflowConfig = {
  aiProvider: new MockAIProvider(),
  errorActions: {
    BROKEN: WorkflowAction.STOP,
    MEANINGFUL_CHANGE: WorkflowAction.UPDATE_BASELINE,
    STOCHASTIC: WorkflowAction.IGNORE_ELEMENT,
    UNKNOWN: WorkflowAction.MANUAL_REVIEW
  },
  retry: {
    maxAttempts: 3,
    delay: 1000,
    stochasticRetries: 5
  },
  confidenceThreshold: 0.7,
  verbose: true
};

/**
 * Geminiを使用するワークフロー設定を作成
 */
export function createGeminiWorkflowConfig(apiKey: string, modelName?: string): WorkflowConfig {
  return {
    ...defaultWorkflowConfig,
    aiProvider: createAIProvider({
      type: 'gemini',
      apiKey,
      modelName: modelName || 'gemini-2.0-flash-exp'
    })
  };
}