import { describe, it, expect } from 'vitest';
import { extractLayoutTree, calibrateComparisonSettings, detectFlakiness } from '../../src/index.js';
import fs from 'fs/promises';
import path from 'path';

describe('Calibration with Fixture Data', () => {
  const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'calibration-samples');

  async function loadSamplesForSite(siteName: string) {
    const siteDir = path.join(FIXTURES_DIR, siteName);
    const files = await fs.readdir(siteDir);
    const sampleFiles = files.filter(f => f.startsWith('sample-')).sort();
    
    const samples = [];
    for (const file of sampleFiles) {
      const rawData = JSON.parse(
        await fs.readFile(path.join(siteDir, file), 'utf-8')
      );
      samples.push(rawData);
    }
    
    return samples;
  }

  it('should calibrate settings for zenn.dev', async () => {
    const rawSamples = await loadSamplesForSite('zenn');
    expect(rawSamples).toHaveLength(5);
    
    // 各生データからレイアウトツリーを抽出
    const layouts = await Promise.all(
      rawSamples.map(raw => extractLayoutTree(raw, {
        groupingThreshold: 20,
        importanceThreshold: 10,
        viewportOnly: true
      }))
    );
    
    // フレーキーネス分析
    const flakiness = detectFlakiness(layouts);
    console.log(`Zenn flakiness: ${flakiness.overallScore.toFixed(1)}%`);
    console.log(`Flaky elements: ${flakiness.flakyElements.length}`);
    
    // キャリブレーション
    const calibration = calibrateComparisonSettings(layouts, {
      strictness: 'medium'
    });
    
    console.log('Zenn calibration results:');
    console.log(`  Position tolerance: ${calibration.settings.positionTolerance}px`);
    console.log(`  Size tolerance: ${calibration.settings.sizeTolerance}%`);
    console.log(`  Confidence: ${calibration.confidence.toFixed(0)}%`);
    
    expect(calibration.settings.positionTolerance).toBeGreaterThan(0);
    expect(calibration.confidence).toBeGreaterThan(50);
  });

  it('should calibrate settings for example.com', async () => {
    const rawSamples = await loadSamplesForSite('example');
    expect(rawSamples).toHaveLength(5);
    
    const layouts = await Promise.all(
      rawSamples.map(raw => extractLayoutTree(raw, {
        groupingThreshold: 20,
        importanceThreshold: 10,
        viewportOnly: true
      }))
    );
    
    const flakiness = detectFlakiness(layouts);
    console.log(`Example.com flakiness: ${flakiness.overallScore.toFixed(1)}%`);
    
    const calibration = calibrateComparisonSettings(layouts, {
      strictness: 'high'
    });
    
    console.log('Example.com calibration results:');
    console.log(`  Position tolerance: ${calibration.settings.positionTolerance}px`);
    console.log(`  Size tolerance: ${calibration.settings.sizeTolerance}%`);
    
    // example.comは非常に安定しているはず
    expect(flakiness.overallScore).toBeLessThan(5);
  });

  it('should calibrate settings for github.com/mizchi', async () => {
    const rawSamples = await loadSamplesForSite('github-mizchi');
    expect(rawSamples).toHaveLength(5);
    
    const layouts = await Promise.all(
      rawSamples.map(raw => extractLayoutTree(raw, {
        groupingThreshold: 20,
        importanceThreshold: 10,
        viewportOnly: true
      }))
    );
    
    const flakiness = detectFlakiness(layouts);
    console.log(`GitHub flakiness: ${flakiness.overallScore.toFixed(1)}%`);
    
    const calibration = calibrateComparisonSettings(layouts, {
      strictness: 'medium'
    });
    
    console.log('GitHub calibration results:');
    console.log(`  Position tolerance: ${calibration.settings.positionTolerance}px`);
    console.log(`  Size tolerance: ${calibration.settings.sizeTolerance}%`);
    
    expect(calibration.settings.positionTolerance).toBeGreaterThan(0);
  });

  it('should calibrate settings for yahoo.co.jp', async () => {
    const rawSamples = await loadSamplesForSite('yahoo');
    expect(rawSamples).toHaveLength(5);
    
    const layouts = await Promise.all(
      rawSamples.map(raw => extractLayoutTree(raw, {
        groupingThreshold: 20,
        importanceThreshold: 10,
        viewportOnly: true
      }))
    );
    
    const flakiness = detectFlakiness(layouts);
    console.log(`Yahoo flakiness: ${flakiness.overallScore.toFixed(1)}%`);
    
    // フレーキーな要素の詳細
    if (flakiness.flakyElements.length > 0) {
      console.log('Top flaky elements:');
      flakiness.flakyElements.slice(0, 3).forEach((elem, i) => {
        console.log(`  ${i + 1}. ${elem.path} (${elem.flakinessType}): ${elem.score.toFixed(1)}%`);
      });
    }
    
    const calibration = calibrateComparisonSettings(layouts, {
      strictness: 'low' // Yahooは動的コンテンツが多いため低い厳密さ
    });
    
    console.log('Yahoo calibration results:');
    console.log(`  Position tolerance: ${calibration.settings.positionTolerance}px`);
    console.log(`  Size tolerance: ${calibration.settings.sizeTolerance}%`);
    
    expect(calibration.settings.positionTolerance).toBeGreaterThan(0);
  });

  it('should compare calibration settings across sites', async () => {
    const sites = ['zenn', 'example', 'github-mizchi', 'yahoo'];
    const results = [];
    
    for (const site of sites) {
      const rawSamples = await loadSamplesForSite(site);
      const layouts = await Promise.all(
        rawSamples.map(raw => extractLayoutTree(raw, {
          groupingThreshold: 20,
          importanceThreshold: 10,
          viewportOnly: true
        }))
      );
      
      const flakiness = detectFlakiness(layouts);
      const calibration = calibrateComparisonSettings(layouts);
      
      results.push({
        site,
        flakiness: flakiness.overallScore,
        positionTolerance: calibration.settings.positionTolerance,
        sizeTolerance: calibration.settings.sizeTolerance,
        confidence: calibration.confidence
      });
    }
    
    // 結果をフレーキーネススコアでソート
    results.sort((a, b) => a.flakiness - b.flakiness);
    
    console.log('\n=== Calibration Comparison ===');
    console.log('Site           | Flakiness | Pos Tol | Size Tol | Confidence');
    console.log('---------------|-----------|---------|----------|------------');
    results.forEach(r => {
      console.log(
        `${r.site.padEnd(14)} | ${r.flakiness.toFixed(1).padStart(9)}% | ${
          r.positionTolerance.toString().padStart(7)
        }px | ${r.sizeTolerance.toString().padStart(8)}% | ${
          r.confidence.toFixed(0).padStart(10)
        }%`
      );
    });
    
    // 最も安定したサイトと最も不安定なサイトの確認
    expect(results[0].flakiness).toBeLessThan(results[results.length - 1].flakiness);
  });
});