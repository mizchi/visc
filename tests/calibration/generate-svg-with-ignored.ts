#!/usr/bin/env node
/**
 * 動的要素を無視したSVGを生成してfixturesに保存
 */

import { extractLayoutTree, calibrateComparisonSettings, renderLayoutToSvg } from '../../dist/index.js';
import fs from 'fs/promises';
import path from 'path';

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

async function generateSvgWithIgnoredElements() {
  console.log('🎨 Generating SVGs with ignored dynamic elements');
  console.log('='.repeat(60));
  
  const sites = ['yahoo'];
  
  for (const site of sites) {
    console.log(`\n📊 Processing ${site}...`);
    
    try {
      // サンプルデータを読み込み
      const rawSamples = await loadSamplesForSite(site);
      console.log(`  - Loaded ${rawSamples.length} samples`);
      
      // レイアウトツリーを抽出
      const layouts = await Promise.all(
        rawSamples.map(raw => extractLayoutTree(raw, {
          groupingThreshold: 20,
          importanceThreshold: 10,
          viewportOnly: true
        }))
      );
      
      // キャリブレーションを実行して動的要素を検出
      const calibration = calibrateComparisonSettings(layouts, {
        strictness: 'medium',
        detectDynamicElements: true,
        dynamicThreshold: 20
      });
      
      console.log(`  - Detected ${calibration.dynamicElements?.length || 0} dynamic elements`);
      console.log(`  - Generated ${calibration.settings.ignoreElements?.length || 0} ignore selectors`);
      
      // デバッグ: セレクタがないものを確認
      if (calibration.dynamicElements && calibration.dynamicElements.length > 0) {
        const noSelectorCount = calibration.dynamicElements.filter(e => !e.selector).length;
        console.log(`  - Elements without selector: ${noSelectorCount}`);
        if (noSelectorCount > 0) {
          console.log(`    Example:`, calibration.dynamicElements.find(e => !e.selector));
        }
      }
      
      // 最後のレイアウトを使用してSVGを生成
      const lastLayout = layouts[layouts.length - 1];
      
      // 通常のSVG
      const normalSvg = renderLayoutToSvg(lastLayout);
      
      // 動的要素を無視したSVG
      const ignoredSvg = renderLayoutToSvg(lastLayout, {
        ignoreElements: calibration.settings.ignoreElements
      });
      
      // SVGを保存
      const siteDir = path.join(FIXTURES_DIR, site);
      
      await fs.writeFile(
        path.join(siteDir, 'layout-normal.svg'),
        normalSvg
      );
      console.log(`  ✓ Saved normal SVG`);
      
      await fs.writeFile(
        path.join(siteDir, 'layout-ignored-dynamic.svg'),
        ignoredSvg
      );
      console.log(`  ✓ Saved SVG with ignored dynamic elements`);
      
      // 動的要素の情報も保存
      if (calibration.dynamicElements && calibration.dynamicElements.length > 0) {
        const dynamicInfo = {
          site,
          timestamp: new Date().toISOString(),
          dynamicElementCount: calibration.dynamicElements.length,
          ignoreSelectorCount: calibration.settings.ignoreElements?.length || 0,
          topDynamicElements: calibration.dynamicElements.slice(0, 10).map(elem => ({
            path: elem.path,
            selector: elem.selector,
            score: elem.flakinessScore,
            reason: elem.reason
          })),
          ignoreSelectors: calibration.settings.ignoreElements?.slice(0, 20) || []
        };
        
        await fs.writeFile(
          path.join(siteDir, 'dynamic-elements-info.json'),
          JSON.stringify(dynamicInfo, null, 2)
        );
        console.log(`  ✓ Saved dynamic elements info`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error processing ${site}:`, error);
    }
  }
  
  console.log('\n✅ SVG generation complete!');
}

// エラーハンドリング付きで実行
generateSvgWithIgnoredElements().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});