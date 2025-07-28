#!/usr/bin/env node
import { createPuppeteerDriverWithPage } from './create-puppeteer-page.js';
import { extractLayout, summarizeLayout, renderLayoutToSVG, renderInteractiveSVG } from '../dist/core/index.js';
import { writeFile, ensureDir } from '../dist/io/file.js';
import path from 'path';

/**
 * レイアウトをSVGとして可視化
 */
async function visualizeLayout(url: string, outputDir: string = './output/layout-svg') {
  console.log('🎨 レイアウトSVG可視化開始');
  console.log(`   URL: ${url}`);
  
  await ensureDir(outputDir);
  
  const driver = await createPuppeteerDriverWithPage({ headless: true });
  
  try {
    // ページを読み込み
    await driver.goto(url);
    await driver.setViewport({ width: 1280, height: 720 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📊 レイアウトを抽出中...');
    const layout = await extractLayout(driver);
    
    console.log('📋 レイアウトを要約中...');
    const summary = summarizeLayout(layout);
    
    console.log(`   ✅ ${summary.nodes.length}個のノードを検出`);
    console.log(`   ✅ ${summary.groups.length}個のグループを生成`);
    
    // 基本的なSVG（セマンティックカラー）
    console.log('\n🎨 セマンティックカラーでSVGを生成中...');
    const semanticSvg = renderLayoutToSVG(summary, {
      colorScheme: 'semantic',
      showLabels: true,
      showImportance: true,
      showGroups: true
    });
    await writeFile(
      path.join(outputDir, 'layout-semantic.svg'),
      semanticSvg
    );
    
    // 重要度ベースのSVG
    console.log('🎨 重要度カラーでSVGを生成中...');
    const importanceSvg = renderLayoutToSVG(summary, {
      colorScheme: 'importance',
      showLabels: true,
      showImportance: true,
      showGroups: false
    });
    await writeFile(
      path.join(outputDir, 'layout-importance.svg'),
      importanceSvg
    );
    
    // シンプルなモノクロSVG
    console.log('🎨 モノクロでSVGを生成中...');
    const monoSvg = renderLayoutToSVG(summary, {
      colorScheme: 'monochrome',
      showLabels: false,
      showImportance: false,
      showGroups: true,
      strokeWidth: 2
    });
    await writeFile(
      path.join(outputDir, 'layout-monochrome.svg'),
      monoSvg
    );
    
    // インタラクティブSVG
    console.log('🎨 インタラクティブSVGを生成中...');
    const interactiveSvg = renderInteractiveSVG(summary, {
      colorScheme: 'semantic',
      showLabels: true,
      showImportance: true,
      showGroups: true
    });
    await writeFile(
      path.join(outputDir, 'layout-interactive.svg'),
      interactiveSvg
    );
    
    // HTMLラッパーを作成（SVGを表示）
    console.log('📄 HTMLビューアーを生成中...');
    const html = createHTMLViewer(url, summary);
    await writeFile(
      path.join(outputDir, 'viewer.html'),
      html
    );
    
    // 統計情報をJSONで保存
    await writeFile(
      path.join(outputDir, 'layout-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log(`\n✅ 完了！結果は以下に保存されました:`);
    console.log(`   ${outputDir}/`);
    console.log(`   - layout-semantic.svg    : セマンティックカラー版`);
    console.log(`   - layout-importance.svg  : 重要度カラー版`);
    console.log(`   - layout-monochrome.svg  : モノクロ版`);
    console.log(`   - layout-interactive.svg : インタラクティブ版`);
    console.log(`   - viewer.html           : HTMLビューアー`);
    console.log(`   - layout-summary.json   : レイアウトサマリーデータ`);
    
  } finally {
    await driver.close();
  }
}

/**
 * HTMLビューアーを作成
 */
function createHTMLViewer(url: string, summary: any): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Layout Visualization - ${url}</title>
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
      margin-bottom: 10px;
    }
    .info {
      color: #666;
      margin-bottom: 30px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 30px;
    }
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .card-header {
      padding: 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    .card-title {
      margin: 0;
      font-size: 1.2rem;
      color: #495057;
    }
    .card-body {
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
      background: #fafafa;
    }
    .svg-container {
      max-width: 100%;
      max-height: 600px;
      overflow: auto;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
    }
    object {
      display: block;
      width: 100%;
      height: auto;
    }
    .stats {
      margin-top: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stats h2 {
      margin-top: 0;
      color: #495057;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .stat-item {
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      color: #007bff;
    }
    .stat-label {
      color: #6c757d;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>レイアウト可視化</h1>
    <div class="info">
      <p>URL: <a href="${url}" target="_blank">${url}</a></p>
      <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
    </div>
    
    <div class="grid">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">セマンティックカラー</h3>
        </div>
        <div class="card-body">
          <div class="svg-container">
            <object data="layout-semantic.svg" type="image/svg+xml"></object>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">重要度カラー</h3>
        </div>
        <div class="card-body">
          <div class="svg-container">
            <object data="layout-importance.svg" type="image/svg+xml"></object>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">モノクロ</h3>
        </div>
        <div class="card-body">
          <div class="svg-container">
            <object data="layout-monochrome.svg" type="image/svg+xml"></object>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">インタラクティブ</h3>
        </div>
        <div class="card-body">
          <div class="svg-container">
            <object data="layout-interactive.svg" type="image/svg+xml"></object>
          </div>
        </div>
      </div>
    </div>
    
    <div class="stats">
      <h2>統計情報</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${summary.statistics.totalNodes}</div>
          <div class="stat-label">総ノード数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${summary.groups.length}</div>
          <div class="stat-label">グループ数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${summary.statistics.averageImportance.toFixed(1)}</div>
          <div class="stat-label">平均重要度</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${Object.keys(summary.statistics.bySemanticType).length}</div>
          <div class="stat-label">セマンティックタイプ数</div>
        </div>
      </div>
      
      <h3 style="margin-top: 30px;">セマンティックタイプ分布</h3>
      <div class="stats-grid">
        ${Object.entries(summary.statistics.bySemanticType).map(([type, count]) => `
          <div class="stat-item">
            <div class="stat-value">${count}</div>
            <div class="stat-label">${type}</div>
          </div>
        `).join('')}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  
  if (!url || url === '--help') {
    console.log('使用方法:');
    console.log('  node layout-svg-visualization.ts <url> [output-dir]');
    console.log('');
    console.log('例:');
    console.log('  node layout-svg-visualization.ts https://example.com');
    console.log('  node layout-svg-visualization.ts https://example.com ./output/my-layout');
    process.exit(0);
  }
  
  const outputDir = process.argv[3] || './output/layout-svg';
  
  visualizeLayout(url, outputDir).catch(error => {
    console.error('エラー:', error);
    process.exit(1);
  });
}