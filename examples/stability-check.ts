#!/usr/bin/env node
import { test } from 'node:test';
import { createVisualAssert } from '../dist/assertion/visual.js';
import { createPuppeteerDriver } from '../dist/driver/puppeteer-driver.js';
import { getSemanticLayout } from '../dist/layout/semantic-layout.js';
import { launchPuppeteer, createPuppeteerPage, closePuppeteer } from '../dist/io/puppeteer.js';
import { writeJSON, ensureDir } from '../dist/io/file.js';
import { analyzeStability } from '../dist/assertion/stability-analyzer.js';
import path from 'path';

interface StabilityCheckOptions {
  url: string;
  iterations?: number;
  viewport?: { width: number; height: number };
  outputDir?: string;
  delay?: number; // 各ロード間の待機時間（ミリ秒）
}


async function checkStability(options: StabilityCheckOptions) {
  const {
    url,
    iterations = 5,
    viewport = { width: 1280, height: 720 },
    outputDir = './output/stability',
    delay = 1000
  } = options;

  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'snapshots'));
  await ensureDir(path.join(outputDir, 'layouts'));

  console.log(`🔍 安定性チェック開始: ${url}`);
  console.log(`   Viewport: ${viewport.width}x${viewport.height}`);
  console.log(`   反復回数: ${iterations}`);

  const browser = await launchPuppeteer({ headless: true });
  const layouts: Array<{ iteration: number; elements: any[] }> = [];

  try {
    // 複数回ページをロードしてレイアウトを収集
    for (let i = 0; i < iterations; i++) {
      console.log(`\n📸 反復 ${i + 1}/${iterations}...`);
      
      const page = await createPuppeteerPage(browser, viewport);
      const driver = createPuppeteerDriver({ page, viewport });

      await driver.goto(url);
      
      // ページが完全に安定するまで待機
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // セマンティックレイアウトを取得
      const elements = await getSemanticLayout(driver);
      
      // スクリーンショットを保存
      await driver.screenshot({ 
        path: path.join(outputDir, 'snapshots', `iteration-${i + 1}.png`) 
      });
      
      // レイアウトを保存
      await writeJSON(
        path.join(outputDir, 'layouts', `layout-${i + 1}.json`),
        elements
      );
      
      layouts.push({ iteration: i + 1, elements });
      
      await driver.close();
    }

    // 新しいanalyzerを使用して分析
    const analysis = analyzeStability(layouts);
    
    // 分析結果を保存
    await writeJSON(path.join(outputDir, 'stability-analysis.json'), analysis);

    // 推奨設定を生成
    const config = {
      stability: {
        enabled: true,
        toleranceThreshold: analysis.recommendations.pixelTolerance,
        percentageThreshold: analysis.recommendations.percentageTolerance,
        ignoreSelectors: analysis.recommendations.ignoreSelectors,
        ignoreAttributes: analysis.recommendations.ignoreAttributes,
        overallStability: analysis.overallStabilityScore,
        analysisDate: new Date().toISOString(),
        confidenceLevel: analysis.recommendations.confidenceLevel
      },
      viewport,
      metadata: {
        url,
        iterations: analysis.totalIterations,
        totalNodes: analysis.totalNodes,
        unstableNodes: analysis.unstableNodes.length
      }
    };
    
    await writeJSON(path.join(outputDir, 'recommended-config.json'), config);

    console.log('\n📊 安定性分析結果:');
    console.log(`   総ノード数: ${analysis.totalNodes}`);
    console.log(`   安定したノード: ${analysis.stableNodes}`);
    console.log(`   不安定なノード: ${analysis.unstableNodes.length}`);
    console.log(`   全体の安定性スコア: ${analysis.overallStabilityScore.toFixed(2)}%`);
    console.log('\n💡 推奨設定:');
    console.log(`   ピクセル許容値: ${analysis.recommendations.pixelTolerance}px`);
    console.log(`   パーセント許容値: ${analysis.recommendations.percentageTolerance}%`);
    console.log(`   無視すべきセレクタ: ${analysis.recommendations.ignoreSelectors.join(', ') || 'なし'}`);
    console.log(`   無視すべき属性: ${analysis.recommendations.ignoreAttributes.join(', ') || 'なし'}`);
    console.log(`   信頼度レベル: ${(analysis.recommendations.confidenceLevel * 100).toFixed(0)}%`);

    // 不安定なノードの詳細を表示
    if (analysis.unstableNodes.length > 0 && analysis.unstableNodes.length <= 10) {
      console.log('\n🔍 不安定なノードの詳細:');
      analysis.unstableNodes.slice(0, 5).forEach(node => {
        console.log(`   - ${node.selector} (変動スコア: ${node.variationScore.toFixed(2)})`);
        node.variations.forEach(variation => {
          console.log(`     ${variation.attribute}: ${variation.values.length}種類の値`);
        });
      });
      if (analysis.unstableNodes.length > 5) {
        console.log(`   ... 他 ${analysis.unstableNodes.length - 5} ノード`);
      }
    }

    return analysis;
  } finally {
    await closePuppeteer(browser);
  }
}


// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  const iterations = parseInt(process.argv[3] || '5', 10);
  const outputDir = process.argv[4] || './output/stability';

  if (!url) {
    console.error('使用方法: node stability-check.ts <URL> [iterations] [outputDir]');
    console.error('例: node stability-check.ts https://example.com 10 ./output/stability');
    process.exit(1);
  }

  test('安定性チェック', async () => {
    const report = await checkStability({
      url,
      iterations,
      outputDir,
      viewport: { width: 1280, height: 720 },
      delay: 2000
    });

    // 安定性が低すぎる場合は警告
    if (report.overallStabilityScore < 80) {
      console.warn(`\n⚠️  警告: 全体の安定性が低いです (${report.overallStabilityScore.toFixed(2)}%)`);
      console.warn('   ページの動的コンテンツやアニメーションが原因の可能性があります。');
    }
  });
}