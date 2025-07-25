import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { AIProvider, ErrorAnalysis, AnalysisContext } from './types';
import { LayoutComparisonResult } from '../layout/comparator';
import { ExtendedLayoutComparisonResult } from './extended-types';
import { readFileSync } from 'fs';

export class GeminiAIProvider implements AIProvider {
  name = 'gemini';
  private model: any;

  constructor(
    private apiKey: string,
    private modelName: string = 'gemini-2.0-flash-exp'
  ) {
    this.model = google(modelName);
  }

  async analyzeLayoutChange(
    comparison: LayoutComparisonResult,
    context: AnalysisContext,
    screenshots?: {
      baseline?: string;
      current?: string;
    }
  ): Promise<ErrorAnalysis> {
    const prompt = this.buildPrompt(comparison, context, screenshots);
    const messages: any[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ];

    // スクリーンショットがある場合は画像として追加
    if (screenshots?.baseline) {
      messages[0].content.push({
        type: 'image',
        image: this.loadImageAsBase64(screenshots.baseline)
      });
    }
    if (screenshots?.current) {
      messages[0].content.push({
        type: 'image',
        image: this.loadImageAsBase64(screenshots.current)
      });
    }

    try {
      const response = await generateText({
        model: this.model,
        messages,
        temperature: 0.2,
        maxTokens: 1000,
      });

      return this.parseResponse(response.text);
    } catch (error) {
      console.error('Gemini API error:', error);
      return {
        errorType: 'UNKNOWN',
        confidence: 0.5,
        reasoning: 'AI分析に失敗しました',
        suggestedAction: 'MANUAL_REVIEW',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private loadImageAsBase64(imagePath: string): string {
    try {
      const imageBuffer = readFileSync(imagePath);
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error(`Failed to load image: ${imagePath}`, error);
      return '';
    }
  }

  private buildPrompt(comparison: LayoutComparisonResult, context: AnalysisContext, screenshots?: { baseline?: string; current?: string }): string {
    const extComparison = comparison as ExtendedLayoutComparisonResult;
    const missingCount = extComparison.elementsComparison?.missing.length ?? 0;
    const unexpectedCount = extComparison.elementsComparison?.unexpected.length ?? 0;
    const layoutSimilarity = extComparison.layoutSimilarity ?? comparison.similarity;

    return `以下のWebページのレイアウト変更を分析してください。

URL: ${context.url}
テストID: ${context.testId}

変更の概要:
- 失われた要素数: ${missingCount}
- 予期しない要素数: ${unexpectedCount}
- レイアウト類似度: ${layoutSimilarity}
- ポジション類似度: ${extComparison.similarities?.position ?? 'N/A'}
- サイズ類似度: ${extComparison.similarities?.size ?? 'N/A'}
- 構造類似度: ${extComparison.similarities?.structure ?? 'N/A'}

${screenshots?.baseline && screenshots?.current ? 
  '添付された画像：1枚目がベースライン、2枚目が現在の状態です。' : ''}

この変更を以下の4つのタイプに分類してください：
1. BROKEN: 明確に壊れているエラー（要素の完全な消失、レイアウトの崩壊など）
2. MEANINGFUL_CHANGE: 意味のある変更（デザイン更新、機能追加など）
3. STOCHASTIC: 確率的な出力（広告、動的コンテンツなど）
4. UNKNOWN: 分類が困難

また、推奨されるアクションを以下から選んでください：
- CONTINUE: そのまま続行
- UPDATE_BASELINE: ベースラインを更新
- IGNORE_ELEMENT: 特定要素を無視
- RETRY: リトライ
- MANUAL_REVIEW: 手動確認が必要
- STOP: 停止

回答は以下のJSON形式で返してください：
{
  "errorType": "BROKEN|MEANINGFUL_CHANGE|STOCHASTIC|UNKNOWN",
  "confidence": 0.0-1.0,
  "reasoning": "判断理由",
  "suggestedAction": "アクション",
  "affectedElements": ["影響を受けた要素のセレクタ"],
  "details": { "追加情報" }
}`;
  }

  private parseResponse(responseText: string): ErrorAnalysis {
    try {
      // JSONブロックを抽出
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        errorType: parsed.errorType || 'UNKNOWN',
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || '',
        suggestedAction: parsed.suggestedAction || 'MANUAL_REVIEW',
        affectedElements: parsed.affectedElements || [],
        details: parsed.details || {}
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return {
        errorType: 'UNKNOWN',
        confidence: 0.5,
        reasoning: 'レスポンスの解析に失敗しました',
        suggestedAction: 'MANUAL_REVIEW',
        details: {
          rawResponse: responseText,
          parseError: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}