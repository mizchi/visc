#!/usr/bin/env node
/**
 * V2 API使用例
 */

import { createPuppeteerDriverWithPage } from './create-puppeteer-page.js';
import {
  extractLayout,
  summarizeLayout,
  calculateLayoutSimilarity,
  generateSimilarityReport,
  renderLayoutToSVG
} from '../dist/v2/index.js';
import { writeFile, ensureDir } from '../dist/io/file.js';
import path from 'path';

async function compareLayouts(url1: string, url2: string) {
  console.log('🔍 V2 APIを使用したレイアウト比較');
  console.log(`   URL1: ${url1}`);
  console.log(`   URL2: ${url2}`);
  
  const outputDir = './output/v2-comparison';
  await ensureDir(outputDir);
  
  const driver1 = await createPuppeteerDriverWithPage({ headless: true });
  const driver2 = await createPuppeteerDriverWithPage({ headless: true });
  
  try {
    // レイアウト1を抽出
    console.log('\n📊 レイアウト1を抽出中...');
    await driver1.goto(url1);
    await driver1.setViewport({ width: 1280, height: 720 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const layout1 = await extractLayout(driver1);
    
    // レイアウト2を抽出
    console.log('📊 レイアウト2を抽出中...');
    await driver2.goto(url2);
    await driver2.setViewport({ width: 1280, height: 720 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    const layout2 = await extractLayout(driver2);
    
    // レイアウトを要約
    console.log('\n📋 レイアウトを要約中...');
    const summary1 = summarizeLayout(layout1);
    const summary2 = summarizeLayout(layout2);
    
    console.log(`   レイアウト1: ${summary1.nodes.length}個のノード`);
    console.log(`   レイアウト2: ${summary2.nodes.length}個のノード`);
    
    // 類似度を計算
    console.log('\n📈 類似度を計算中...');
    const similarity = calculateLayoutSimilarity(summary1, summary2);
    
    console.log('\n📊 類似度結果:');
    console.log(`   全体的な類似度: ${(similarity.overallSimilarity * 100).toFixed(1)}%`);
    console.log(`   座標の類似度: ${(similarity.coordinateSimilarity * 100).toFixed(1)}%`);
    console.log(`   アクセシビリティの類似度: ${(similarity.accessibilitySimilarity * 100).toFixed(1)}%`);
    console.log(`   テキストの類似度: ${(similarity.textSimilarity * 100).toFixed(1)}%`);
    console.log(`   テキスト長の類似度: ${(similarity.textLengthSimilarity * 100).toFixed(1)}%`);
    
    // レポートを生成
    const report = generateSimilarityReport(similarity);
    await writeFile(
      path.join(outputDir, 'similarity-report.md'),
      report
    );
    
    // SVGを生成
    console.log('\n🎨 SVGを生成中...');
    const svg1 = renderLayoutToSVG(summary1, {
      colorScheme: 'semantic',
      showLabels: true,
      showImportance: true
    });
    const svg2 = renderLayoutToSVG(summary2, {
      colorScheme: 'semantic',
      showLabels: true,
      showImportance: true
    });
    
    await writeFile(path.join(outputDir, 'layout1.svg'), svg1);
    await writeFile(path.join(outputDir, 'layout2.svg'), svg2);
    
    // 比較HTMLを生成
    const html = createComparisonHTML(url1, url2, similarity);
    await writeFile(path.join(outputDir, 'comparison.html'), html);
    
    console.log(`\n✅ 完了！結果は以下に保存されました:`);
    console.log(`   ${outputDir}/`);
    console.log(`   - similarity-report.md : 詳細な類似度レポート`);
    console.log(`   - layout1.svg         : レイアウト1のSVG`);
    console.log(`   - layout2.svg         : レイアウト2のSVG`);
    console.log(`   - comparison.html     : 比較ビューアー`);
    
  } finally {
    await driver1.close();
    await driver2.close();
  }
}

function createComparisonHTML(url1: string, url2: string, similarity: any): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Layout Comparison</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      text-align: center;
    }
    .similarity-score {
      text-align: center;
      font-size: 2rem;
      color: #007bff;
      margin: 20px 0;
    }
    .scores {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin: 30px 0;
    }
    .score-item {
      text-align: center;
      padding: 15px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .score-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #28a745;
    }
    .score-label {
      color: #666;
      margin-top: 5px;
    }
    .layouts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 30px;
    }
    .layout {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
    }
    .layout h2 {
      margin-top: 0;
      color: #495057;
    }
    .layout-url {
      color: #6c757d;
      font-size: 0.9rem;
      margin-bottom: 15px;
    }
    .svg-container {
      border: 1px solid #dee2e6;
      border-radius: 4px;
      overflow: auto;
      max-height: 600px;
    }
    object {
      display: block;
      width: 100%;
      height: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>レイアウト比較</h1>
    
    <div class="similarity-score">
      全体的な類似度: ${(similarity.overallSimilarity * 100).toFixed(1)}%
    </div>
    
    <div class="scores">
      <div class="score-item">
        <div class="score-value">${(similarity.coordinateSimilarity * 100).toFixed(1)}%</div>
        <div class="score-label">座標</div>
      </div>
      <div class="score-item">
        <div class="score-value">${(similarity.accessibilitySimilarity * 100).toFixed(1)}%</div>
        <div class="score-label">アクセシビリティ</div>
      </div>
      <div class="score-item">
        <div class="score-value">${(similarity.textSimilarity * 100).toFixed(1)}%</div>
        <div class="score-label">テキスト</div>
      </div>
      <div class="score-item">
        <div class="score-value">${(similarity.textLengthSimilarity * 100).toFixed(1)}%</div>
        <div class="score-label">テキスト長</div>
      </div>
    </div>
    
    <div class="layouts">
      <div class="layout">
        <h2>レイアウト1</h2>
        <div class="layout-url">${url1}</div>
        <div class="svg-container">
          <object data="layout1.svg" type="image/svg+xml"></object>
        </div>
      </div>
      <div class="layout">
        <h2>レイアウト2</h2>
        <div class="layout-url">${url2}</div>
        <div class="svg-container">
          <object data="layout2.svg" type="image/svg+xml"></object>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url1 = process.argv[2];
  const url2 = process.argv[3];
  
  if (!url1 || !url2 || url1 === '--help') {
    console.log('使用方法:');
    console.log('  node v2-example.ts <url1> <url2>');
    console.log('');
    console.log('例:');
    console.log('  node v2-example.ts https://example.com https://example.org');
    process.exit(0);
  }
  
  compareLayouts(url1, url2).catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  });
}