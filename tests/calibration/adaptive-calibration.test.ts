import { describe, it, expect } from 'vitest';
import puppeteer from 'puppeteer';
import {
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  calibrateComparisonSettings,
  detectFlakiness,
  type ComparisonSettings,
  type LayoutAnalysisResult,
} from '../../src/index.js';

describe('Adaptive Calibration', () => {
  it('should calibrate comparison settings based on multiple samples', async () => {
    const url = 'https://example.com';
    const maxIterations = 10;
    const minSamples = 2;
    
    console.log(`\n🎯 Starting adaptive calibration for ${url}`);
    console.log('=' .repeat(60));
    
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
      // 生データとレイアウトツリーを分けて保持
      const rawDataSamples: any[] = [];
      const layoutSamples: LayoutAnalysisResult[] = [];
      
      console.log(`\n📊 Collecting initial ${minSamples} samples...`);
      
      for (let i = 0; i < minSamples; i++) {
        await page.goto(url, { waitUntil: 'networkidle0' });
        const rawData = await fetchRawLayoutData(page);
        rawDataSamples.push(rawData);
        
        // 初期設定で要約を生成
        const layout = await extractLayoutTree(rawData, {
          groupingThreshold: 20,
          importanceThreshold: 10
        });
        layoutSamples.push(layout);
        
        console.log(`  ✓ Sample ${i + 1}: ${rawData.elements.length} raw elements → ${layout.semanticGroups?.length || 0} groups`);
        
        // サンプル間で少し待機
        if (i < minSamples - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 初期フレーキーネス分析
      console.log('\n🔍 Analyzing initial flakiness...');
      const initialFlakiness = detectFlakiness(layoutSamples);
      console.log(`  - Overall flakiness: ${initialFlakiness.overallScore.toFixed(1)}%`);
      console.log(`  - Flaky elements: ${initialFlakiness.flakyElements.length}`);
      console.log(`  - Stable elements: ${initialFlakiness.stableCount}`);
      
      // 初期設定の生成
      let currentSettings = calibrateComparisonSettings(layoutSamples, {
        strictness: 'medium'
      });
      console.log('\n⚙️  Initial settings:');
      console.log(`  - Position tolerance: ${currentSettings.settings.positionTolerance}px`);
      console.log(`  - Size tolerance: ${currentSettings.settings.sizeTolerance}%`);
      console.log(`  - Text similarity: ${(currentSettings.settings.textSimilarityThreshold * 100).toFixed(0)}%`);
      
      // 反復的な改善
      console.log('\n🔄 Starting iterative refinement...');
      let iteration = 0;
      let lastFlakinessScore = initialFlakiness.overallScore;
      let convergenceCount = 0;
      const convergenceThreshold = 3; // 3回連続で改善がなければ収束とみなす
      
      while (iteration < maxIterations - minSamples) {
        iteration++;
        console.log(`\n--- Iteration ${iteration} ---`);
        
        // 新しいサンプルを追加
        await page.goto(url, { waitUntil: 'networkidle0' });
        const newRawData = await fetchRawLayoutData(page);
        rawDataSamples.push(newRawData);
        
        // 現在の設定で再度すべての生データから要約を生成
        layoutSamples.length = 0; // クリア
        for (const rawData of rawDataSamples) {
          const layout = await extractLayoutTree(rawData, {
            groupingThreshold: currentSettings.settings.importanceThreshold,
            importanceThreshold: currentSettings.settings.importanceThreshold
          });
          layoutSamples.push(layout);
        }
        
        console.log(`  📊 Added sample ${rawDataSamples.length}: ${newRawData.elements.length} raw elements`);
        console.log(`  🔄 Regenerated ${layoutSamples.length} layouts with current thresholds`);
        
        // 現在の設定で全サンプルペアを比較
        let totalDifferences = 0;
        let pairCount = 0;
        
        for (let i = 0; i < layoutSamples.length - 1; i++) {
          for (let j = i + 1; j < layoutSamples.length; j++) {
            const comparison = compareLayoutTrees(layoutSamples[i], layoutSamples[j], {
              threshold: currentSettings.settings.positionTolerance
            });
            totalDifferences += comparison.differences.length;
            pairCount++;
          }
        }
        
        const avgDifferences = totalDifferences / pairCount;
        console.log(`  📈 Average differences per pair: ${avgDifferences.toFixed(1)}`);
        
        // 新しいフレーキーネス分析
        const currentFlakiness = detectFlakiness(layoutSamples);
        console.log(`  🎯 Current flakiness: ${currentFlakiness.overallScore.toFixed(1)}%`);
        
        // 設定の再キャリブレーション
        const newSettings = calibrateComparisonSettings(layoutSamples, {
          strictness: determineStrictness(currentFlakiness.overallScore)
        });
        
        // 改善の確認
        const improvement = lastFlakinessScore - currentFlakiness.overallScore;
        console.log(`  📊 Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
        
        if (Math.abs(improvement) < 0.5) {
          convergenceCount++;
          console.log(`  ⚠️  Minimal improvement (${convergenceCount}/${convergenceThreshold})`);
        } else {
          convergenceCount = 0;
        }
        
        // 収束判定
        if (convergenceCount >= convergenceThreshold) {
          console.log('\n✅ Converged! Settings are stable.');
          break;
        }
        
        // フレーキーネスが十分低い場合も終了
        if (currentFlakiness.overallScore < 5) {
          console.log('\n✅ Achieved low flakiness score!');
          break;
        }
        
        // 設定の更新
        currentSettings = newSettings;
        lastFlakinessScore = currentFlakiness.overallScore;
        
        console.log(`  📝 Updated settings:`);
        console.log(`     - Position: ${currentSettings.settings.positionTolerance}px`);
        console.log(`     - Size: ${currentSettings.settings.sizeTolerance}%`);
        console.log(`     - Text: ${(currentSettings.settings.textSimilarityThreshold * 100).toFixed(0)}%`);
        
        // 次のイテレーションまで待機
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // 最終結果
      console.log('\n' + '='.repeat(60));
      console.log('📊 FINAL CALIBRATION RESULTS');
      console.log('='.repeat(60));
      console.log(`Total raw samples collected: ${rawDataSamples.length}`);
      console.log(`Total iterations: ${iteration}`);
      console.log(`Final flakiness score: ${lastFlakinessScore.toFixed(1)}%`);
      console.log('\n🎯 Recommended settings:');
      console.log(`  - Position tolerance: ${currentSettings.settings.positionTolerance}px`);
      console.log(`  - Size tolerance: ${currentSettings.settings.sizeTolerance}%`);
      console.log(`  - Text similarity threshold: ${(currentSettings.settings.textSimilarityThreshold * 100).toFixed(0)}%`);
      console.log(`  - Importance threshold: ${currentSettings.settings.importanceThreshold}`);
      console.log(`  - Grouping threshold: ${currentSettings.settings.importanceThreshold}`);
      console.log(`  - Confidence: ${currentSettings.confidence.toFixed(0)}%`);
      
      // アサーション
      expect(rawDataSamples.length).toBeGreaterThanOrEqual(minSamples);
      expect(rawDataSamples.length).toBeLessThanOrEqual(maxIterations);
      expect(currentSettings.settings.positionTolerance).toBeGreaterThan(0);
      expect(currentSettings.settings.sizeTolerance).toBeGreaterThan(0);
      expect(currentSettings.settings.textSimilarityThreshold).toBeGreaterThan(0);
      expect(currentSettings.settings.textSimilarityThreshold).toBeLessThanOrEqual(1);
      expect(currentSettings.confidence).toBeGreaterThan(50); // 最低50%の信頼度
      
      // フレーキーな要素の詳細
      if (lastFlakinessScore > 0) {
        const finalFlakiness = detectFlakiness(layoutSamples);
        console.log('\n⚠️  Remaining flaky elements:');
        finalFlakiness.flakyElements.slice(0, 5).forEach((element, i) => {
          console.log(`  ${i + 1}. ${element.elementId}`);
          console.log(`     - Flakiness: ${element.flakinessScore.toFixed(1)}%`);
          console.log(`     - Changes: ${element.changeFrequency} times`);
        });
      }
      
    } finally {
      await browser.close();
    }
  }, 60000); // 60秒のタイムアウト
});

// 厳密度を決定するヘルパー関数
function determineStrictness(flakinessScore: number): 'low' | 'medium' | 'high' {
  if (flakinessScore > 20) return 'low';    // フレーキーネスが高い場合は緩い設定
  if (flakinessScore > 10) return 'medium'; // 中程度
  return 'high';                             // フレーキーネスが低い場合は厳しい設定
}