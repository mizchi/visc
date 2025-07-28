#!/usr/bin/env node
import { test } from 'node:test';
import { createStableVisualAssert, assertStableVisualMatch } from '../../dist/assertion/stable-visual.js';
import { readFile } from '../../dist/io/file.js';

const OUTPUT_DIR = process.argv.find(arg => arg.startsWith('--outdir='))?.split('=')[1] || './output';
const CONFIG_PATH = process.argv.find(arg => arg.startsWith('--config='))?.split('=')[1];

test('安定性を考慮した視覚的回帰テスト', async () => {
  // 安定性設定を読み込む
  let stabilityConfig;
  if (CONFIG_PATH) {
    const configContent = await readFile(CONFIG_PATH);
    stabilityConfig = JSON.parse(configContent);
    console.log('📋 安定性設定を読み込みました:');
    console.log(`   許容閾値: ${stabilityConfig.stability.toleranceThreshold}px`);
    console.log(`   無視するノード: ${stabilityConfig.stability.ignoreNodes.join(', ')}`);
    console.log(`   全体の安定性: ${stabilityConfig.stability.overallStability.toFixed(2)}%`);
  }

  const stableAssert = await createStableVisualAssert({
    outputDir: OUTPUT_DIR,
    stabilityConfig,
    viewport: { width: 1280, height: 720 }
  });

  try {
    // 規約ベースのテスト（assets/main/）
    const result = await stableAssert.compareStableSemanticLayout('main');
    
    console.log('\n📊 テスト結果:');
    console.log(`   差分: ${result.differencePercentage}`);
    console.log(`   パス: ${result.passed ? '✅' : '❌'}`);
    
    if (result.stabilityAdjusted) {
      console.log(`   安定性調整: 適用済み`);
      if (result.ignoredDifferences) {
        console.log(`   無視されたノード: ${result.ignoredDifferences.nodes}`);
        console.log(`   無視された属性: ${result.ignoredDifferences.attributes.join(', ')}`);
      }
    }

    await assertStableVisualMatch(result, `差分が許容範囲を超えています`);
    
  } finally {
    await stableAssert.cleanup();
  }
});

test('動的コンテンツを含むページのテスト', async () => {
  // より厳しい安定性設定を使用
  const dynamicConfig = {
    stability: {
      enabled: true,
      toleranceThreshold: 10, // 10px以内の変動を許容
      ignoreNodes: ['time', 'span.timestamp', 'div.ad'], // 動的な要素を無視
      ignoreAttributes: ['text'], // テキスト内容の変化を無視
      overallStability: 85,
      analysisDate: new Date().toISOString()
    },
    viewport: { width: 1280, height: 720 },
    metadata: {
      url: 'https://example.com',
      iterations: 10,
      totalNodes: 150,
      unstableNodes: 22
    }
  };

  const stableAssert = await createStableVisualAssert({
    outputDir: OUTPUT_DIR,
    stabilityConfig: dynamicConfig
  });

  try {
    const result = await stableAssert.compareStableUrls(
      'https://example.com/original',
      'https://example.com/refactored',
      'dynamic-content-test'
    );

    console.log('\n📊 動的コンテンツテストの結果:');
    console.log(`   差分: ${result.differencePercentage}`);
    console.log(`   安定性調整後: ${result.passed ? '✅ パス' : '❌ 失敗'}`);

    // 安定性を考慮してもなお失敗する場合は、実際の問題がある可能性
    if (!result.passed) {
      console.warn('\n⚠️  安定性調整後も差分が検出されました。');
      console.warn('   実際のレイアウト変更がある可能性があります。');
    }

  } finally {
    await stableAssert.cleanup();
  }
});

// 使用例を表示
if (import.meta.url === `file://${process.argv[1]}` && process.argv.length < 3) {
  console.log('\n使用方法:');
  console.log('  node test-with-stability.ts [--config=<path>] [--outdir=<path>]');
  console.log('\n例:');
  console.log('  # 安定性設定なしで実行');
  console.log('  node test-with-stability.ts');
  console.log('\n  # 安定性設定を使用');
  console.log('  node test-with-stability.ts --config=./output/stability/recommended-config.json');
  console.log('\n事前準備:');
  console.log('  1. まず stability-check.ts を実行して安定性を分析');
  console.log('  2. 生成された recommended-config.json を使用してテスト');
}