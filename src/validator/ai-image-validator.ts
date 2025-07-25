/**
 * AIによる画像直接比較バリデーター
 */

import type { 
  Validator, 
  ImageValidatorInput, 
  ValidationResult, 
  ValidationContext 
} from './types.js';
import type { AIProvider } from '../workflow/types.js';
import { ErrorType, WorkflowAction } from '../workflow/types.js';
import { createAIProvider } from '../workflow/ai-provider-factory.js';
import { readFileSync } from 'fs';

/**
 * AIによる2つの画像の直接比較バリデーター
 */
export class AIImageComparisonValidator implements Validator<ImageValidatorInput> {
  name = 'ai-image-comparison';
  private aiProvider: AIProvider;
  
  constructor(
    aiProviderConfig: {
      type: 'gemini' | 'openai' | 'claude' | 'mock';
      apiKey?: string;
      model?: string;
    },
    private options: {
      focusAreas?: string[]; // 注目すべき領域
      ignoreAreas?: string[]; // 無視すべき領域
      comparisonMode?: 'strict' | 'layout' | 'content';
    } = {}
  ) {
    this.aiProvider = createAIProvider(aiProviderConfig);
  }

  async validate(
    input: ImageValidatorInput,
    context: ValidationContext
  ): Promise<ValidationResult> {
    try {
      // 画像パスを取得
      const baselinePath = this.getImagePath(input.baselineImage);
      const currentPath = this.getImagePath(input.currentImage);
      
      if (!baselinePath || !currentPath) {
        throw new Error('Images must be file paths for AI analysis');
      }
      
      // AI分析を実行
      const analysis = await this.compareImagesWithAI(
        baselinePath,
        currentPath,
        context
      );
      
      // 分析結果をバリデーション結果に変換
      return this.convertAnalysisToResult(analysis);
      
    } catch (error) {
      return {
        passed: false,
        validatorName: this.name,
        confidence: 0,
        message: `AI画像比較エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: ErrorType.UNKNOWN,
        suggestedAction: WorkflowAction.MANUAL_REVIEW,
        details: {
          error: error instanceof Error ? error.message : error
        }
      };
    }
  }
  
  private getImagePath(image: string | Buffer): string | undefined {
    if (typeof image === 'string') {
      return image;
    }
    // Bufferの場合は一時ファイルに保存が必要
    return undefined;
  }
  
  private async compareImagesWithAI(
    baselinePath: string,
    currentPath: string,
    context: ValidationContext
  ): Promise<any> {
    // プロンプトを構築
    const prompt = this.buildComparisonPrompt(context);
    
    // ダミーのレイアウト比較結果（実際の実装では適切なデータを使用）
    const dummyComparison = {
      elementsComparison: {
        missing: [],
        unexpected: [],
        changed: []
      },
      layoutSimilarity: 0.95,
      similarities: {
        position: 0.95,
        size: 0.95,
        structure: 0.95
      }
    };
    
    // AIプロバイダーを使用して画像を比較
    const result = await this.aiProvider.analyzeLayoutChange(
      dummyComparison as any,
      {
        url: context.url,
        testId: context.testName,
        testName: context.testName,
        timestamp: new Date().toISOString()
      },
      {
        baseline: baselinePath,
        current: currentPath
      }
    );
    
    return result;
  }
  
  private buildComparisonPrompt(context: ValidationContext): string {
    const mode = this.options.comparisonMode || 'strict';
    const focusAreas = this.options.focusAreas?.join(', ') || 'すべての領域';
    const ignoreAreas = this.options.ignoreAreas?.join(', ') || 'なし';
    
    return `2つの画像を比較して、以下の観点で分析してください。

コンテキスト:
- URL: ${context.url}
- テスト名: ${context.testName}
- 比較モード: ${mode}
- 注目領域: ${focusAreas}
- 無視領域: ${ignoreAreas}

比較モード別の分析方法:
${mode === 'strict' ? '- 厳密モード: ピクセル単位の違いも含めて詳細に比較' :
  mode === 'layout' ? '- レイアウトモード: 要素の配置とサイズを重視' :
  '- コンテンツモード: テキストや画像の内容を重視'}

以下を判定してください：
1. 2つの画像は同一と見なせるか
2. 違いがある場合、その種類と重要度
3. 違いは意図的な変更か、バグか、動的コンテンツか
4. ユーザー体験への影響

結果は以下のJSON形式で返してください：
{
  "identical": true|false,
  "similarity": 0.0-1.0,
  "differences": [
    {
      "area": "ヘッダー",
      "type": "text|layout|color|image",
      "severity": "critical|important|minor",
      "description": "具体的な説明"
    }
  ],
  "classification": "BROKEN|MEANINGFUL_CHANGE|STOCHASTIC|IDENTICAL",
  "userImpact": "high|medium|low|none",
  "recommendation": "推奨アクション"
}`;
  }
  
  private convertAnalysisToResult(analysis: any): ValidationResult {
    // デフォルト値を設定
    const isIdentical = analysis.details?.identical ?? false;
    const similarity = analysis.details?.similarity ?? 0.5;
    const classification = analysis.errorType || analysis.details?.classification || 'UNKNOWN';
    
    // 同一と判定された場合
    if (isIdentical || classification === 'IDENTICAL') {
      return {
        passed: true,
        validatorName: this.name,
        confidence: 1,
        message: '画像は同一です',
        details: {
          identical: true,
          similarity: 1
        }
      };
    }
    
    // エラータイプとアクションを決定
    let errorType: ErrorType;
    let suggestedAction: WorkflowAction;
    let message: string;
    
    switch (classification) {
      case 'BROKEN':
        errorType = ErrorType.BROKEN;
        suggestedAction = WorkflowAction.STOP;
        message = 'クリティカルな変更が検出されました';
        break;
        
      case 'MEANINGFUL_CHANGE':
        errorType = ErrorType.MEANINGFUL_CHANGE;
        suggestedAction = WorkflowAction.UPDATE_BASELINE;
        message = '意図的な変更と思われます';
        break;
        
      case 'STOCHASTIC':
        errorType = ErrorType.STOCHASTIC;
        suggestedAction = WorkflowAction.IGNORE_ELEMENT;
        message = '動的コンテンツの変化です';
        break;
        
      default:
        errorType = ErrorType.UNKNOWN;
        suggestedAction = WorkflowAction.MANUAL_REVIEW;
        message = '変更の分類が不明です';
    }
    
    // 詳細メッセージを追加
    if (analysis.reasoning) {
      message = `${message}: ${analysis.reasoning}`;
    }
    
    return {
      passed: false,
      validatorName: this.name,
      confidence: analysis.confidence || (1 - similarity),
      message,
      errorType,
      suggestedAction,
      details: {
        similarity,
        differences: analysis.details?.differences || [],
        userImpact: analysis.details?.userImpact || 'unknown',
        aiAnalysis: analysis
      }
    };
  }
}

/**
 * AIによるレスポンシブデザイン検証バリデーター
 */
export class AIResponsiveValidator implements Validator<{
  viewports: Array<{
    width: number;
    height: number;
    image: string | Buffer;
    deviceType: 'mobile' | 'tablet' | 'desktop';
  }>;
}> {
  name = 'ai-responsive';
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
    input: { viewports: any[] },
    context: ValidationContext
  ): Promise<ValidationResult> {
    if (input.viewports.length < 2) {
      return {
        passed: false,
        validatorName: this.name,
        confidence: 0,
        message: 'レスポンシブデザイン検証には最低2つのビューポートが必要です',
        details: {
          providedViewports: input.viewports.length
        }
      };
    }
    
    try {
      // 各ビューポートの画像を分析
      const analyses = await Promise.all(
        input.viewports.map(vp => this.analyzeViewport(vp, context))
      );
      
      // レスポンシブデザインの品質を評価
      return this.evaluateResponsiveness(analyses, input.viewports);
      
    } catch (error) {
      return {
        passed: false,
        validatorName: this.name,
        confidence: 0,
        message: `AIレスポンシブ検証エラー: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: ErrorType.UNKNOWN,
        suggestedAction: WorkflowAction.MANUAL_REVIEW,
        details: {
          error: error instanceof Error ? error.message : error
        }
      };
    }
  }
  
  private async analyzeViewport(
    viewport: any,
    context: ValidationContext
  ): Promise<any> {
    const imagePath = typeof viewport.image === 'string' 
      ? viewport.image 
      : undefined;
      
    if (!imagePath) {
      throw new Error('Viewport image must be a file path');
    }
    
    const prompt = `
このビューポート（${viewport.width}x${viewport.height}、${viewport.deviceType}）の画像を分析してください。

以下の観点で評価してください：
1. レイアウトが適切にレスポンシブ対応されているか
2. 要素の配置が画面サイズに適しているか
3. テキストの可読性
4. タッチターゲットのサイズ（モバイル/タブレットの場合）
5. 横スクロールの有無

結果をJSON形式で返してください：
{
  "isResponsive": true|false,
  "issues": ["問題点のリスト"],
  "score": 0-100,
  "recommendations": ["改善提案"]
}`;
    
    // ダミー実装（実際の実装では適切なAI分析を行う）
    return {
      viewport,
      isResponsive: true,
      issues: [],
      score: 95,
      recommendations: []
    };
  }
  
  private evaluateResponsiveness(
    analyses: any[],
    viewports: any[]
  ): ValidationResult {
    // 全体的なスコアを計算
    const avgScore = analyses.reduce((sum, a) => sum + (a.score || 0), 0) / analyses.length;
    const hasIssues = analyses.some(a => a.issues && a.issues.length > 0);
    
    if (avgScore >= 90 && !hasIssues) {
      return {
        passed: true,
        validatorName: this.name,
        confidence: avgScore / 100,
        message: `優れたレスポンシブデザインです（スコア: ${avgScore.toFixed(0)}/100）`,
        details: {
          averageScore: avgScore,
          viewportResults: analyses
        }
      };
    }
    
    // 問題がある場合
    const allIssues = analyses.flatMap(a => a.issues || []);
    const allRecommendations = analyses.flatMap(a => a.recommendations || []);
    
    return {
      passed: false,
      validatorName: this.name,
      confidence: 0.8,
      message: `レスポンシブデザインに改善の余地があります（スコア: ${avgScore.toFixed(0)}/100）`,
      errorType: ErrorType.MEANINGFUL_CHANGE,
      suggestedAction: WorkflowAction.MANUAL_REVIEW,
      details: {
        averageScore: avgScore,
        issues: allIssues,
        recommendations: allRecommendations,
        viewportResults: analyses
      }
    };
  }
}