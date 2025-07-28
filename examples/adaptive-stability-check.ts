#!/usr/bin/env node
import { test } from 'node:test';
import { createPuppeteerDriver } from '../dist/driver/puppeteer-driver.js';
import { getSemanticLayout } from '../dist/layout/semantic-layout.js';
import { launchPuppeteer, createPuppeteerPage, closePuppeteer } from '../dist/io/puppeteer.js';
import { writeJSON, ensureDir } from '../dist/io/file.js';
import { analyzeStability } from '../dist/assertion/stability-analyzer.js';
import path from 'path';

interface AdaptiveStabilityOptions {
  url: string;
  minIterations?: number;
  maxIterations?: number;
  viewport?: { width: number; height: number };
  outputDir?: string;
  delay?: number;
  targetStability?: number; // 目標安定性スコア (0-100)
  earlyStopThreshold?: number; // 早期終了の閾値
}

interface StabilityProgress {
  iteration: number;
  currentStability: number;
  unstableNodeCount: number;
  totalNodeCount: number;
  confidence: number;
  shouldContinue: boolean;
  reason?: string;
}

async function checkStabilityAdaptive(options: AdaptiveStabilityOptions) {
  const {
    url,
    minIterations = 3,
    maxIterations = 10,
    viewport = { width: 1280, height: 720 },
    outputDir = './output/adaptive-stability',
    delay = 1000,
    targetStability = 95,
    earlyStopThreshold = 98
  } = options;

  await ensureDir(outputDir);
  await ensureDir(path.join(outputDir, 'snapshots'));
  await ensureDir(path.join(outputDir, 'layouts'));
  await ensureDir(path.join(outputDir, 'progress'));

  console.log(`🔍 適応的安定性チェック開始: ${url}`);
  console.log(`   Viewport: ${viewport.width}x${viewport.height}`);
  console.log(`   最小反復: ${minIterations}, 最大反復: ${maxIterations}`);
  console.log(`   目標安定性: ${targetStability}%`);
  console.log(`   早期終了閾値: ${earlyStopThreshold}%`);
  console.log('');

  const browser = await launchPuppeteer({ headless: true });
  const layouts: Array<{ iteration: number; elements: any[] }> = [];
  const progressHistory: StabilityProgress[] = [];

  try {
    let currentIteration = 0;
    let shouldContinue = true;
    let finalAnalysis = null;

    while (shouldContinue && currentIteration < maxIterations) {
      currentIteration++;
      console.log(`\n📸 反復 ${currentIteration}...`);
      
      // ページをロードしてレイアウトを取得
      const page = await createPuppeteerPage(browser, viewport);
      const driver = createPuppeteerDriver({ page, viewport });

      await driver.goto(url);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const elements = await getSemanticLayout(driver);
      
      // スクリーンショットとレイアウトを保存
      await driver.screenshot({ 
        path: path.join(outputDir, 'snapshots', `iteration-${currentIteration}.png`) 
      });
      
      await writeJSON(
        path.join(outputDir, 'layouts', `layout-${currentIteration}.json`),
        elements
      );
      
      layouts.push({ iteration: currentIteration, elements });
      await driver.close();

      // 3回目以降は安定性を分析
      if (currentIteration >= minIterations) {
        const analysis = analyzeStability(layouts);
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
        
        // 進捗を保存
        await writeJSON(
          path.join(outputDir, 'progress', `progress-${currentIteration}.json`),
          progress
        );
        
        shouldContinue = progress.shouldContinue;
        finalAnalysis = analysis;
        
        if (!shouldContinue) {
          console.log(`\n✅ ${progress.reason}`);
        }
      } else {
        console.log(`   データ収集中... (最小${minIterations}回必要、現在${currentIteration}回)`);
      }
    }

    if (currentIteration >= maxIterations) {
      console.log(`\n⚠️  最大反復回数に到達しました`);
    }

    // 最終分析結果を保存
    if (finalAnalysis) {
      await writeJSON(path.join(outputDir, 'stability-analysis.json'), finalAnalysis);
      
      // 推奨設定を生成
      const config = generateAdaptiveConfig(finalAnalysis, viewport, url, progressHistory);
      await writeJSON(path.join(outputDir, 'recommended-config.json'), config);
      
      // 最終レポートを表示
      displayFinalReport(finalAnalysis, progressHistory);
    }

    return finalAnalysis;
  } finally {
    await closePuppeteer(browser);
  }
}

function evaluateProgress(
  iteration: number,
  analysis: any,
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
  
  // 改善率を計算（前回との比較）
  const improvementRate = calculateImprovementRate(analysis, iteration);
  if (iteration >= minIterations + 3 && improvementRate < 0.1 && stability >= 85) {
    shouldContinue = false;
    reason = '安定性の改善が収束';
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

function calculateImprovementRate(analysis: any, iteration: number): number {
  // 簡易的な改善率計算（実際の実装では履歴を使用）
  return iteration > 5 ? 0.05 : 0.2;
}

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

function displayFinalReport(analysis: any, progressHistory: StabilityProgress[]): void {
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
    analysis.recommendations.ignoreSelectors.forEach((sel: string) => {
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

function generateAdaptiveConfig(
  analysis: any,
  viewport: { width: number; height: number },
  url: string,
  progressHistory: StabilityProgress[]
): any {
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

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  const outputDir = process.argv[3] || './output/adaptive-stability';

  if (!url) {
    console.log('使用方法: node adaptive-stability-check.ts <URL> [outputDir]');
    console.log('例: node adaptive-stability-check.ts https://example.com ./output/stability');
    console.log('\nオプション:');
    console.log('  最小3回、最大10回の反復で適応的に安定性を分析します');
    console.log('  安定性が高く信頼度が十分な場合、早期に終了します');
    process.exit(1);
  }

  test('適応的安定性チェック', async () => {
    await checkStabilityAdaptive({
      url,
      outputDir,
      minIterations: 3,
      maxIterations: 10,
      targetStability: 95,
      earlyStopThreshold: 98,
      delay: 2000
    });
  });
}