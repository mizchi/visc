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

