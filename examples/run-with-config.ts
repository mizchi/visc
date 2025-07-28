#!/usr/bin/env node
import { test } from 'node:test';
import { createStableVisualAssert, assertStableVisualMatch } from '../dist/assertion/stable-visual.js';
import { readFile, writeJSON, ensureDir } from '../dist/io/file.js';
import path from 'path';

interface TestOptions {
  configPath: string;
  originalUrl: string;
  refactoredUrl: string;
  testName?: string;
  outputDir?: string;
}

async function runVisualTestWithConfig(options: TestOptions) {
  const {
    configPath,
    originalUrl,
    refactoredUrl,
    testName = 'visual-test',
    outputDir = './output/test-results'
  } = options;

  // 設定ファイルを読み込む
  const configContent = await readFile(configPath);
  const config = JSON.parse(configContent);
  
  console.log('📋 安定性設定を使用したテスト実行');
  console.log(`   設定ファイル: ${configPath}`);
  console.log(`   安定性スコア: ${config.stability.overallStability}%`);
  console.log(`   許容閾値: ${config.stability.toleranceThreshold}px`);
  console.log(`   信頼度: ${(config.stability.confidenceLevel * 100).toFixed(0)}%`);
  
  if (config.stability.ignoreSelectors?.length > 0) {
    console.log(`   無視するセレクタ: ${config.stability.ignoreSelectors.join(', ')}`);
  }
  
  console.log('\n🔗 比較するURL:');
  console.log(`   オリジナル: ${originalUrl}`);
  console.log(`   リファクタ後: ${refactoredUrl}`);

  // 出力ディレクトリを作成
  const testOutputDir = path.join(outputDir, testName);
  await ensureDir(testOutputDir);

  // 安定的な視覚アサーションを作成
  const stableAssert = await createStableVisualAssert({
    outputDir: testOutputDir,
    stabilityConfig: config,
    viewport: config.viewport
  });

  try {
    console.log('\n🔍 視覚的差分のテスト開始...');
    
    // URLを比較
    const result = await stableAssert.compareStableUrls(
      originalUrl,
      refactoredUrl,
      testName
    );
    
    // 結果を表示
    console.log('\n📊 テスト結果:');
    console.log(`   差分: ${result.differencePercentage}`);
    console.log(`   差分ピクセル: ${result.diffPixels}`);
    console.log(`   判定: ${result.passed ? '✅ 合格' : '❌ 不合格'}`);
    
    if (result.stabilityAdjusted) {
      console.log(`   安定性調整: 適用済み`);
      if (result.ignoredDifferences) {
        console.log(`   無視された差分:`);
        console.log(`     - ノード数: ${result.ignoredDifferences.nodes}`);
        if (result.ignoredDifferences.attributes.length > 0) {
          console.log(`     - 属性: ${result.ignoredDifferences.attributes.join(', ')}`);
        }
      }
    }
    
    console.log('\n📁 出力ファイル:');
    console.log(`   オリジナル: ${result.files.original}`);
    console.log(`   リファクタ後: ${result.files.refactored}`);
    if (result.files.diff) {
      console.log(`   差分画像: ${result.files.diff}`);
    }
    
    // テスト結果をJSONで保存
    const testResult = {
      testName,
      timestamp: new Date().toISOString(),
      config: {
        source: configPath,
        stability: config.stability
      },
      urls: {
        original: originalUrl,
        refactored: refactoredUrl
      },
      result: {
        passed: result.passed,
        difference: result.difference,
        differencePercentage: result.differencePercentage,
        diffPixels: result.diffPixels,
        stabilityAdjusted: result.stabilityAdjusted,
        ignoredDifferences: result.ignoredDifferences
      },
      files: result.files
    };
    
    await writeJSON(path.join(testOutputDir, 'test-result.json'), testResult);
    
    // アサーション
    await assertStableVisualMatch(result, '視覚的差分が許容範囲を超えています');
    
    console.log('\n✅ テスト完了！');
    
  } finally {
    await stableAssert.cleanup();
  }
}

// 規約ベースのテスト実行
async function runConventionBasedTest(options: {
  configPath: string;
  testName: string;
  outputDir?: string;
}) {
  const { configPath, testName, outputDir = './output/test-results' } = options;
  
  // 設定ファイルを読み込む
  const configContent = await readFile(configPath);
  const config = JSON.parse(configContent);
  
  console.log('📋 規約ベースのテスト実行');
  console.log(`   テスト名: ${testName}`);
  console.log(`   設定ファイル: ${configPath}`);
  
  // 出力ディレクトリを作成
  const testOutputDir = path.join(outputDir, testName);
  await ensureDir(testOutputDir);
  
  // 安定的な視覚アサーションを作成
  const stableAssert = await createStableVisualAssert({
    outputDir: testOutputDir,
    stabilityConfig: config,
    viewport: config.viewport
  });
  
  try {
    console.log('\n🔍 セマンティックレイアウトの比較開始...');
    
    // 規約ベースの比較（assets/{testName}/）
    const result = await stableAssert.compareStableSemanticLayout(testName);
    
    // 結果を表示
    console.log('\n📊 テスト結果:');
    console.log(`   差分: ${result.differencePercentage}`);
    console.log(`   判定: ${result.passed ? '✅ 合格' : '❌ 不合格'}`);
    
    // アサーション
    await assertStableVisualMatch(result);
    
    console.log('\n✅ テスト完了！');
    
  } finally {
    await stableAssert.cleanup();
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (!command || command === '--help') {
    console.log('使用方法:');
    console.log('  URL比較モード:');
    console.log('    node run-with-config.ts compare <config-path> <original-url> <refactored-url> [options]');
    console.log('');
    console.log('  規約ベースモード:');
    console.log('    node run-with-config.ts test <config-path> <test-name> [options]');
    console.log('');
    console.log('オプション:');
    console.log('  --name=<name>     テスト名を指定（デフォルト: visual-test）');
    console.log('  --outdir=<path>   出力ディレクトリ（デフォルト: ./output/test-results）');
    console.log('');
    console.log('例:');
    console.log('  # URL比較');
    console.log('  node run-with-config.ts compare ./output/stability/recommended-config.json \\');
    console.log('    https://example.com/original https://example.com/refactored');
    console.log('');
    console.log('  # 規約ベーステスト');
    console.log('  node run-with-config.ts test ./output/stability/recommended-config.json main');
    process.exit(0);
  }
  
  const configPath = process.argv[3];
  if (!configPath) {
    console.error('エラー: 設定ファイルのパスを指定してください');
    process.exit(1);
  }
  
  // オプションを解析
  const getName = () => process.argv.find(arg => arg.startsWith('--name='))?.split('=')[1];
  const getOutdir = () => process.argv.find(arg => arg.startsWith('--outdir='))?.split('=')[1];
  
  if (command === 'compare') {
    const originalUrl = process.argv[4];
    const refactoredUrl = process.argv[5];
    
    if (!originalUrl || !refactoredUrl) {
      console.error('エラー: 比較するURLを2つ指定してください');
      process.exit(1);
    }
    
    test('設定ベースのURL比較テスト', async () => {
      await runVisualTestWithConfig({
        configPath,
        originalUrl,
        refactoredUrl,
        testName: getName() || 'url-comparison',
        outputDir: getOutdir()
      });
    });
    
  } else if (command === 'test') {
    const testName = process.argv[4];
    
    if (!testName) {
      console.error('エラー: テスト名を指定してください');
      process.exit(1);
    }
    
    test('設定ベースの規約テスト', async () => {
      await runConventionBasedTest({
        configPath,
        testName,
        outputDir: getOutdir()
      });
    });
    
  } else {
    console.error(`エラー: 不明なコマンド "${command}"`);
    console.error('compare または test を使用してください');
    process.exit(1);
  }
}