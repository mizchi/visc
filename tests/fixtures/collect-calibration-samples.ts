#!/usr/bin/env node
/**
 * キャリブレーション用のサンプルデータを収集
 * 
 * 使用方法:
 * npx tsx tests/fixtures/collect-calibration-samples.ts
 */

import puppeteer from 'puppeteer';
import { fetchRawLayoutData } from '../../src/browser/puppeteer.js';
import fs from 'fs/promises';
import path from 'path';

const SAMPLE_SITES = [
  { name: 'zenn', url: 'https://zenn.dev' },
  { name: 'yahoo', url: 'https://www.yahoo.co.jp' },
  { name: 'example', url: 'https://example.com' },
  { name: 'github-mizchi', url: 'https://github.com/mizchi' },
];

const SAMPLES_PER_SITE = 5;
const OUTPUT_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'calibration-samples');

async function collectSamples() {
  console.log('🎯 Calibration Sample Data Collection');
  console.log('=====================================');
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Sites: ${SAMPLE_SITES.length}`);
  console.log(`Samples per site: ${SAMPLES_PER_SITE}`);
  console.log('=====================================\n');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    for (const site of SAMPLE_SITES) {
      console.log(`\n📊 Collecting samples for ${site.name} (${site.url})`);
      console.log('-'.repeat(50));

      const siteDir = path.join(OUTPUT_DIR, site.name);
      await fs.mkdir(siteDir, { recursive: true });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      const samples = [];
      const metadata = {
        site: site.name,
        url: site.url,
        collectedAt: new Date().toISOString(),
        viewport: { width: 1280, height: 800 },
        sampleCount: SAMPLES_PER_SITE,
        samples: [] as any[]
      };

      for (let i = 0; i < SAMPLES_PER_SITE; i++) {
        console.log(`  Sample ${i + 1}/${SAMPLES_PER_SITE}...`);
        
        await page.goto(site.url, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });

        const rawData = await fetchRawLayoutData(page, {
          waitForContent: true,
          captureFullPage: false
        });

        const sampleFilename = `sample-${i + 1}.json`;
        const samplePath = path.join(siteDir, sampleFilename);
        
        await fs.writeFile(
          samplePath,
          JSON.stringify(rawData, null, 2)
        );

        samples.push({
          filename: sampleFilename,
          timestamp: new Date().toISOString(),
          elementCount: rawData.elements.length,
          viewport: rawData.viewport
        });

        metadata.samples.push({
          index: i + 1,
          filename: sampleFilename,
          elementCount: rawData.elements.length
        });

        console.log(`    ✓ Saved: ${sampleFilename} (${rawData.elements.length} elements)`);

        // サンプル間で少し待機（レート制限対策）
        if (i < SAMPLES_PER_SITE - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // メタデータファイルを保存
      await fs.writeFile(
        path.join(siteDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );

      console.log(`  ✅ Completed: ${SAMPLES_PER_SITE} samples collected`);
      
      await page.close();
    }

    // 全体のサマリーを作成
    const summary = {
      collectionDate: new Date().toISOString(),
      sites: SAMPLE_SITES.map(site => ({
        name: site.name,
        url: site.url,
        sampleCount: SAMPLES_PER_SITE
      })),
      totalSamples: SAMPLE_SITES.length * SAMPLES_PER_SITE
    };

    await fs.writeFile(
      path.join(OUTPUT_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n=====================================');
    console.log('✅ Sample collection complete!');
    console.log(`Total samples: ${SAMPLE_SITES.length * SAMPLES_PER_SITE}`);
    console.log(`Output directory: ${OUTPUT_DIR}`);
    
  } catch (error) {
    console.error('❌ Error collecting samples:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// エラーハンドリング付きで実行
collectSamples().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});