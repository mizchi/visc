/**
 * AI分析プロバイダーのモック実装
 * 実際のAI APIを使用する前のテスト用
 */

import type { 
  AIProvider, 
  ErrorAnalysis, 
  AnalysisContext 
} from './types.js';
import type { LayoutComparisonResult } from '../layout/comparator.js';
import { ErrorAnalyzer } from './error-analyzer.js';

/**
 * ルールベースのモックAIプロバイダー
 */
export class MockAIProvider implements AIProvider {
  name = 'mock-ai-provider';
  private analyzer = new ErrorAnalyzer();

  async analyzeLayoutChange(
    comparison: LayoutComparisonResult,
    context: AnalysisContext,
    screenshots?: {
      baseline?: string;
      current?: string;
    }
  ): Promise<ErrorAnalysis> {
    // 内部のルールベース分析器を使用
    const analysis = this.analyzer.analyzeLayoutDifferences(comparison, context);
    
    // AIっぽい説明を追加
    const description = this.enhanceDescription(analysis, comparison, context);
    
    return {
      ...analysis,
      description,
      reasoning: description, // 新しいインターフェースに対応
      errorType: analysis.type || analysis.errorType,
      suggestedAction: analysis.suggestedAction
    };
  }

  private enhanceDescription(
    analysis: ErrorAnalysis,
    comparison: LayoutComparisonResult,
    context: AnalysisContext
  ): string {
    const prefix = `[AI Analysis for ${context.testName}] `;
    
    switch (analysis.type) {
      case 'BROKEN':
        return prefix + `Critical issue detected: ${analysis.description}. ` +
          `This appears to be a regression that breaks core functionality. ` +
          `${analysis.affectedElements?.length ?? 0} critical elements are affected.`;
      
      case 'MEANINGFUL_CHANGE':
        return prefix + `Intentional change detected: ${analysis.description}. ` +
          `This looks like a deliberate update to the UI. ` +
          `Consider updating the baseline if this change is expected.`;
      
      case 'STOCHASTIC':
        return prefix + `Dynamic content detected: ${analysis.description}. ` +
          `These elements appear to change between page loads (e.g., ads, timestamps). ` +
          `Consider adding these selectors to the ignore list.`;
      
      case 'UNKNOWN':
        return prefix + `Unable to classify changes: ${analysis.description}. ` +
          `Manual review recommended to determine if these changes are intentional.`;
      
      default:
        return prefix + analysis.description;
    }
  }
}

/**
 * OpenAI APIを使用するプロバイダーのスタブ
 * 実装例を示すため
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai-provider';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4-vision-preview') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyzeLayoutChange(
    comparison: LayoutComparisonResult,
    context: AnalysisContext,
    screenshots?: {
      baseline?: string;
      current?: string;
    }
  ): Promise<ErrorAnalysis> {
    // 実際の実装では、OpenAI APIを呼び出す
    // const prompt = this.buildPrompt(comparison, context);
    // const response = await this.callOpenAI(prompt);
    // return this.parseResponse(response);
    
    throw new Error('OpenAI provider not implemented. Use MockAIProvider for testing.');
  }

  private buildPrompt(comparison: LayoutComparisonResult, context: AnalysisContext): string {
    return `
      Analyze the following layout changes and classify them into one of these categories:
      1. BROKEN - Critical functionality is broken
      2. MEANINGFUL_CHANGE - Intentional UI/UX changes
      3. STOCHASTIC - Random/dynamic content (ads, timestamps, etc.)
      4. UNKNOWN - Cannot determine
      
      Context:
      - URL: ${context.url}
      - Test: ${context.testName}
      - Changes: ${JSON.stringify(comparison.differences, null, 2)}
      
      Provide your analysis in JSON format with:
      - type: The error type
      - confidence: 0-1 confidence score
      - description: Brief explanation
      - suggestedAction: CONTINUE, UPDATE_BASELINE, IGNORE_ELEMENT, RETRY, MANUAL_REVIEW, or STOP
    `;
  }
}

/**
 * Anthropic Claude APIを使用するプロバイダーのスタブ
 */
export class ClaudeProvider implements AIProvider {
  name = 'claude-provider';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeLayoutChange(
    comparison: LayoutComparisonResult,
    context: AnalysisContext,
    screenshots?: {
      baseline?: string;
      current?: string;
    }
  ): Promise<ErrorAnalysis> {
    // 実際の実装では、Anthropic APIを呼び出す
    throw new Error('Claude provider not implemented. Use MockAIProvider for testing.');
  }
}

/**
 * デフォルトのモックプロバイダー
 */
export const defaultAIProvider = new MockAIProvider();