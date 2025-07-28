#!/usr/bin/env node
/**
 * V2 API - 適応的安定性チェックの使用例
 */

import { createPuppeteerDriverWithPage } from './create-puppeteer-page.js';
import {
  checkAdaptiveStability,
  generateStabilityReport,
  AdaptiveStabilityConfig
} from '../dist/v2/index.js';
import { writeFile, writeJSON, ensureDir } from '../dist/io/file.js';
import path from 'path';

async function runAdaptiveStabilityCheck(config: AdaptiveStabilityConfig) {
  const outputDir = config.outputDir || './output/v2-adaptive-stability';
  
  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'layouts'));
  await ensureDir(path.join(outputDir, 'progress'));
  
  // Puppeteerドライバーのファクトリー関数
  const createDriver = async () => {
    const driver = await createPuppeteerDriverWithPage({
      headless: true,
      viewport: config.viewport
    });
    return driver;
  };
  
  // 適応的安定性チェックを実行
  const result = await checkAdaptiveStability(createDriver, config);
  
  // 結果を保存
  await writeJSON(
    path.join(outputDir, 'stability-analysis.json'),
    result.analysis
  );
  
  await writeJSON(
    path.join(outputDir, 'recommended-config.json'),
    result.finalConfig
  );
  
  await writeJSON(
    path.join(outputDir, 'progress-history.json'),
    result.progressHistory
  );
  
  // HTMLレポートを生成
  const htmlReport = generateStabilityReport(
    result.analysis,
    result.progressHistory,
    result.finalConfig
  );
  
  await writeFile(
    path.join(outputDir, 'stability-report.html'),
    htmlReport
  );
  
  // レイアウトサマリーを個別に保存
  for (let i = 0; i < result.analysis.layoutSummaries.length; i++) {
    await writeJSON(
      path.join(outputDir, 'layouts', `summary-${i + 1}.json`),
      result.analysis.layoutSummaries[i]
    );
  }
  
  console.log(`\n📁 結果を保存しました: ${outputDir}/`);
  console.log('   - stability-analysis.json : 安定性分析結果');
  console.log('   - recommended-config.json : 推奨設定');
  console.log('   - progress-history.json   : 進捗履歴');
  console.log('   - stability-report.html   : HTMLレポート');
  console.log(`   - layouts/               : ${result.analysis.layoutSummaries.length}個のレイアウトサマリー`);
  
  return result;
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  const outputDir = process.argv[3] || './output/v2-adaptive-stability';
  
  if (!url || url === '--help') {
    console.log('使用方法:');
    console.log('  node v2-adaptive-stability.ts <url> [output-dir]');
    console.log('');
    console.log('例:');
    console.log('  node v2-adaptive-stability.ts https://example.com');
    console.log('  node v2-adaptive-stability.ts https://example.com ./output/stability');
    console.log('');
    console.log('説明:');
    console.log('  V2 APIを使用して適応的安定性チェックを実行します。');
    console.log('  レイアウトの類似度を使用して安定性を分析し、');
    console.log('  動的に反復回数を調整します。');
    process.exit(0);
  }
  
  const config: AdaptiveStabilityConfig = {
    url,
    outputDir,
    minIterations: 3,
    maxIterations: 10,
    targetStability: 95,
    earlyStopThreshold: 98,
    delay: 2000,
    viewport: { width: 1280, height: 720 }
  };
  
  runAdaptiveStabilityCheck(config).catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  });
}