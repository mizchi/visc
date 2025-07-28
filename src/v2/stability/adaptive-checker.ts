/**
 * V2 Adaptive Stability Checker - 適応的安定性チェック
 */

import { Driver } from '../../driver/types.js';
import { extractLayout } from '../extractor/index.js';
import { summarizeLayout } from '../summarizer/index.js';
import { analyzeLayoutStability } from './analyzer.js';
import { renderLayoutToSVG } from '../renderer/index.js';
import {
  AdaptiveStabilityConfig,
  StabilityProgress,
  StabilityAnalysisResult,
  FinalStabilityConfig
} from './types.js';
import { LayoutSummary } from '../types/index.js';

/**
 * 適応的安定性チェックを実行
 */
export async function checkAdaptiveStability(
  createDriver: () => Promise<Driver>,
  config: AdaptiveStabilityConfig
): Promise<{
  analysis: StabilityAnalysisResult;
  progressHistory: StabilityProgress[];
  finalConfig: FinalStabilityConfig;
}> {
  const {
    url,
    minIterations = 3,
    maxIterations = 10,
    viewport = { width: 1280, height: 720 },
    delay = 1000,
    targetStability = 95,
    earlyStopThreshold = 98
  } = config;

  console.log(`🔍 適応的安定性チェック開始: ${url}`);
  console.log(`   Viewport: ${viewport.width}x${viewport.height}`);
  console.log(`   最小反復: ${minIterations}, 最大反復: ${maxIterations}`);
  console.log(`   目標安定性: ${targetStability}%`);
  console.log(`   早期終了閾値: ${earlyStopThreshold}%`);
  console.log('');

  const layoutSummaries: LayoutSummary[] = [];
  const progressHistory: StabilityProgress[] = [];
  let currentIteration = 0;
  let shouldContinue = true;
  let finalAnalysis: StabilityAnalysisResult | null = null;

  while (shouldContinue && currentIteration < maxIterations) {
    currentIteration++;
    console.log(`\n📸 反復 ${currentIteration}...`);
    
    // ドライバーを作成してレイアウトを取得
    const driver = await createDriver();
    
    try {
      await driver.goto(url);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // レイアウトを抽出して要約
      const layout = await extractLayout(driver);
      const summary = summarizeLayout(layout);
      layoutSummaries.push(summary);
      
      console.log(`   ✅ ${summary.nodes.length}個のノードを検出`);
      
      // 3回目以降は安定性を分析
      if (currentIteration >= minIterations) {
        const analysis = analyzeLayoutStability(layoutSummaries);
        const progress = evaluateProgress(
          currentIteration,
          analysis,
          targetStability,
          earlyStopThreshold,
          minIterations,
          maxIterations
        );
        
        progressHistory.push(progress);
        displayProgress(progress);
        
        shouldContinue = progress.shouldContinue;
        finalAnalysis = analysis;
        
        if (!shouldContinue) {
          console.log(`\n✅ ${progress.reason}`);
        }
      } else {
        console.log(`   データ収集中... (最小${minIterations}回必要、現在${currentIteration}回)`);
      }
    } finally {
      await driver.close();
    }
  }

  if (currentIteration >= maxIterations) {
    console.log(`\n⚠️  最大反復回数に到達しました`);
  }

  if (!finalAnalysis) {
    throw new Error('安定性分析を完了できませんでした');
  }

  // 最終設定を生成
  const finalConfig = generateFinalConfig(
    finalAnalysis,
    viewport,
    url,
    progressHistory
  );

  // 最終レポートを表示
  displayFinalReport(finalAnalysis, progressHistory);

  return {
    analysis: finalAnalysis,
    progressHistory,
    finalConfig
  };
}

/**
 * 進捗を評価
 */
function evaluateProgress(
  iteration: number,
  analysis: StabilityAnalysisResult,
  targetStability: number,
  earlyStopThreshold: number,
  minIterations: number,
  maxIterations: number
): StabilityProgress {
  const stability = analysis.overallStabilityScore;
  const confidence = analysis.recommendations.confidenceLevel;
  
  let shouldContinue = true;
  let reason = '';
  
  // 早期終了条件を評価
  if (stability >= earlyStopThreshold && confidence >= 0.8) {
    shouldContinue = false;
    reason = `優れた安定性 (${stability.toFixed(1)}%) と高い信頼度 (${(confidence * 100).toFixed(0)}%) を達成`;
  } else if (stability >= targetStability && confidence >= 0.6 && iteration >= minIterations + 2) {
    shouldContinue = false;
    reason = `目標安定性 (${targetStability}%) を達成、十分な信頼度`;
  } else if (iteration >= maxIterations - 1) {
    shouldContinue = false;
    reason = '最大反復回数に到達';
  } else if (iteration >= minIterations + 5 && stability < 50) {
    // 安定性が非常に低い場合は継続しても改善しない可能性
    shouldContinue = false;
    reason = '安定性が非常に低いため、動的コンテンツの可能性';
  }
  
  return {
    iteration,
    currentStability: stability,
    unstableNodeCount: analysis.unstableNodes.length,
    totalNodeCount: analysis.totalNodes,
    confidence: confidence,
    shouldContinue,
    reason
  };
}

/**
 * 進捗を表示
 */
function displayProgress(progress: StabilityProgress): void {
  console.log(`\n📊 進捗レポート (反復 ${progress.iteration})`);
  console.log(`   現在の安定性: ${progress.currentStability.toFixed(2)}%`);
  console.log(`   不安定なノード: ${progress.unstableNodeCount}/${progress.totalNodeCount}`);
  console.log(`   信頼度: ${(progress.confidence * 100).toFixed(0)}%`);
  
  // プログレスバーを表示
  const barLength = 30;
  const filledLength = Math.round((progress.currentStability / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(`   進捗: [${bar}] ${progress.currentStability.toFixed(1)}%`);
  
  if (!progress.shouldContinue) {
    console.log(`   状態: 完了 - ${progress.reason}`);
  } else {
    console.log(`   状態: 継続中...`);
  }
}

/**
 * 最終レポートを表示
 */
function displayFinalReport(analysis: StabilityAnalysisResult, progressHistory: StabilityProgress[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📋 最終安定性レポート');
  console.log('='.repeat(60));
  
  console.log(`\n📈 安定性の推移:`);
  progressHistory.forEach(p => {
    const marker = p.currentStability >= 95 ? '🟢' : 
                   p.currentStability >= 85 ? '🟡' : '🔴';
    console.log(`   反復 ${p.iteration}: ${marker} ${p.currentStability.toFixed(2)}%`);
  });
  
  console.log(`\n🎯 最終結果:`);
  console.log(`   総ノード数: ${analysis.totalNodes}`);
  console.log(`   安定ノード: ${analysis.stableNodes}`);
  console.log(`   不安定ノード: ${analysis.unstableNodes.length}`);
  console.log(`   全体の安定性: ${analysis.overallStabilityScore.toFixed(2)}%`);
  
  console.log(`\n💡 推奨設定:`);
  console.log(`   ピクセル許容値: ${analysis.recommendations.pixelTolerance}px`);
  console.log(`   パーセント許容値: ${analysis.recommendations.percentageTolerance}%`);
  
  if (analysis.recommendations.ignoreSelectors.length > 0) {
    console.log(`   無視すべきセレクタ:`);
    analysis.recommendations.ignoreSelectors.forEach(sel => {
      console.log(`     - ${sel}`);
    });
  }
  
  if (analysis.recommendations.ignoreAttributes.length > 0) {
    console.log(`   無視すべき属性: ${analysis.recommendations.ignoreAttributes.join(', ')}`);
  }
  
  console.log(`\n📊 分析の品質:`);
  const confidence = analysis.recommendations.confidenceLevel;
  const qualityLevel = confidence >= 0.8 ? '高' : confidence >= 0.6 ? '中' : '低';
  const qualityEmoji = confidence >= 0.8 ? '🌟' : confidence >= 0.6 ? '⭐' : '💫';
  console.log(`   信頼度: ${(confidence * 100).toFixed(0)}% (${qualityEmoji} ${qualityLevel})`);
  console.log(`   反復回数: ${progressHistory.length + 2}`);
  
  // 推奨事項
  console.log(`\n📝 推奨事項:`);
  if (analysis.overallStabilityScore < 80) {
    console.log(`   ⚠️  ページに動的コンテンツが含まれている可能性があります`);
    console.log(`   💡 より長い待機時間を設定するか、動的要素を特定して無視リストに追加してください`);
  } else if (analysis.overallStabilityScore >= 95) {
    console.log(`   ✅ ページは非常に安定しています`);
    console.log(`   💡 厳密な視覚的回帰テストに適しています`);
  } else {
    console.log(`   ⚡ ページは概ね安定していますが、一部変動があります`);
    console.log(`   💡 生成された許容値を使用することを推奨します`);
  }
  
  console.log('\n' + '='.repeat(60));
}

/**
 * 最終設定を生成
 */
function generateFinalConfig(
  analysis: StabilityAnalysisResult,
  viewport: { width: number; height: number },
  url: string,
  progressHistory: StabilityProgress[]
): FinalStabilityConfig {
  const lastProgress = progressHistory[progressHistory.length - 1];
  
  return {
    stability: {
      enabled: true,
      toleranceThreshold: analysis.recommendations.pixelTolerance,
      percentageThreshold: analysis.recommendations.percentageTolerance,
      ignoreSelectors: analysis.recommendations.ignoreSelectors,
      ignoreAttributes: analysis.recommendations.ignoreAttributes,
      overallStability: analysis.overallStabilityScore,
      analysisDate: new Date().toISOString(),
      confidenceLevel: analysis.recommendations.confidenceLevel,
      adaptiveAnalysis: {
        totalIterations: lastProgress.iteration,
        convergenceReason: lastProgress.reason,
        stabilityProgression: progressHistory.map(p => ({
          iteration: p.iteration,
          stability: p.currentStability
        }))
      }
    },
    viewport,
    metadata: {
      url,
      iterations: lastProgress.iteration,
      totalNodes: analysis.totalNodes,
      unstableNodes: analysis.unstableNodes.length,
      analysisMethod: 'adaptive'
    }
  };
}

/**
 * HTMLレポートを生成
 */
export function generateStabilityReport(
  analysis: StabilityAnalysisResult,
  progressHistory: StabilityProgress[],
  config: FinalStabilityConfig
): string {
  const lastSummary = analysis.layoutSummaries[analysis.layoutSummaries.length - 1];
  const svg = renderLayoutToSVG(lastSummary, {
    colorScheme: 'semantic',
    showLabels: true,
    showImportance: true
  });
  
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stability Analysis Report - ${config.metadata.url}</title>
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
    }
    h1, h2 {
      color: #333;
    }
    .summary-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .stability-score {
      font-size: 3rem;
      font-weight: bold;
      color: ${analysis.overallStabilityScore >= 95 ? '#28a745' : 
              analysis.overallStabilityScore >= 85 ? '#ffc107' : '#dc3545'};
    }
    .progress-chart {
      width: 100%;
      height: 300px;
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .unstable-nodes {
      background: #fff3cd;
      border: 1px solid #ffeeba;
      border-radius: 4px;
      padding: 15px;
      margin: 15px 0;
    }
    .recommendations {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      padding: 15px;
      margin: 15px 0;
    }
    .layout-preview {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: auto;
    }
    .metric {
      display: inline-block;
      margin: 10px 20px 10px 0;
    }
    .metric-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #007bff;
    }
    .metric-label {
      color: #6c757d;
      font-size: 0.9rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      text-align: left;
      padding: 8px;
      border-bottom: 1px solid #dee2e6;
    }
    th {
      background-color: #f8f9fa;
      font-weight: 600;
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      background: #e9ecef;
      border-radius: 3px;
      font-size: 0.85rem;
      margin: 2px;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div class="container">
    <h1>安定性分析レポート</h1>
    
    <div class="summary-card">
      <h2>概要</h2>
      <div class="metric">
        <div class="metric-value stability-score">${analysis.overallStabilityScore.toFixed(1)}%</div>
        <div class="metric-label">全体の安定性</div>
      </div>
      <div class="metric">
        <div class="metric-value">${config.metadata.iterations}</div>
        <div class="metric-label">反復回数</div>
      </div>
      <div class="metric">
        <div class="metric-value">${analysis.stableNodes}/${analysis.totalNodes}</div>
        <div class="metric-label">安定ノード</div>
      </div>
      <div class="metric">
        <div class="metric-value">${(config.stability.confidenceLevel * 100).toFixed(0)}%</div>
        <div class="metric-label">信頼度</div>
      </div>
    </div>

    <div class="progress-chart">
      <h2>安定性の推移</h2>
      <canvas id="stabilityChart"></canvas>
    </div>

    ${analysis.unstableNodes.length > 0 ? `
    <div class="unstable-nodes">
      <h2>不安定な要素</h2>
      <table>
        <thead>
          <tr>
            <th>要素</th>
            <th>安定性スコア</th>
            <th>変動タイプ</th>
            <th>理由</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.recommendations.unstableAreas.slice(0, 10).map(area => `
          <tr>
            <td><code>${area.selector}</code></td>
            <td>${((analysis.unstableNodes.find(n => generateSelector(n) === area.selector)?.stabilityScore || 0) * 100).toFixed(1)}%</td>
            <td><span class="tag">${area.variationType}</span></td>
            <td>${area.reason}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="recommendations">
      <h2>推奨設定</h2>
      <p><strong>ピクセル許容値:</strong> ${config.stability.toleranceThreshold}px</p>
      <p><strong>パーセント許容値:</strong> ${config.stability.percentageThreshold}%</p>
      ${config.stability.ignoreSelectors.length > 0 ? `
      <p><strong>無視すべきセレクタ:</strong></p>
      <ul>
        ${config.stability.ignoreSelectors.map(sel => `<li><code>${sel}</code></li>`).join('')}
      </ul>
      ` : ''}
    </div>

    <div class="layout-preview">
      <h2>レイアウトプレビュー</h2>
      ${svg}
    </div>

    <div class="summary-card">
      <h2>メタデータ</h2>
      <p><strong>URL:</strong> ${config.metadata.url}</p>
      <p><strong>ビューポート:</strong> ${config.viewport.width}x${config.viewport.height}</p>
      <p><strong>分析日時:</strong> ${new Date(config.stability.analysisDate).toLocaleString('ja-JP')}</p>
      <p><strong>分析方法:</strong> ${config.metadata.analysisMethod}</p>
    </div>
  </div>

  <script>
    // 安定性推移チャート
    const ctx = document.getElementById('stabilityChart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(progressHistory.map(p => `反復 ${p.iteration}`))},
        datasets: [{
          label: '安定性 (%)',
          data: ${JSON.stringify(progressHistory.map(p => p.currentStability))},
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.1)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%';
              }
            }
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

/**
 * セレクタを生成（内部ヘルパー）
 */
function generateSelector(node: any): string {
  if (node.className) {
    const classes = node.className.split(' ').filter((c: string) => c.length > 0);
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  return node.tagName;
}