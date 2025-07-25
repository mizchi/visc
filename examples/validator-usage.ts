/**
 * バリデーターの使用例
 */

import {
  ValidatorFactory,
  ValidatorPreset,
  createValidationPipeline,
  formatValidationResults,
  validateCombined,
  type LayoutValidatorInput,
  type PixelmatchValidatorInput,
  type ValidationContext
} from '../src/validator';
import { compareLayouts } from '../src/layout/comparator';
import { extractSemanticLayoutScript } from '../src/layout/semantic-analyzer';

// サンプルデータ
const sampleLayoutInput: LayoutValidatorInput = {
  baseline: {
    url: 'https://example.com',
    timestamp: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    semanticGroups: [
      {
        id: 'nav-1',
        type: 'navigation',
        elements: [],
        bounds: { x: 0, y: 0, width: 1920, height: 60 },
        importance: 0.9,
        children: [],
        depth: 0,
        label: 'Navigation'
      },
      {
        id: 'section-1',
        type: 'section',
        elements: [],
        bounds: { x: 0, y: 60, width: 1920, height: 500 },
        importance: 0.8,
        children: [],
        depth: 0,
        label: 'Main Section'
      }
    ],
    totalElements: 50,
    statistics: {
      groupCount: 2,
      patternCount: 0,
      interactiveElements: 10,
      accessibilityCount: 45
    }
  },
  current: {
    url: 'https://example.com',
    timestamp: new Date().toISOString(),
    viewport: { width: 1920, height: 1080 },
    semanticGroups: [
      {
        id: 'nav-1',
        type: 'navigation',
        elements: [],
        bounds: { x: 0, y: 0, width: 1920, height: 65 }, // 少し高さが変わった
        importance: 0.9,
        children: [],
        depth: 0,
        label: 'Navigation'
      },
      {
        id: 'section-1',
        type: 'section',
        elements: [],
        bounds: { x: 0, y: 65, width: 1920, height: 495 },
        importance: 0.8,
        children: [],
        depth: 0,
        label: 'Main Section'
      }
    ],
    totalElements: 48,
    statistics: {
      groupCount: 2,
      patternCount: 0,
      interactiveElements: 10,
      accessibilityCount: 43
    }
  }
};

const samplePixelmatchInput: PixelmatchValidatorInput = {
  baselineImage: '/path/to/baseline.png',
  currentImage: '/path/to/current.png',
  diffImage: '/path/to/diff.png',
  pixelDifference: 15000,
  totalPixels: 2073600, // 1920x1080
  threshold: 0.01
};

const context: ValidationContext = {
  url: 'https://example.com',
  testName: 'homepage-test',
  viewport: { width: 1920, height: 1080 }
};

/**
 * 例1: プリセットを使った検証
 */
async function example1_presetValidation() {
  console.log('=== 例1: プリセットを使った検証 ===\n');
  
  const factory = new ValidatorFactory();
  
  // バランス型プリセットを使用
  const chain = factory.createFromPreset(ValidatorPreset.BALANCED);
  const results = await chain.validateAll(sampleLayoutInput, context);
  
  console.log('バランス型プリセットの結果:');
  results.forEach(result => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.validatorName}: ${result.message}`);
  });
}

/**
 * 例2: パイプラインを使った検証
 */
async function example2_pipelineValidation() {
  console.log('\n=== 例2: パイプラインを使った検証 ===\n');
  
  // 厳密な検証パイプラインを作成
  const strictPipeline = createValidationPipeline(ValidatorPreset.STRICT);
  
  const result = await strictPipeline(sampleLayoutInput, context);
  
  // 結果をフォーマットして表示
  const formatted = formatValidationResults(result, {
    verbose: true,
    includeDetails: false
  });
  
  console.log(formatted);
}

/**
 * 例3: カスタムチェーンの構築
 */
async function example3_customChain() {
  console.log('\n=== 例3: カスタムチェーンの構築 ===\n');
  
  const factory = new ValidatorFactory();
  const builder = factory.createChainBuilder('weighted');
  
  // レイアウト構造に高い重みを設定
  builder.addWeighted(
    factory.createValidator('layout-structure', { threshold: 0.95 }),
    3.0
  );
  
  // 視覚的類似度に中程度の重みを設定
  builder.addWeighted(
    factory.createValidator('layout-visual', { 
      threshold: 0.90,
      ignoreColors: true 
    }),
    2.0
  );
  
  // Pixelmatchに低い重みを設定
  builder.addWeighted(
    factory.createValidator('pixelmatch', { threshold: 0.05 }),
    1.0
  );
  
  const chain = builder.build();
  
  // 重み付き検証を実行
  if ('validateWithScore' in chain) {
    const result = await (chain as any).validateWithScore(
      { ...sampleLayoutInput, ...samplePixelmatchInput },
      context
    );
    
    console.log(`全体スコア: ${(result.overallScore * 100).toFixed(1)}%`);
    console.log(`結果: ${result.passed ? '合格' : '不合格'}`);
    console.log('\n個別結果:');
    result.results.forEach((r: any) => {
      console.log(`  ${r.validatorName}: ${r.passed ? '✅' : '❌'} (信頼度: ${(r.confidence * 100).toFixed(1)}%)`);
    });
  }
}

/**
 * 例4: 条件付きバリデーション
 */
async function example4_conditionalValidation() {
  console.log('\n=== 例4: 条件付きバリデーション ===\n');
  
  const factory = new ValidatorFactory();
  const builder = factory.createChainBuilder('conditional');
  
  // 常に実行: 基本的なレイアウトチェック
  builder.add(
    factory.createValidator('layout-visual', { threshold: 0.85 })
  );
  
  // 条件付き: 大きな差分がある場合のみPixelmatchを実行
  builder.addIf(
    factory.createValidator('pixelmatch', { threshold: 0.001 }),
    (input: any) => {
      // レイアウトの類似度が低い場合のみ実行
      if (input.comparison) {
        return input.comparison.layoutSimilarity < 0.9;
      }
      return true;
    }
  );
  
  // 条件付き: モバイルビューポートの場合は緩い閾値
  builder.addIf(
    factory.createValidator('layout-structure', { threshold: 0.80 }),
    (input: any, ctx: ValidationContext) => {
      return ctx.viewport!.width < 768; // モバイル幅
    }
  );
  
  const chain = builder.build();
  
  // テスト実行
  const mobileContext = { ...context, viewport: { width: 375, height: 667 } };
  const results = await chain.validateAll(sampleLayoutInput, mobileContext);
  
  console.log('モバイルビューポートでの条件付き検証結果:');
  results.forEach(result => {
    if (result.details?.skipped) {
      console.log(`⏭️  ${result.validatorName}: スキップ`);
    } else {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.validatorName}: ${result.message}`);
    }
  });
}

/**
 * 例5: 複合検証（レイアウト + Pixelmatch）
 */
async function example5_combinedValidation() {
  console.log('\n=== 例5: 複合検証（レイアウト + Pixelmatch） ===\n');
  
  const result = await validateCombined(
    sampleLayoutInput,
    samplePixelmatchInput,
    context,
    {
      layoutThreshold: 0.95,
      pixelThreshold: 0.01,
      enableAI: false // AI分析は無効
    }
  );
  
  console.log('複合検証の結果:');
  console.log(formatValidationResults(result, { verbose: true }));
}

/**
 * 例6: AI強化バリデーション（設定例）
 */
async function example6_aiEnhancedValidation() {
  console.log('\n=== 例6: AI強化バリデーション（設定例） ===\n');
  
  // 注意: 実際に動作させるにはAPIキーが必要
  const factory = new ValidatorFactory({
    enableAI: true,
    aiProvider: {
      type: 'gemini',
      apiKey: process.env.GOOGLE_API_KEY || 'your-api-key',
      model: 'gemini-2.0-flash-exp'
    }
  });
  
  try {
    const chain = factory.createFromPreset(ValidatorPreset.AI_ENHANCED);
    console.log('AI強化バリデーションチェーンが作成されました');
    console.log('実際の実行にはGemini APIキーが必要です');
  } catch (error) {
    console.log('エラー:', error instanceof Error ? error.message : error);
  }
}

// 全ての例を実行
async function runAllExamples() {
  await example1_presetValidation();
  await example2_pipelineValidation();
  await example3_customChain();
  await example4_conditionalValidation();
  await example5_combinedValidation();
  await example6_aiEnhancedValidation();
}

if (require.main === module) {
  runAllExamples().catch(console.error);
}