/**
 * Pixelmatchライブラリの使用例
 */

import { join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import {
  executePixelmatch,
  executeRegionPixelmatch,
  createPixelmatchValidator,
  createSmartPixelmatchValidator,
  createValidationPipeline,
  ValidatorPreset,
  type ValidationContext
} from '../src/validator';

// 出力ディレクトリを作成
const outputDir = join(__dirname, 'output', 'pixelmatch');
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

/**
 * 例1: 基本的なPixelmatch実行
 */
async function example1_basicPixelmatch() {
  console.log('=== 例1: 基本的なPixelmatch実行 ===\n');
  
  // テスト画像のパス（実際の使用では実際の画像パスを指定）
  const baselineImage = join(__dirname, 'fixtures', 'baseline.png');
  const currentImage = join(__dirname, 'fixtures', 'current.png');
  const diffOutput = join(outputDir, 'diff-basic.png');
  
  try {
    // Pixelmatchを実行
    const result = executePixelmatch(baselineImage, currentImage, {
      threshold: 0.1, // 色差の閾値
      includeAA: true, // アンチエイリアスを含める
      outputDiffPath: diffOutput
    });
    
    console.log('Pixelmatch結果:');
    console.log(`- 異なるピクセル数: ${result.diffPixels}`);
    console.log(`- 全ピクセル数: ${result.totalPixels}`);
    console.log(`- 差分の割合: ${(result.diffPercentage * 100).toFixed(2)}%`);
    console.log(`- 差分画像: ${diffOutput}`);
    
  } catch (error) {
    console.error('エラー:', error);
    console.log('注意: この例を実行するには、examples/fixtures/に画像ファイルが必要です');
  }
}

/**
 * 例2: 領域ごとのPixelmatch
 */
async function example2_regionPixelmatch() {
  console.log('\n=== 例2: 領域ごとのPixelmatch ===\n');
  
  const baselineImage = join(__dirname, 'fixtures', 'baseline.png');
  const currentImage = join(__dirname, 'fixtures', 'current.png');
  
  // 検証したい領域を定義
  const regions = [
    { name: 'header', x: 0, y: 0, width: 1920, height: 100 },
    { name: 'navigation', x: 0, y: 100, width: 200, height: 800 },
    { name: 'main-content', x: 200, y: 100, width: 1520, height: 800 },
    { name: 'footer', x: 0, y: 900, width: 1920, height: 180 }
  ];
  
  try {
    const results = executeRegionPixelmatch(baselineImage, currentImage, regions, {
      threshold: 0.1,
      outputDiffPath: join(outputDir, 'diff-region.png')
    });
    
    console.log('領域ごとのPixelmatch結果:');
    results.forEach(({ region, result }) => {
      const status = result.diffPercentage < 0.01 ? '✅' : '❌';
      console.log(`${status} ${region.name}: ${(result.diffPercentage * 100).toFixed(2)}%の差分`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

/**
 * 例3: Pixelmatchバリデーターの使用
 */
async function example3_pixelmatchValidator() {
  console.log('\n=== 例3: Pixelmatchバリデーターの使用 ===\n');
  
  // バリデーターを作成
  const validator = createPixelmatchValidator(0.01, { // 1%の差分まで許容
    ignoreAntialiasing: true
  });
  
  const context: ValidationContext = {
    url: 'https://example.com',
    testName: 'homepage-visual-test'
  };
  
  // バリデーション入力（事前に計算された値を使用）
  const input = {
    baselineImage: 'path/to/baseline.png',
    currentImage: 'path/to/current.png',
    pixelDifference: 5000,
    totalPixels: 2073600, // 1920x1080
    threshold: 0.01
  };
  
  const result = await validator.validate(input, context);
  
  console.log('バリデーション結果:');
  console.log(`- 結果: ${result.passed ? '✅ 合格' : '❌ 不合格'}`);
  console.log(`- メッセージ: ${result.message}`);
  if (result.errorType) {
    console.log(`- エラータイプ: ${result.errorType}`);
  }
  if (result.suggestedAction) {
    console.log(`- 推奨アクション: ${result.suggestedAction}`);
  }
}

/**
 * 例4: スマートPixelmatchバリデーター
 */
async function example4_smartPixelmatch() {
  console.log('\n=== 例4: スマートPixelmatchバリデーター ===\n');
  
  // 重要な領域を定義してスマートバリデーターを作成
  const validator = createSmartPixelmatchValidator({
    threshold: 0.02, // 2%の差分まで許容
    focusRegions: [
      { name: 'logo', x: 10, y: 10, width: 200, height: 80, weight: 2.0 },
      { name: 'main-cta', x: 860, y: 400, width: 200, height: 60, weight: 1.5 },
      { name: 'footer', x: 0, y: 900, width: 1920, height: 180, weight: 0.5 }
    ]
  });
  
  const context: ValidationContext = {
    url: 'https://example.com',
    testName: 'critical-areas-test'
  };
  
  const input = {
    baselineImage: 'path/to/baseline.png',
    currentImage: 'path/to/current.png'
  };
  
  // 実際の画像がない場合のモック結果
  console.log('スマートPixelmatchバリデーターが作成されました');
  console.log('重要領域:');
  console.log('- logo (重み: 2.0)');
  console.log('- main-cta (重み: 1.5)');
  console.log('- footer (重み: 0.5)');
  console.log('\n重要な領域により高い重みが設定され、それらの変更はより厳しく評価されます');
}

/**
 * 例5: バリデーションパイプラインでのPixelmatch
 */
async function example5_validationPipeline() {
  console.log('\n=== 例5: バリデーションパイプラインでのPixelmatch ===\n');
  
  // STRICTプリセットを使用（Pixelmatchが含まれる）
  const pipeline = createValidationPipeline(ValidatorPreset.STRICT);
  
  const context: ValidationContext = {
    url: 'https://example.com',
    testName: 'strict-visual-test',
    viewport: { width: 1920, height: 1080 }
  };
  
  // レイアウトとPixelmatchの両方の入力を含む
  const input = {
    // レイアウト情報
    baseline: {
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      semanticGroups: [],
      totalElements: 50,
      statistics: {
        groupCount: 5,
        patternCount: 2,
        interactiveElements: 10,
        accessibilityCount: 45
      }
    },
    current: {
      url: 'https://example.com',
      timestamp: new Date().toISOString(),
      viewport: { width: 1920, height: 1080 },
      semanticGroups: [],
      totalElements: 48,
      statistics: {
        groupCount: 5,
        patternCount: 2,
        interactiveElements: 10,
        accessibilityCount: 43
      }
    },
    // Pixelmatch情報
    baselineImage: 'path/to/baseline.png',
    currentImage: 'path/to/current.png',
    pixelDifference: 100,
    totalPixels: 2073600
  };
  
  const result = await pipeline(input, context);
  
  console.log('パイプライン実行結果:');
  console.log(`- 全体の結果: ${result.passed ? '✅ 合格' : '❌ 不合格'}`);
  console.log(`- 信頼度: ${(result.overallConfidence * 100).toFixed(1)}%`);
  console.log(`- 実行されたバリデーター数: ${result.summary.totalValidators}`);
  console.log(`- 合格したバリデーター数: ${result.summary.passedValidators}`);
  console.log(`- 推奨アクション: ${result.recommendedAction}`);
}

// 全ての例を実行
async function runAllExamples() {
  await example1_basicPixelmatch();
  await example2_regionPixelmatch();
  await example3_pixelmatchValidator();
  await example4_smartPixelmatch();
  await example5_validationPipeline();
}

if (require.main === module) {
  runAllExamples().catch(console.error);
}