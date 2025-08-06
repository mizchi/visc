#!/usr/bin/env node
/**
 * Calibration実行例
 * 
 * 使用方法:
 * npx tsx tests/calibration/calibration-example.ts <url>
 */

import puppeteer from 'puppeteer';
import {
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  calibrateComparisonSettings,
  detectFlakiness,
  type ComparisonSettings,
  type VisualTreeAnalysis,
} from '../../src/index.js';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const url = process.argv[2] || 'https://example.com';
  const outputDir = path.join(process.cwd(), 'output', 'calibration');
  
  console.log(`\n🎯 Adaptive Calibration Tool`);
  console.log('=' .repeat(60));
  console.log(`URL: ${url}`);
  console.log(`Output: ${outputDir}`);
  console.log('=' .repeat(60));
  
  await fs.mkdir(outputDir, { recursive: true });
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // フェーズ1: 初期サンプル収集
    console.log('\n📊 Phase 1: Initial Sample Collection');
    console.log('-'.repeat(40));
    
    const rawDataSamples: any[] = [];
    const initialSamples = 3;
    
    for (let i = 0; i < initialSamples; i++) {
      console.log(`\nCollecting sample ${i + 1}/${initialSamples}...`);
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      const rawData = await fetchRawLayoutData(page, {
        waitForContent: true,
        captureFullPage: false
      });
      
      rawDataSamples.push(rawData);
      console.log(`  ✓ Captured ${rawData.elements.length} raw elements`);
      
      // サンプルを保存
      await fs.writeFile(
        path.join(outputDir, `raw-sample-${i + 1}.json`),
        JSON.stringify(rawData, null, 2)
      );
      
      if (i < initialSamples - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // フェーズ2: 最適な閾値の探索
    console.log('\n🔍 Phase 2: Threshold Optimization');
    console.log('-'.repeat(40));
    
    const thresholdCandidates = {
      grouping: [10, 15, 20, 25, 30],
      importance: [3, 5, 10, 15, 20]
    };
    
    let bestSettings: ComparisonSettings | null = null;
    let bestScore = Infinity;
    let bestLayouts: VisualTreeAnalysis[] = [];
    
    for (const groupingThreshold of thresholdCandidates.grouping) {
      for (const importanceThreshold of thresholdCandidates.importance) {
        console.log(`\nTesting thresholds: grouping=${groupingThreshold}, importance=${importanceThreshold}`);
        
        // 現在の閾値で全サンプルを要約
        const layouts: VisualTreeAnalysis[] = [];
        for (const rawData of rawDataSamples) {
          const layout = await extractLayoutTree(rawData, {
            groupingThreshold,
            importanceThreshold,
            viewportOnly: true
          });
          layouts.push(layout);
        }
        
        // フレーキーネス分析
        const flakiness = detectFlakiness(layouts);
        const avgGroups = layouts.reduce((sum, l) => sum + (l.visualNodeGroups?.length || 0), 0) / layouts.length;
        
        // スコア計算（フレーキーネスが低く、適度なグループ数）
        const targetGroups = 20; // 理想的なグループ数
        const groupPenalty = Math.abs(avgGroups - targetGroups) / targetGroups;
        const score = flakiness.overallScore + groupPenalty * 20;
        
        console.log(`  - Avg groups: ${avgGroups.toFixed(1)}`);
        console.log(`  - Flakiness: ${flakiness.overallScore.toFixed(1)}%`);
        console.log(`  - Combined score: ${score.toFixed(1)}`);
        
        if (score < bestScore) {
          bestScore = score;
          bestLayouts = layouts;
          const calibration = calibrateComparisonSettings(layouts, {
            strictness: 'medium'
          });
          bestSettings = calibration.settings;
          console.log(`  ✓ New best score!`);
        }
      }
    }
    
    // フェーズ3: 追加サンプルによる検証
    console.log('\n✅ Phase 3: Validation with Additional Samples');
    console.log('-'.repeat(40));
    
    const validationSamples = 2;
    for (let i = 0; i < validationSamples; i++) {
      console.log(`\nCollecting validation sample ${i + 1}/${validationSamples}...`);
      await page.goto(url, { waitUntil: 'networkidle0' });
      
      const rawData = await fetchRawLayoutData(page, {
        waitForContent: true,
        captureFullPage: false
      });
      
      rawDataSamples.push(rawData);
      
      // 最適な設定で要約
      const layout = await extractLayoutTree(rawData, {
        groupingThreshold: bestSettings!.importanceThreshold,
        importanceThreshold: bestSettings!.importanceThreshold,
        viewportOnly: true
      });
      
      bestLayouts.push(layout);
      
      // 既存のレイアウトとの比較
      let maxDifferences = 0;
      for (let j = 0; j < bestLayouts.length - 1; j++) {
        const comparison = compareLayoutTrees(bestLayouts[j], layout, {
          threshold: bestSettings!.positionTolerance
        });
        maxDifferences = Math.max(maxDifferences, comparison.differences.length);
      }
      
      console.log(`  - Elements: ${rawData.elements.length}`);
      console.log(`  - Groups: ${layout.visualNodeGroups?.length || 0}`);
      console.log(`  - Max differences: ${maxDifferences}`);
    }
    
    // 最終的なフレーキーネス分析
    const finalFlakiness = detectFlakiness(bestLayouts);
    
    // 結果の出力
    console.log('\n' + '='.repeat(60));
    console.log('📊 CALIBRATION RESULTS');
    console.log('='.repeat(60));
    console.log(`\nOptimal Settings:`);
    console.log(`  - Position tolerance: ${bestSettings!.positionTolerance}px`);
    console.log(`  - Size tolerance: ${bestSettings!.sizeTolerance}%`);
    console.log(`  - Text similarity: ${(bestSettings!.textSimilarityThreshold * 100).toFixed(0)}%`);
    console.log(`  - Importance threshold: ${bestSettings!.importanceThreshold}`);
    console.log(`  - Grouping threshold: ${bestSettings!.importanceThreshold}`);
    
    console.log(`\nValidation Metrics:`);
    console.log(`  - Total samples: ${rawDataSamples.length}`);
    console.log(`  - Final flakiness: ${finalFlakiness.overallScore.toFixed(1)}%`);
    console.log(`  - Stable elements: ${finalFlakiness.stableCount}`);
    console.log(`  - Flaky elements: ${finalFlakiness.flakyElements.length}`);
    
    // 設定ファイルの保存
    const configOutput = {
      url,
      timestamp: new Date().toISOString(),
      settings: bestSettings,
      validation: {
        samples: rawDataSamples.length,
        flakiness: finalFlakiness.overallScore,
        stableElements: finalFlakiness.stableCount,
        flakyElements: finalFlakiness.flakyElements.length
      }
    };
    
    await fs.writeFile(
      path.join(outputDir, 'calibration-result.json'),
      JSON.stringify(configOutput, null, 2)
    );
    
    console.log(`\n✅ Calibration complete! Results saved to ${outputDir}`);
    
    // フレーキーな要素の詳細レポート
    if (finalFlakiness.flakyElements.length > 0) {
      console.log('\n⚠️  Top Flaky Elements:');
      finalFlakiness.flakyElements.slice(0, 5).forEach((element, i) => {
        console.log(`  ${i + 1}. ${element.elementId}`);
        console.log(`     - Score: ${element.score.toFixed(1)}%`);
        console.log(`     - Changes: ${element.changeFrequency}/${element.totalComparisons}`);
      });
    }
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);