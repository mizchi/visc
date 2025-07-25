/**
 * AIによるPixelmatch結果の確認バリデーター
 */

import type { 
  Validator, 
  PixelmatchValidatorInput, 
  ValidationResult, 
  ValidationContext 
} from './types.js';
import type { AIProvider } from '../workflow/types.js';
import { ErrorType, WorkflowAction } from '../workflow/types.js';
import { createAIProvider } from '../workflow/ai-provider-factory.js';

/**
 * AIによるPixelmatch差分画像の分析バリデーター
 */
export class AIPixelmatchValidator implements Validator<PixelmatchValidatorInput> {
  name = 'ai-pixelmatch';
  private aiProvider: AIProvider;
  
  constructor(
    aiProviderConfig: {
      type: 'gemini' | 'openai' | 'claude' | 'mock';
      apiKey?: string;
      model?: string;
    },
    private options: {
      includeContext?: boolean;
      analyzeRegions?: boolean;
    } = {}
  ) {
    this.aiProvider = createAIProvider(aiProviderConfig);
  }

  async validate(
    input: PixelmatchValidatorInput,
    context: ValidationContext
  ): Promise<ValidationResult> {
    // Pixelmatchの結果を元にAI分析用のプロンプトを構築
    const diffPercentage = input.pixelDifference / input.totalPixels;
    
    // 差分画像がない場合は通常のPixelmatch結果を返す
    if (!input.diffImage) {
      return {
        passed: diffPercentage < 0.001,
        validatorName: this.name,
        confidence: 0.5,
        message: 'AI分析には差分画像が必要です',
        details: {
          reason: 'No diff image provided',
          pixelDifference: input.pixelDifference,
          diffPercentage
        }
      };
    }
    
    try {
      // AI分析のためのコンテキストを作成
      const analysisPrompt = this.buildAnalysisPrompt(input, context, diffPercentage);
      
      // AIプロバイダーに画像を分析させる
      const analysis = await this.analyzeWithAI(
        input,
        context,
        analysisPrompt
      );
      
      // AI分析結果をバリデーション結果に変換
      return this.convertAnalysisToResult(analysis, input, diffPercentage);
      
    } catch (error) {
      return {
        passed: false,
        validatorName: this.name,
        confidence: 0,
        message: `AI分析エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: ErrorType.UNKNOWN,
        suggestedAction: WorkflowAction.MANUAL_REVIEW,
        details: {
          error: error instanceof Error ? error.message : error,
          pixelDifference: input.pixelDifference,
          diffPercentage
        }
      };
    }
  }
  
  private buildAnalysisPrompt(
    input: PixelmatchValidatorInput,
    context: ValidationContext,
    diffPercentage: number
  ): string {
    return `以下の差分画像を分析してください。

コンテキスト:
- URL: ${context.url}
- テスト名: ${context.testName}
- ピクセル差分: ${input.pixelDifference}ピクセル (${(diffPercentage * 100).toFixed(2)}%)
- 画像サイズ: ${Math.sqrt(input.totalPixels)}x${Math.sqrt(input.totalPixels)}（推定）

差分画像の特徴:
- 赤い領域: 変更された部分
- 緑の領域: 追加された部分
- 紫の領域: 削除された部分

以下の観点で分析してください：
1. 差分の種類（テキスト変更、レイアウト変更、色の変更など）
2. 差分の重要度（クリティカル、重要、軽微）
3. 意図的な変更か、バグの可能性か
4. 動的コンテンツ（広告、タイムスタンプなど）の可能性

分析結果をJSON形式で返してください：
{
  "changeType": "text|layout|color|animation|dynamic",
  "severity": "critical|important|minor|negligible",
  "isIntentional": true|false,
  "isDynamic": true|false,
  "affectedAreas": ["ヘッダー", "メインコンテンツ"],
  "recommendation": "アクションの推奨",
  "confidence": 0.0-1.0
}`;
  }
  
  private async analyzeWithAI(
    input: PixelmatchValidatorInput,
    context: ValidationContext,
    prompt: string
  ): Promise<any> {
    // 差分画像のパスを準備
    const diffImagePath = typeof input.diffImage === 'string' 
      ? input.diffImage 
      : undefined; // Bufferの場合は一時ファイルに保存が必要
    
    if (!diffImagePath) {
      throw new Error('Diff image must be a file path for AI analysis');
    }
    
    // レイアウト比較結果のダミーデータ（実際の実装では適切なデータを使用）
    const dummyComparison = {
      elementsComparison: {
        missing: [],
        unexpected: [],
        changed: []
      },
      layoutSimilarity: 1 - (input.pixelDifference / input.totalPixels),
      similarities: {
        position: 0.9,
        size: 0.9,
        structure: 0.9
      }
    };
    
    // AIプロバイダーを使用して分析
    const result = await this.aiProvider.analyzeLayoutChange(
      dummyComparison as any,
      {
        url: context.url,
        testId: context.testName,
        testName: context.testName,
        timestamp: new Date().toISOString()
      },
      {
        current: diffImagePath // 差分画像を現在の画像として渡す
      }
    );
    
    return result;
  }
  
  private convertAnalysisToResult(
    aiAnalysis: any,
    input: PixelmatchValidatorInput,
    diffPercentage: number
  ): ValidationResult {
    // AIの分析結果からエラータイプを決定
    let errorType: ErrorType;
    let suggestedAction: WorkflowAction;
    let passed = false;
    
    if (aiAnalysis.errorType === 'STOCHASTIC' || aiAnalysis.details?.isDynamic) {
      errorType = ErrorType.STOCHASTIC;
      suggestedAction = WorkflowAction.IGNORE_ELEMENT;
      passed = true; // 動的コンテンツは許容
    } else if (aiAnalysis.errorType === 'MEANINGFUL_CHANGE' || aiAnalysis.details?.isIntentional) {
      errorType = ErrorType.MEANINGFUL_CHANGE;
      suggestedAction = WorkflowAction.UPDATE_BASELINE;
    } else if (aiAnalysis.errorType === 'BROKEN' || aiAnalysis.details?.severity === 'critical') {
      errorType = ErrorType.BROKEN;
      suggestedAction = WorkflowAction.STOP;
    } else {
      errorType = ErrorType.UNKNOWN;
      suggestedAction = WorkflowAction.MANUAL_REVIEW;
    }
    
    const message = `AI分析: ${aiAnalysis.reasoning || '差分が検出されました'}`;
    
    return {
      passed,
      validatorName: this.name,
      confidence: aiAnalysis.confidence || 0.7,
      message,
      errorType,
      suggestedAction,
      details: {
        aiAnalysis: aiAnalysis.details,
        pixelDifference: input.pixelDifference,
        diffPercentage,
        affectedElements: aiAnalysis.affectedElements
      }
    };
  }
}

/**
 * AIによる差分パターン学習バリデーター
 */
export class AIPatternLearningValidator implements Validator<{
  current: PixelmatchValidatorInput;
  history: Array<{
    input: PixelmatchValidatorInput;
    wasAccepted: boolean;
    reason?: string;
  }>;
}> {
  name = 'ai-pattern-learning';
  private aiProvider: AIProvider;
  
  constructor(
    aiProviderConfig: {
      type: 'gemini' | 'openai' | 'claude' | 'mock';
      apiKey?: string;
      model?: string;
    }
  ) {
    this.aiProvider = createAIProvider(aiProviderConfig);
  }

  async validate(
    input: { current: PixelmatchValidatorInput; history: any[] },
    context: ValidationContext
  ): Promise<ValidationResult> {
    // 過去の承認/却下パターンを学習
    const acceptedPatterns = input.history
      .filter(h => h.wasAccepted)
      .map(h => ({
        diffPercentage: h.input.pixelDifference / h.input.totalPixels,
        reason: h.reason
      }));
    
    const rejectedPatterns = input.history
      .filter(h => !h.wasAccepted)
      .map(h => ({
        diffPercentage: h.input.pixelDifference / h.input.totalPixels,
        reason: h.reason
      }));
    
    const currentDiffPercentage = input.current.pixelDifference / input.current.totalPixels;
    
    // 類似パターンの検出
    const similarAccepted = acceptedPatterns.find(p => 
      Math.abs(p.diffPercentage - currentDiffPercentage) < 0.001
    );
    
    const similarRejected = rejectedPatterns.find(p => 
      Math.abs(p.diffPercentage - currentDiffPercentage) < 0.001
    );
    
    if (similarAccepted) {
      return {
        passed: true,
        validatorName: this.name,
        confidence: 0.9,
        message: `過去に承認された類似パターンです: ${similarAccepted.reason || '理由不明'}`,
        details: {
          patternMatch: 'accepted',
          similarPattern: similarAccepted,
          currentDiffPercentage
        }
      };
    }
    
    if (similarRejected) {
      return {
        passed: false,
        validatorName: this.name,
        confidence: 0.9,
        message: `過去に却下された類似パターンです: ${similarRejected.reason || '理由不明'}`,
        errorType: ErrorType.BROKEN,
        suggestedAction: WorkflowAction.STOP,
        details: {
          patternMatch: 'rejected',
          similarPattern: similarRejected,
          currentDiffPercentage
        }
      };
    }
    
    // 新しいパターンの場合は手動確認を推奨
    return {
      passed: false,
      validatorName: this.name,
      confidence: 0.5,
      message: '新しいパターンです。手動確認が必要です',
      errorType: ErrorType.UNKNOWN,
      suggestedAction: WorkflowAction.MANUAL_REVIEW,
      details: {
        patternMatch: 'new',
        currentDiffPercentage,
        historySize: input.history.length
      }
    };
  }
}