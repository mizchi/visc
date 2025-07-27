import { chromium } from '@playwright/test';
import { compareImages } from '../dist/core/compare.js';
import fs from 'fs/promises';
import path from 'path';

async function testCSSRefactor() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  try {
    // スナップショットディレクトリを作成
    await fs.mkdir('./snapshots', { recursive: true });
    await fs.mkdir('./css-refactor-diffs', { recursive: true });
    
    // 1. example.com のスクリーンショットを撮影
    console.log('📸 Taking screenshot of example.com...');
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const screenshot1Path = './snapshots/example-1.png';
    await page.screenshot({ 
      path: screenshot1Path,
      fullPage: true 
    });
    console.log('✅ First screenshot saved:', screenshot1Path);
    
    // 2. 少し待ってから2回目のスクリーンショット（同じはず）
    console.log('\n📸 Taking second screenshot...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const screenshot2Path = './snapshots/example-2.png';
    await page.screenshot({ 
      path: screenshot2Path,
      fullPage: true 
    });
    console.log('✅ Second screenshot saved:', screenshot2Path);
    
    // 3. 画像を比較
    console.log('\n🔍 Comparing images...');
    const result = await compareImages(screenshot1Path, screenshot2Path, {
      threshold: 0.01,
      generateDiff: true,
      diffPath: './css-refactor-diffs/example-diff.png'
    });
    
    console.log('\n📊 Comparison result:');
    console.log(`  Match: ${result.match ? '✅' : '❌'}`);
    console.log(`  Difference: ${(result.difference * 100).toFixed(4)}%`);
    console.log(`  Different pixels: ${result.diffPixels}`);
    
    if (result.diffPath) {
      console.log(`  Diff image: ${result.diffPath}`);
    }
    
    // 4. CSSを変更した場合のシミュレーション
    console.log('\n🎨 Simulating CSS changes...');
    await page.addStyleTag({
      content: `
        body { 
          background-color: #f0f0f0 !important; 
          font-family: Georgia, serif !important;
        }
        h1 { 
          color: #ff6b6b !important; 
          font-size: 3rem !important;
        }
      `
    });
    
    const screenshot3Path = './snapshots/example-modified.png';
    await page.screenshot({ 
      path: screenshot3Path,
      fullPage: true 
    });
    console.log('✅ Modified screenshot saved:', screenshot3Path);
    
    // 5. 変更後の比較
    console.log('\n🔍 Comparing original vs modified...');
    const modifiedResult = await compareImages(screenshot1Path, screenshot3Path, {
      threshold: 0.01,
      generateDiff: true,
      diffPath: './css-refactor-diffs/example-modified-diff.png'
    });
    
    console.log('\n📊 Modified comparison result:');
    console.log(`  Match: ${modifiedResult.match ? '✅' : '❌'}`);
    console.log(`  Difference: ${(modifiedResult.difference * 100).toFixed(4)}%`);
    console.log(`  Different pixels: ${modifiedResult.diffPixels}`);
    
    if (modifiedResult.diffPath) {
      console.log(`  Diff image: ${modifiedResult.diffPath}`);
    }
    
    // テスト結果のサマリー
    console.log('\n📋 Test Summary:');
    console.log('1. Same page comparison:', result.match ? 'PASSED ✅' : 'FAILED ❌');
    console.log('2. CSS change detection:', !modifiedResult.match ? 'PASSED ✅' : 'FAILED ❌');
    
  } finally {
    await browser.close();
  }
}

// 実行
testCSSRefactor().catch(console.error);