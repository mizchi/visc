#!/usr/bin/env node
import { test } from 'node:test';
import { createStableVisualAssert, assertStableVisualMatch } from '../dist/assertion/stable-visual.js';
import { readFile, writeJSON, ensureDir, writeFile } from '../dist/io/file.js';
import path from 'path';
import { readdir } from 'fs/promises';

interface BatchTestConfig {
  name: string;
  description?: string;
  configPath: string;
  tests: Array<{
    name: string;
    type: 'url' | 'convention';
    urls?: {
      original: string;
      refactored: string;
    };
    skip?: boolean;
  }>;
}

interface BatchTestResult {
  name: string;
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: Array<{
    name: string;
    passed: boolean;
    skipped?: boolean;
    error?: string;
    difference?: string;
    duration: number;
  }>;
}

async function runBatchTests(configPath: string, outputDir: string = './output/batch-results') {
  // バッチ設定を読み込む
  const batchConfigContent = await readFile(configPath);
  const batchConfig: BatchTestConfig = JSON.parse(batchConfigContent);
  
  console.log('🚀 バッチテスト実行開始');
  console.log(`   名前: ${batchConfig.name}`);
  if (batchConfig.description) {
    console.log(`   説明: ${batchConfig.description}`);
  }
  console.log(`   テスト数: ${batchConfig.tests.length}`);
  console.log(`   安定性設定: ${batchConfig.configPath}`);
  console.log('');
  
  // 安定性設定を読み込む
  const stabilityConfigContent = await readFile(batchConfig.configPath);
  const stabilityConfig = JSON.parse(stabilityConfigContent);
  
  // 出力ディレクトリを作成
  const batchOutputDir = path.join(outputDir, batchConfig.name, new Date().toISOString().replace(/:/g, '-'));
  await ensureDir(batchOutputDir);
  
  // バッチ結果を初期化
  const batchResult: BatchTestResult = {
    name: batchConfig.name,
    timestamp: new Date().toISOString(),
    totalTests: batchConfig.tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    results: []
  };
  
  const startTime = Date.now();
  
  // 各テストを実行
  for (const testConfig of batchConfig.tests) {
    const testStartTime = Date.now();
    
    if (testConfig.skip) {
      console.log(`⏭️  ${testConfig.name} - スキップ`);
      batchResult.skipped++;
      batchResult.results.push({
        name: testConfig.name,
        passed: false,
        skipped: true,
        duration: 0
      });
      continue;
    }
    
    console.log(`\n📝 テスト: ${testConfig.name}`);
    
    const testOutputDir = path.join(batchOutputDir, testConfig.name);
    await ensureDir(testOutputDir);
    
    const stableAssert = await createStableVisualAssert({
      outputDir: testOutputDir,
      stabilityConfig,
      viewport: stabilityConfig.viewport
    });
    
    try {
      let result;
      
      if (testConfig.type === 'url' && testConfig.urls) {
        console.log(`   タイプ: URL比較`);
        console.log(`   オリジナル: ${testConfig.urls.original}`);
        console.log(`   リファクタ後: ${testConfig.urls.refactored}`);
        
        result = await stableAssert.compareStableUrls(
          testConfig.urls.original,
          testConfig.urls.refactored,
          testConfig.name
        );
      } else if (testConfig.type === 'convention') {
        console.log(`   タイプ: 規約ベース`);
        console.log(`   パス: assets/${testConfig.name}/`);
        
        result = await stableAssert.compareStableSemanticLayout(testConfig.name);
      } else {
        throw new Error(`不明なテストタイプ: ${testConfig.type}`);
      }
      
      // 結果を記録
      if (result.passed) {
        console.log(`   ✅ 合格 (差分: ${result.differencePercentage})`);
        batchResult.passed++;
      } else {
        console.log(`   ❌ 不合格 (差分: ${result.differencePercentage})`);
        batchResult.failed++;
      }
      
      const testDuration = Date.now() - testStartTime;
      batchResult.results.push({
        name: testConfig.name,
        passed: result.passed,
        difference: result.differencePercentage,
        duration: testDuration
      });
      
      // 個別のテスト結果を保存
      await writeJSON(path.join(testOutputDir, 'result.json'), {
        ...result,
        testConfig,
        duration: testDuration
      });
      
    } catch (error) {
      console.log(`   ❌ エラー: ${error instanceof Error ? error.message : String(error)}`);
      batchResult.failed++;
      
      const testDuration = Date.now() - testStartTime;
      batchResult.results.push({
        name: testConfig.name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: testDuration
      });
    } finally {
      await stableAssert.cleanup();
    }
  }
  
  batchResult.duration = Date.now() - startTime;
  
  // サマリーを表示
  console.log('\n' + '='.repeat(60));
  console.log('📊 バッチテスト結果サマリー');
  console.log('='.repeat(60));
  console.log(`総テスト数: ${batchResult.totalTests}`);
  console.log(`✅ 合格: ${batchResult.passed}`);
  console.log(`❌ 不合格: ${batchResult.failed}`);
  console.log(`⏭️  スキップ: ${batchResult.skipped}`);
  console.log(`⏱️  実行時間: ${(batchResult.duration / 1000).toFixed(2)}秒`);
  console.log('');
  
  // 結果の詳細
  console.log('詳細:');
  for (const result of batchResult.results) {
    const status = result.skipped ? '⏭️' : result.passed ? '✅' : '❌';
    const info = result.skipped ? 'スキップ' : 
                 result.error ? `エラー: ${result.error}` :
                 `差分: ${result.difference}`;
    console.log(`  ${status} ${result.name} - ${info}`);
  }
  
  // バッチ結果を保存
  await writeJSON(path.join(batchOutputDir, 'batch-result.json'), batchResult);
  
  // HTMLレポートを生成
  await generateHTMLReport(batchResult, batchOutputDir);
  
  console.log(`\n📁 結果は以下に保存されました: ${batchOutputDir}`);
  
  // 失敗があった場合はエラーを投げる
  if (batchResult.failed > 0) {
    throw new Error(`${batchResult.failed}個のテストが失敗しました`);
  }
}

async function generateHTMLReport(result: BatchTestResult, outputDir: string) {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>バッチテスト結果 - ${result.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1, h2 {
      color: #333;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .stat {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat.passed { background-color: #d4edda; color: #155724; }
    .stat.failed { background-color: #f8d7da; color: #721c24; }
    .stat.skipped { background-color: #fff3cd; color: #856404; }
    .stat.total { background-color: #d1ecf1; color: #0c5460; }
    .stat h3 { margin: 0; font-size: 2rem; }
    .stat p { margin: 5px 0 0 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    .status-icon {
      font-size: 1.2rem;
    }
    .meta {
      color: #666;
      font-size: 0.9rem;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>バッチテスト結果: ${result.name}</h1>
    <p class="meta">実行日時: ${new Date(result.timestamp).toLocaleString('ja-JP')}</p>
    
    <div class="summary">
      <div class="stat total">
        <h3>${result.totalTests}</h3>
        <p>総テスト数</p>
      </div>
      <div class="stat passed">
        <h3>${result.passed}</h3>
        <p>合格</p>
      </div>
      <div class="stat failed">
        <h3>${result.failed}</h3>
        <p>不合格</p>
      </div>
      <div class="stat skipped">
        <h3>${result.skipped}</h3>
        <p>スキップ</p>
      </div>
    </div>
    
    <h2>テスト結果詳細</h2>
    <table>
      <thead>
        <tr>
          <th>状態</th>
          <th>テスト名</th>
          <th>結果</th>
          <th>実行時間</th>
        </tr>
      </thead>
      <tbody>
        ${result.results.map(test => `
          <tr>
            <td class="status-icon">
              ${test.skipped ? '⏭️' : test.passed ? '✅' : '❌'}
            </td>
            <td>${test.name}</td>
            <td>
              ${test.skipped ? 'スキップ' :
                test.error ? `エラー: ${test.error}` :
                `差分: ${test.difference || 'N/A'}`}
            </td>
            <td>${(test.duration / 1000).toFixed(2)}秒</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <p class="meta">総実行時間: ${(result.duration / 1000).toFixed(2)}秒</p>
  </div>
</body>
</html>`;
  
  await writeFile(path.join(outputDir, 'report.html'), html);
}

// 設定ファイルを自動検出
async function findBatchConfigs(dir: string = './batch-tests'): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(dir, file));
  } catch (error) {
    return [];
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const configPath = process.argv[2];
  const outputDir = process.argv[3];
  
  if (!configPath || configPath === '--help') {
    console.log('使用方法:');
    console.log('  node batch-test-runner.ts <batch-config-path> [output-dir]');
    console.log('');
    console.log('  node batch-test-runner.ts --auto [directory] [output-dir]');
    console.log('');
    console.log('例:');
    console.log('  # 単一のバッチ設定を実行');
    console.log('  node batch-test-runner.ts ./batch-tests/regression-tests.json');
    console.log('');
    console.log('  # ディレクトリ内の全ての設定を実行');
    console.log('  node batch-test-runner.ts --auto ./batch-tests');
    console.log('');
    console.log('バッチ設定ファイルの例:');
    console.log(`{
  "name": "regression-tests",
  "description": "リグレッションテストスイート",
  "configPath": "./output/stability/recommended-config.json",
  "tests": [
    {
      "name": "homepage",
      "type": "url",
      "urls": {
        "original": "https://example.com",
        "refactored": "https://example-new.com"
      }
    },
    {
      "name": "main-layout",
      "type": "convention"
    },
    {
      "name": "experimental-feature",
      "type": "convention",
      "skip": true
    }
  ]
}`);
    process.exit(0);
  }
  
  if (configPath === '--auto') {
    const dir = process.argv[3] || './batch-tests';
    const autoOutputDir = process.argv[4] || './output/batch-results';
    
    console.log(`🔍 バッチ設定ファイルを検索中: ${dir}`);
    const configs = await findBatchConfigs(dir);
    
    if (configs.length === 0) {
      console.log('バッチ設定ファイルが見つかりませんでした');
      process.exit(1);
    }
    
    console.log(`${configs.length}個の設定ファイルが見つかりました`);
    
    for (const config of configs) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`実行中: ${config}`);
      console.log('='.repeat(60));
      
      test(`バッチテスト: ${path.basename(config)}`, async () => {
        await runBatchTests(config, autoOutputDir);
      });
    }
  } else {
    test('バッチテスト実行', async () => {
      await runBatchTests(configPath, outputDir);
    });
  }
}