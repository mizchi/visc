import { createAIProvider } from '../src/workflow/ai-provider-factory';
import type { AnalysisContext } from '../src/workflow/types';
import type { ExtendedLayoutComparisonResult } from '../src/workflow/extended-types';
import { join } from 'path';

// 環境変数を読み込む（dotenvがインストールされている場合）

async function analyzeScreenshotWithGemini() {
  // APIキーが設定されているか確認
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error('GOOGLE_API_KEY environment variable is required');
    console.log('Please set it in your .env file or environment');
    process.exit(1);
  }

  // Gemini AIプロバイダーを作成
  const aiProvider = createAIProvider({
    type: 'gemini',
    apiKey,
    modelName: 'gemini-2.0-flash-exp' // 最新の高速モデル
  });

  // サンプルの比較結果
  const comparison: ExtendedLayoutComparisonResult = {
    // 基本のプロパティ
    identical: false,
    differences: [],
    similarity: 75,
    summary: {
      added: 2,
      removed: 2,
      modified: 0,
      moved: 0
    },
    // 拡張プロパティ
    elementsComparison: {
      missing: ['.header-nav', '.sidebar-menu'],
      unexpected: ['.popup-ad', '.cookie-banner'],
      changed: []
    },
    layoutSimilarity: 0.75,
    similarities: {
      position: 0.8,
      size: 0.7,
      structure: 0.65
    },
    hasChanges: true
  };

  // 分析コンテキスト
  const context: AnalysisContext = {
    url: 'https://example.com',
    testName: 'homepage-layout-test',
    testId: 'homepage-layout-test', // 互換性のため
    timestamp: new Date().toISOString()
  };

  // スクリーンショットのパス（実際のテストでは動的に生成される）
  const screenshots = {
    baseline: join(__dirname, 'fixtures', 'baseline.png'),
    current: join(__dirname, 'fixtures', 'current.png')
  };

  try {
    console.log('Analyzing layout changes with Gemini...');
    console.log('Context:', JSON.stringify(context, null, 2));
    console.log('Comparison:', JSON.stringify(comparison, null, 2));
    
    // AIによる分析を実行
    const analysis = await aiProvider.analyzeLayoutChange(
      comparison,
      context,
      screenshots
    );

    console.log('\nAnalysis Result:');
    console.log(JSON.stringify(analysis, null, 2));

    // 分析結果に基づいてアクションを決定
    console.log(`\nError Type: ${analysis.errorType}`);
    console.log(`Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
    console.log(`Suggested Action: ${analysis.suggestedAction}`);
    console.log(`Reasoning: ${analysis.reasoning}`);

    if (analysis.affectedElements && analysis.affectedElements.length > 0) {
      console.log('\nAffected Elements:');
      analysis.affectedElements.forEach(el => console.log(`  - ${el}`));
    }

  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

// 実行
if (require.main === module) {
  analyzeScreenshotWithGemini().catch(console.error);
}