#!/usr/bin/env node
/**
 * V2 API - 複数サマリーからSVG一括生成
 */

import { renderLayoutToSVG, LayoutSummary } from '../dist/v2/index.js';
import { readJSON, writeFile, ensureDir } from '../dist/io/file.js';
import path from 'path';
import fs from 'fs/promises';

async function batchGenerateSVGFromSummaries(inputDir: string, outputDir: string) {
  await ensureDir(outputDir);
  
  // サマリーファイルを検索
  const files = await fs.readdir(inputDir);
  const summaryFiles = files
    .filter(f => f.startsWith('summary-') && f.endsWith('.json'))
    .map(f => path.join(inputDir, f));
  
  if (summaryFiles.length === 0) {
    console.log('❌ サマリーファイルが見つかりません');
    return;
  }
  
  console.log(`📁 ${summaryFiles.length}個のサマリーファイルを発見`);
  
  for (const summaryPath of summaryFiles) {
    const baseName = path.basename(summaryPath, '.json');
    console.log(`\n📄 処理中: ${baseName}`);
    
    try {
      const summary = await readJSON<LayoutSummary>(summaryPath);
      console.log(`   ノード数: ${summary.nodes.length}`);
      
      // セマンティックSVGを生成（一番わかりやすい）
      const svg = renderLayoutToSVG(summary, {
        colorScheme: 'semantic',
        showLabels: true,
        showImportance: false
      });
      
      const outputPath = path.join(outputDir, `${baseName}-semantic.svg`);
      await writeFile(outputPath, svg);
      console.log(`   ✅ ${baseName}-semantic.svg を保存`);
      
      // 重要度SVGも生成
      const importanceSvg = renderLayoutToSVG(summary, {
        colorScheme: 'importance',
        showLabels: false,
        showImportance: true
      });
      
      const importancePath = path.join(outputDir, `${baseName}-importance.svg`);
      await writeFile(importancePath, importanceSvg);
      console.log(`   ✅ ${baseName}-importance.svg を保存`);
      
    } catch (error) {
      console.error(`   ❌ エラー: ${error}`);
    }
  }
  
  console.log(`\n✅ 完了！結果: ${outputDir}/`);
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputDir = process.argv[2];
  const outputDir = process.argv[3] || './output/batch-svg';
  
  if (!inputDir || inputDir === '--help') {
    console.log('使用方法:');
    console.log('  node v2-batch-summary-to-svg.ts <input-dir> [output-dir]');
    console.log('');
    console.log('例:');
    console.log('  node v2-batch-summary-to-svg.ts ./output/zenn-stability-v2/layouts');
    console.log('  node v2-batch-summary-to-svg.ts ./summaries ./output/svg');
    console.log('');
    console.log('説明:');
    console.log('  指定ディレクトリ内のすべてのsummary-*.jsonファイルから');
    console.log('  SVGを一括生成します。');
    process.exit(0);
  }
  
  batchGenerateSVGFromSummaries(inputDir, outputDir).catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  });
}