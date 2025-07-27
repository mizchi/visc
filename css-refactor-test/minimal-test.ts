import { chromium } from '@playwright/test';
import { compareImages } from '../dist/core/compare.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMinimalCSSChanges() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  try {
    console.log('🚀 Testing Minimal CSS Changes (should pass with 1% threshold)\n');
    
    // 1. オリジナルCSS
    const testPagePath = `file://${path.join(__dirname, 'test-page.html')}`;
    await page.goto(testPagePath);
    
    const originalPath = './snapshots/minimal-original.png';
    await page.screenshot({ path: originalPath });
    console.log('✅ Original screenshot saved');
    
    // 2. 最小限の変更を加えたCSS
    await page.evaluate(() => {
      document.getElementById('original-css')?.remove();
    });
    
    const minimalCSS = await fs.readFile('./minimal-changes.css', 'utf-8');
    await page.addStyleTag({ content: minimalCSS });
    
    const minimalPath = './snapshots/minimal-changed.png';
    await page.screenshot({ path: minimalPath });
    console.log('✅ Minimal changes screenshot saved');
    
    // 3. 比較
    console.log('\n🔍 Comparing with 1% threshold...');
    const result = await compareImages(originalPath, minimalPath, {
      threshold: 0.01,
      generateDiff: true,
      diffPath: './css-refactor-diffs/minimal-diff.png'
    });
    
    console.log('\n📊 Result:');
    console.log(`  Difference: ${(result.difference * 100).toFixed(4)}%`);
    console.log(`  Status: ${result.difference <= 0.01 ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (result.difference <= 0.01) {
      console.log('\n✅ CSS refactoring passed visual regression test!');
      console.log('  The changes are within acceptable threshold.');
    }
    
  } finally {
    await browser.close();
  }
}

testMinimalCSSChanges().catch(console.error);