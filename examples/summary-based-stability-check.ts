#!/usr/bin/env node
import { createPuppeteerDriverWithPage } from './create-puppeteer-page.js';
import { getSemanticLayout } from '../dist/layout/semantic-layout.js';
import { summarizeSemanticLayout } from '../dist/layout/semantic-summary.js';
import { analyzeSummaryStability } from '../dist/assertion/summary-stability-analyzer.js';
import { writeJSON, ensureDir, writeFile } from '../dist/io/file.js';
import path from 'path';

interface StabilityCheckOptions {
  url: string;
  minIterations?: number;
  maxIterations?: number;
  viewport?: { width: number; height: number };
  outputDir?: string;
  delay?: number;
  targetStability?: number;
  earlyStopThreshold?: number;
}

/**
 * 要約ベースの適応的安定性チェック
 */
async function checkSummaryBasedStability(options: StabilityCheckOptions) {
  const {
    url,
    minIterations = 3,
    maxIterations = 10,
    viewport = { width: 1280, height: 720 },
    outputDir = './output/summary-stability',
    delay = 1000,
    targetStability = 95,
    earlyStopThreshold = 98
  } = options;

  console.log('🚀 要約ベースの安定性チェック開始');
  console.log(`   URL: ${url}`);
  console.log(`   ビューポート: ${viewport.width}x${viewport.height}`);
  console.log(`   最小反復: ${minIterations}回`);
  console.log(`   最大反復: ${maxIterations}回`);
  console.log(`   目標安定性: ${targetStability}%`);
  console.log('');

  // 出力ディレクトリを作成
  const urlSlug = url.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50);
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const sessionDir = path.join(outputDir, `${urlSlug}-${timestamp}`);
  await ensureDir(sessionDir);

  const driver = await createPuppeteerDriverWithPage({ headless: true });
  const iterations: Array<{ iteration: number; summary: any }> = [];
  const progressData: any[] = [];

  try {
    let currentIteration = 0;
    let previousStability = 0;
    let stabilityPlateau = 0;

    while (currentIteration < maxIterations) {
      currentIteration++;
      console.log(`\n📊 反復 ${currentIteration}/${maxIterations}`);
      
      // ページをロード
      await driver.goto(url);
      await driver.setViewport(viewport);
      await new Promise(resolve => setTimeout(resolve, delay));

      // セマンティックレイアウトを取得
      console.log('   セマンティックレイアウトを取得中...');
      const elements = await getSemanticLayout(driver);
      
      // 要約を生成
      console.log('   レイアウトを要約中...');
      const summary = summarizeSemanticLayout(elements, viewport);
      
      console.log(`   ✅ ${summary.nodes.length}個のノードを検出`);
      console.log(`   ✅ ${summary.groups.length}個のグループを生成`);
      
      // セマンティックタイプ別の統計
      const typeStats = new Map<string, number>();
      for (const node of summary.nodes) {
        typeStats.set(node.semanticType, (typeStats.get(node.semanticType) || 0) + 1);
      }
      console.log('   タイプ別統計:');
      for (const [type, count] of typeStats.entries()) {
        console.log(`     - ${type}: ${count}個`);
      }

      iterations.push({
        iteration: currentIteration,
        summary
      });

      // 要約データを保存
      await writeJSON(
        path.join(sessionDir, `summary-iteration-${currentIteration}.json`),
        summary
      );

      // 最小反復数に達したら安定性を分析
      if (currentIteration >= minIterations) {
        console.log('\n🔍 安定性を分析中...');
        const analysis = analyzeSummaryStability(iterations);
        
        const progress = {
          iteration: currentIteration,
          overallStability: analysis.overallStability,
          nodeStability: analysis.nodeStability,
          groupStability: analysis.groupStability,
          unstableNodes: analysis.unstableNodes.length,
          statistics: analysis.statistics
        };
        progressData.push(progress);

        console.log(`   全体的な安定性: ${analysis.overallStability.toFixed(2)}%`);
        console.log(`   ノード安定性: ${analysis.nodeStability.toFixed(2)}%`);
        console.log(`   グループ安定性: ${analysis.groupStability.toFixed(2)}%`);
        console.log(`   不安定なノード: ${analysis.unstableNodes.length}個`);
        
        // タイプ別の安定性を表示
        console.log('   タイプ別安定性:');
        for (const [type, stability] of Object.entries(analysis.statistics.stabilityByType)) {
          console.log(`     - ${type}: ${stability.toFixed(1)}%`);
        }

        // 早期停止条件をチェック
        if (analysis.overallStability >= earlyStopThreshold) {
          console.log(`\n✅ 安定性が${earlyStopThreshold}%に達しました！`);
          
          // 最終分析結果を保存
          await saveAnalysisResults(sessionDir, analysis, iterations, progressData, url);
          break;
        }

        // 安定性が改善していない場合
        if (Math.abs(analysis.overallStability - previousStability) < 0.5) {
          stabilityPlateau++;
          if (stabilityPlateau >= 3) {
            console.log('\n⚠️  安定性の改善が収束しました');
            await saveAnalysisResults(sessionDir, analysis, iterations, progressData, url);
            break;
          }
        } else {
          stabilityPlateau = 0;
        }

        previousStability = analysis.overallStability;

        // 目標に達した場合
        if (analysis.overallStability >= targetStability) {
          console.log(`\n✅ 目標安定性${targetStability}%を達成しました！`);
          await saveAnalysisResults(sessionDir, analysis, iterations, progressData, url);
          break;
        }
      }
    }

    // 最大反復数に達した場合
    if (currentIteration >= maxIterations) {
      console.log('\n⚠️  最大反復数に達しました');
      const analysis = analyzeSummaryStability(iterations);
      await saveAnalysisResults(sessionDir, analysis, iterations, progressData, url);
    }

  } finally {
    await driver.close();
  }

  console.log(`\n📁 結果は以下に保存されました: ${sessionDir}`);
}

/**
 * 分析結果を保存
 */
async function saveAnalysisResults(
  sessionDir: string,
  analysis: any,
  iterations: any[],
  progressData: any[],
  url: string
) {
  // 推奨設定を生成
  const recommendedConfig = {
    stability: {
      enabled: true,
      toleranceThreshold: analysis.recommendations.toleranceThreshold,
      ignoreClasses: analysis.recommendations.ignoreClasses,
      ignoreTypes: analysis.recommendations.ignoreTypes,
      overallStability: analysis.overallStability,
      nodeStability: analysis.nodeStability,
      groupStability: analysis.groupStability,
      analysisDate: new Date().toISOString(),
      confidenceLevel: analysis.recommendations.confidenceLevel,
      summaryBased: true
    },
    viewport: {
      width: 1280,
      height: 720
    },
    metadata: {
      url,
      iterations: iterations.length,
      totalNodes: analysis.statistics.totalNodes,
      unstableNodes: analysis.statistics.unstableNodes,
      analysisMethod: 'summary-based'
    }
  };

  await writeJSON(path.join(sessionDir, 'recommended-config.json'), recommendedConfig);
  await writeJSON(path.join(sessionDir, 'full-analysis.json'), analysis);
  await writeJSON(path.join(sessionDir, 'progress.json'), progressData);

  // 不安定なノードのレポートを生成
  if (analysis.unstableNodes.length > 0) {
    const report = generateUnstableNodesReport(analysis);
    await writeFile(path.join(sessionDir, 'unstable-nodes-report.md'), report);
  }

  // HTMLレポートを生成
  const htmlReport = generateHTMLReport(analysis, progressData, url);
  await writeFile(path.join(sessionDir, 'report.html'), htmlReport);
}

/**
 * 不安定なノードのレポートを生成
 */
function generateUnstableNodesReport(analysis: any): string {
  let report = '# 不安定なノードレポート\n\n';
  report += `生成日時: ${new Date().toISOString()}\n\n`;
  report += `## サマリー\n\n`;
  report += `- 全体的な安定性: ${analysis.overallStability.toFixed(2)}%\n`;
  report += `- ノード安定性: ${analysis.nodeStability.toFixed(2)}%\n`;
  report += `- グループ安定性: ${analysis.groupStability.toFixed(2)}%\n`;
  report += `- 総ノード数: ${analysis.statistics.totalNodes}\n`;
  report += `- 不安定なノード数: ${analysis.statistics.unstableNodes}\n\n`;

  report += '## タイプ別安定性\n\n';
  for (const [type, stability] of Object.entries(analysis.statistics.stabilityByType)) {
    report += `- ${type}: ${stability}%\n`;
  }

  report += '\n## 不安定なノード詳細\n\n';
  
  for (const node of analysis.unstableNodes) {
    report += `### ${node.type}${node.className ? ` (.${node.className})` : ''}\n\n`;
    report += `- セマンティックタイプ: ${node.semanticType}\n`;
    report += `- 変動スコア: ${node.variationScore.toFixed(2)}\n`;
    report += `- 位置の変動: ${node.variations.join(' → ')}\n\n`;
  }

  report += '\n## 推奨事項\n\n';
  report += `- 許容閾値: ${analysis.recommendations.toleranceThreshold}px\n`;
  if (analysis.recommendations.ignoreClasses.length > 0) {
    report += `- 無視するクラス: ${analysis.recommendations.ignoreClasses.join(', ')}\n`;
  }
  if (analysis.recommendations.ignoreTypes.length > 0) {
    report += `- 無視するタイプ: ${analysis.recommendations.ignoreTypes.join(', ')}\n`;
  }

  return report;
}

/**
 * HTMLレポートを生成
 */
function generateHTMLReport(analysis: any, progressData: any[], url: string): string {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>要約ベース安定性分析レポート</title>
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
    h1 { color: #333; }
    h2 { color: #555; margin-top: 30px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .stat-card h3 { margin: 0; font-size: 2rem; }
    .stat-card p { margin: 5px 0 0 0; opacity: 0.9; }
    .chart-container {
      margin: 30px 0;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background-color: #e0e0e0;
      border-radius: 15px;
      overflow: hidden;
      margin: 10px 0;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50 0%, #8BC34A 100%);
      transition: width 0.3s ease;
    }
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
    th { background-color: #f8f9fa; font-weight: 600; }
    .unstable { color: #d32f2f; }
    .stable { color: #388e3c; }
    .tag { 
      display: inline-block; 
      padding: 4px 8px; 
      border-radius: 4px; 
      font-size: 0.85rem;
      margin: 2px;
    }
    .tag-heading { background-color: #FF6B6B; color: white; }
    .tag-navigation { background-color: #4ECDC4; color: white; }
    .tag-interactive { background-color: #45B7D1; color: white; }
    .tag-content { background-color: #96CEB4; color: white; }
    .tag-media { background-color: #DDA0DD; color: white; }
    .tag-structural { background-color: #FFD93D; color: #333; }
  </style>
</head>
<body>
  <div class="container">
    <h1>要約ベース安定性分析レポート</h1>
    <p>URL: <a href="${url}">${url}</a></p>
    <p>分析日時: ${new Date().toLocaleDateString('ja-JP')} ${new Date().toLocaleTimeString('ja-JP')}</p>
    
    <div class="stats">
      <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <h3>${analysis.overallStability.toFixed(1)}%</h3>
        <p>全体的な安定性</p>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
        <h3>${analysis.nodeStability.toFixed(1)}%</h3>
        <p>ノード安定性</p>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
        <h3>${analysis.groupStability.toFixed(1)}%</h3>
        <p>グループ安定性</p>
      </div>
      <div class="stat-card" style="background: linear-gradient(135deg, #30cfd0 0%, #330867 100%);">
        <h3>${analysis.statistics.totalNodes}</h3>
        <p>総ノード数</p>
      </div>
    </div>

    <h2>タイプ別安定性</h2>
    <div class="chart-container">
      ${Object.entries(analysis.statistics.stabilityByType).map(([type, stability]) => `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="tag tag-${type}">${type}</span>
            <span>${stability}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${stability}%"></div>
          </div>
        </div>
      `).join('')}
    </div>

    <h2>不安定なノード (${analysis.unstableNodes.length}個)</h2>
    ${analysis.unstableNodes.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>タイプ</th>
            <th>クラス名</th>
            <th>セマンティックタイプ</th>
            <th>変動スコア</th>
            <th>位置の変動</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.unstableNodes.slice(0, 10).map(node => `
            <tr>
              <td><code>${node.type}</code></td>
              <td>${node.className || '-'}</td>
              <td><span class="tag tag-${node.semanticType}">${node.semanticType}</span></td>
              <td class="unstable">${node.variationScore.toFixed(1)}</td>
              <td><small>${node.variations.slice(0, 3).join(' → ')}${node.variations.length > 3 ? '...' : ''}</small></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${analysis.unstableNodes.length > 10 ? `<p>他${analysis.unstableNodes.length - 10}個の不安定なノード...</p>` : ''}
    ` : '<p class="stable">すべてのノードが安定しています！</p>'}

    <h2>推奨設定</h2>
    <div class="chart-container">
      <p><strong>許容閾値:</strong> ${analysis.recommendations.toleranceThreshold}px</p>
      ${analysis.recommendations.ignoreClasses.length > 0 ? 
        `<p><strong>無視するクラス:</strong> ${analysis.recommendations.ignoreClasses.map(c => `<code>${c}</code>`).join(', ')}</p>` : ''}
      ${analysis.recommendations.ignoreTypes.length > 0 ? 
        `<p><strong>無視するタイプ:</strong> ${analysis.recommendations.ignoreTypes.map(t => `<code>${t}</code>`).join(', ')}</p>` : ''}
      <p><strong>信頼度レベル:</strong> ${(analysis.recommendations.confidenceLevel * 100).toFixed(0)}%</p>
    </div>

    <h2>安定性の推移</h2>
    <div class="chart-container">
      <table>
        <thead>
          <tr>
            <th>反復</th>
            <th>全体安定性</th>
            <th>ノード安定性</th>
            <th>グループ安定性</th>
            <th>不安定ノード数</th>
          </tr>
        </thead>
        <tbody>
          ${progressData.map(p => `
            <tr>
              <td>${p.iteration}</td>
              <td>${p.overallStability.toFixed(1)}%</td>
              <td>${p.nodeStability.toFixed(1)}%</td>
              <td>${p.groupStability.toFixed(1)}%</td>
              <td>${p.unstableNodes}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  
  if (!url || url === '--help') {
    console.log('使用方法:');
    console.log('  node summary-based-stability-check.ts <url> [options]');
    console.log('');
    console.log('オプション:');
    console.log('  --min=<number>     最小反復回数（デフォルト: 3）');
    console.log('  --max=<number>     最大反復回数（デフォルト: 10）');
    console.log('  --target=<number>  目標安定性（デフォルト: 95）');
    console.log('  --output=<path>    出力ディレクトリ');
    console.log('');
    console.log('例:');
    console.log('  node summary-based-stability-check.ts https://example.com');
    console.log('  node summary-based-stability-check.ts https://example.com --max=5 --target=90');
    process.exit(0);
  }

  const getOption = (name: string, defaultValue: number) => {
    const arg = process.argv.find(a => a.startsWith(`--${name}=`));
    return arg ? parseInt(arg.split('=')[1]) : defaultValue;
  };

  const getStringOption = (name: string, defaultValue?: string) => {
    const arg = process.argv.find(a => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : defaultValue;
  };

  checkSummaryBasedStability({
    url,
    minIterations: getOption('min', 3),
    maxIterations: getOption('max', 10),
    targetStability: getOption('target', 95),
    outputDir: getStringOption('output', './output/summary-stability')
  });
}