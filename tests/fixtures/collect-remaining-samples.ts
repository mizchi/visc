#!/usr/bin/env node
/**
 * 残りのキャリブレーション用サンプルデータを収集
 * (yahoo, example, github)
 */

import puppeteer from 'puppeteer';
import { fetchRawLayoutData } from '../../src/browser/puppeteer.js';
import fs from 'fs/promises';
import path from 'path';

const REMAINING_SITES = [
  { name: 'example', url: 'https://example.com' },
  { name: 'github-mizchi', url: 'https://github.com/mizchi' },
  { name: 'yahoo', url: 'https://www.yahoo.co.jp' }, // 最後に実行
];

const SAMPLES_PER_SITE = 5;
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'calibration-samples');

async function collectRemainingSamples() {
  console.log('🎯 Collecting Remaining Calibration Samples');
  console.log('==========================================');
  console.log(`Sites to process: ${REMAINING_SITES.map(s => s.name).join(', ')}`);
  console.log('==========================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const site of REMAINING_SITES) {
      const siteDir = path.join(OUTPUT_DIR, site.name);
      
      // 既存のサンプル数を確認
      let existingSamples = 0;
      try {
        const files = await fs.readdir(siteDir);
        existingSamples = files.filter(f => f.startsWith('sample-')).length;
      } catch {
        // ディレクトリが存在しない場合
        await fs.mkdir(siteDir, { recursive: true });
      }

      const samplesToCollect = SAMPLES_PER_SITE - existingSamples;
      
      if (samplesToCollect <= 0) {
        console.log(`✓ ${site.name}: Already has ${SAMPLES_PER_SITE} samples`);
        continue;
      }

      console.log(`\n📊 Collecting ${samplesToCollect} samples for ${site.name} (${site.url})`);
      console.log('-'.repeat(50));

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // タイムアウトを短めに設定
      page.setDefaultNavigationTimeout(20000);
      page.setDefaultTimeout(15000);

      const metadata = {
        site: site.name,
        url: site.url,
        collectedAt: new Date().toISOString(),
        viewport: { width: 1280, height: 800 },
        sampleCount: SAMPLES_PER_SITE,
        samples: [] as any[]
      };

      for (let i = existingSamples + 1; i <= SAMPLES_PER_SITE; i++) {
        console.log(`  Sample ${i}/${SAMPLES_PER_SITE}...`);
        
        try {
          await page.goto(site.url, { 
            waitUntil: 'domcontentloaded', // より速い読み込み
            timeout: 20000 
          });

          // 追加の待機（動的コンテンツ用）
          await new Promise(resolve => setTimeout(resolve, 2000));

          const rawData = await fetchRawLayoutData(page, {
            waitForContent: false, // 高速化のため無効化
            captureFullPage: false
          });

          const sampleFilename = `sample-${i}.json`;
          const samplePath = path.join(siteDir, sampleFilename);
          
          await fs.writeFile(
            samplePath,
            JSON.stringify(rawData, null, 2)
          );

          metadata.samples.push({
            index: i,
            filename: sampleFilename,
            elementCount: rawData.elements.length
          });

          console.log(`    ✓ Saved: ${sampleFilename} (${rawData.elements.length} elements)`);

        } catch (error: any) {
          console.log(`    ⚠️  Failed to collect sample ${i}: ${error.message}`);
          // エラーが発生しても続行
        }

        // サンプル間で少し待機
        if (i < SAMPLES_PER_SITE) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // メタデータファイルを保存
      await fs.writeFile(
        path.join(siteDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      console.log(`  ✅ Completed: ${metadata.samples.length} samples collected`);
      
      await page.close();
    }

    // 全体のサマリーを更新
    const allSites = ['zenn', 'yahoo', 'example', 'github-mizchi'];
    let totalCollected = 0;
    const siteStats = [];

    for (const siteName of allSites) {
      try {
        const files = await fs.readdir(path.join(OUTPUT_DIR, siteName));
        const sampleCount = files.filter(f => f.startsWith('sample-')).length;
        totalCollected += sampleCount;
        siteStats.push({ name: siteName, sampleCount });
      } catch {
        siteStats.push({ name: siteName, sampleCount: 0 });
      }
    }

    const summary = {
      collectionDate: new Date().toISOString(),
      sites: siteStats,
      totalSamples: totalCollected
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n==========================================');
    console.log('✅ Collection complete!');
    console.log(`Total samples collected: ${totalCollected}`);
    console.log('Site breakdown:');
    siteStats.forEach(stat => {
      console.log(`  - ${stat.name}: ${stat.sampleCount} samples`);
    });
    
  } catch (error) {
    console.error('❌ Error collecting samples:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// エラーハンドリング付きで実行
collectRemainingSamples().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});