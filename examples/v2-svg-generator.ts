#!/usr/bin/env node
/**
 * V2 API - SVG生成の使用例
 */

import { createPuppeteerDriverWithPage } from './create-puppeteer-page.js';
import {
  extractLayout,
  summarizeLayout,
  renderLayoutToSVG,
  SVGRenderOptions
} from '../dist/v2/index.js';
import { writeFile, ensureDir } from '../dist/io/file.js';
import path from 'path';

async function generateLayoutSVG(url: string, outputDir: string) {
  await ensureDir(outputDir);
  
  // Puppeteerドライバーを作成
  const driver = await createPuppeteerDriverWithPage({
    headless: true,
    viewport: { width: 1280, height: 720 }
  });
  
  try {
    console.log(`📸 ${url} のレイアウトを取得中...`);
    await driver.goto(url);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // レイアウトを抽出して要約
    const layout = await extractLayout(driver);
    const summary = summarizeLayout(layout);
    
    console.log(`✅ ${summary.nodes.length}個のノードを検出`);
    
    // 異なるカラースキームでSVGを生成
    const colorSchemes: Array<{ scheme: SVGRenderOptions['colorScheme']; name: string }> = [
      { scheme: 'semantic', name: 'semantic' },
      { scheme: 'importance', name: 'importance' },
      { scheme: 'monochrome', name: 'monochrome' },
      { scheme: 'interactive', name: 'interactive' }
    ];
    
    for (const { scheme, name } of colorSchemes) {
      console.log(`🎨 ${name} SVGを生成中...`);
      
      const svg = renderLayoutToSVG(summary, {
        colorScheme: scheme,
        showLabels: true,
        showImportance: scheme === 'importance'
      });
      
      const fileName = `layout-${name}.svg`;
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
    
  } finally {
    await driver.close();
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  const outputDir = process.argv[3] || './output/v2-svg';
  
  if (!url || url === '--help') {
    console.log('使用方法:');
    console.log('  node v2-svg-generator.ts <url> [output-dir]');
    console.log('');
    console.log('例:');
    console.log('  node v2-svg-generator.ts https://example.com');
    console.log('  node v2-svg-generator.ts https://zenn.dev ./output/zenn-svg');
    process.exit(0);
  }
  
  generateLayoutSVG(url, outputDir).catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  });
}