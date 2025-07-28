#!/usr/bin/env node
/**
 * V2 API - サマリーからSVG生成の使用例
 */

import { renderLayoutToSVG, SVGRenderOptions, LayoutSummary } from '../dist/v2/index.js';
import { readJSON, writeFile, ensureDir } from '../dist/io/file.js';
import path from 'path';

async function generateSVGFromSummary(summaryPath: string, outputDir: string) {
  await ensureDir(outputDir);
  
  console.log(`📄 サマリーファイルを読み込み中: ${summaryPath}`);
  const summary = await readJSON<LayoutSummary>(summaryPath);
  
  console.log(`✅ ${summary.nodes.length}個のノードを検出`);
  console.log(`   ビューポート: ${summary.viewport.width}x${summary.viewport.height}`);
  
  // 異なるカラースキームでSVGを生成
  const colorSchemes: Array<{ scheme: SVGRenderOptions['colorScheme']; name: string }> = [
    { scheme: 'semantic', name: 'semantic' },
    { scheme: 'importance', name: 'importance' },
    { scheme: 'monochrome', name: 'monochrome' },
    { scheme: 'interactive', name: 'interactive' }
  ];
  
  for (const { scheme, name } of colorSchemes) {
    console.log(`\n🎨 ${name} SVGを生成中...`);
    
    const svg = renderLayoutToSVG(summary, {
      colorScheme: scheme,
      showLabels: true,
      showImportance: scheme === 'importance'
    });
    
    const fileName = `summary-${name}.svg`;
    await writeFile(path.join(outputDir, fileName), svg);
    console.log(`   ✅ ${fileName} を保存`);
  }
  
  // 統計情報を表示
  console.log('\n📊 レイアウト統計:');
  console.log(`   総ノード数: ${summary.statistics.totalNodes}`);
  console.log(`   平均重要度: ${summary.statistics.averageImportance.toFixed(1)}`);
  console.log('\n   セマンティックタイプ別:');
  for (const [type, count] of Object.entries(summary.statistics.bySemanticType)) {
    console.log(`     ${type}: ${count}`);
  }
  
  if (summary.statistics.byRole && Object.keys(summary.statistics.byRole).length > 0) {
    console.log('\n   ロール別:');
    for (const [role, count] of Object.entries(summary.statistics.byRole)) {
      console.log(`     ${role}: ${count}`);
    }
  }
  
  console.log(`\n📁 結果を保存しました: ${outputDir}/`);
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const summaryPath = process.argv[2];
  const outputDir = process.argv[3] || './output/summary-svg';
  
  if (!summaryPath || summaryPath === '--help') {
    console.log('使用方法:');
    console.log('  node v2-summary-to-svg.ts <summary-file> [output-dir]');
    console.log('');
    console.log('例:');
    console.log('  node v2-summary-to-svg.ts ./output/zenn-stability-v2/layouts/summary-1.json');
    console.log('  node v2-summary-to-svg.ts ./summary.json ./output/svg');
    console.log('');
    console.log('説明:');
    console.log('  保存されたレイアウトサマリーファイルからSVGを生成します。');
    console.log('  4つの異なるカラースキームで出力されます。');
    process.exit(0);
  }
  
  generateSVGFromSummary(summaryPath, outputDir).catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  });
}