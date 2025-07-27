import { chromium } from '@playwright/test';
import { compareImages } from '../dist/core/compare.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    
    // 1. オリジナルCSSでスクリーンショット
    console.log('📸 Taking screenshot with original CSS...');
    const testPagePath = `file://${path.join(__dirname, 'test-page.html')}`;
    await page.goto(testPagePath);
    
    const originalPath = './snapshots/original.png';
    await page.screenshot({ 
      path: originalPath,
      fullPage: true 
    });
    console.log('✅ Original screenshot saved:', originalPath);
    
    // 2. CSSを差し替えてスクリーンショット
    console.log('\n🎨 Applying refactored CSS...');
    
    // 既存のスタイルを削除
    await page.evaluate(() => {
      const originalStyle = document.getElementById('original-css');
      if (originalStyle) {
        originalStyle.remove();
      }
    });
    
    // リファクタリング後のCSSを適用
    const refactoredCSS = await fs.readFile('./refactored-styles.css', 'utf-8');
    await page.addStyleTag({ content: refactoredCSS });
    
    const refactoredPath = './snapshots/refactored.png';
    await page.screenshot({ 
      path: refactoredPath,
      fullPage: true 
    });
    console.log('✅ Refactored screenshot saved:', refactoredPath);
    
    // 3. 画像を比較
    console.log('\n🔍 Comparing original vs refactored CSS...');
    const result = await compareImages(originalPath, refactoredPath, {
      threshold: 0.01, // 1%の差分まで許容
      generateDiff: true,
      diffPath: './css-refactor-diffs/css-diff.png'
    });
    
    console.log('\n📊 Comparison Result:');
    console.log(`  Match: ${result.match ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  Difference: ${(result.difference * 100).toFixed(2)}%`);
    console.log(`  Different pixels: ${result.diffPixels}`);
    
    if (result.diffPath) {
      console.log(`  Diff image: ${result.diffPath}`);
    }
    
    // 4. 詳細な差分分析
    if (!result.match) {
      console.log('\n⚠️  Visual differences detected!');
      console.log('  This indicates that the CSS refactoring has introduced visual changes.');
      console.log('  Review the diff image to determine if these changes are acceptable.');
      
      // しきい値を超えているかチェック
      if (result.difference > 0.01) {
        console.log(`\n❌ Difference (${(result.difference * 100).toFixed(2)}%) exceeds threshold (1%)`);
        console.log('  The CSS refactoring has introduced significant visual regressions.');
      }
    } else {
      console.log('\n✅ CSS refactoring is visually identical!');
      console.log('  The refactored CSS produces the same visual output.');
    }
    
    // 5. レポート生成
    const report = {
      timestamp: new Date().toISOString(),
      originalCSS: 'test-page.html (inline styles)',
      refactoredCSS: 'refactored-styles.css',
      result: {
        match: result.match,
        difference: result.difference,
        diffPixels: result.diffPixels,
        threshold: 0.01
      },
      passed: result.difference <= 0.01
    };
    
    await fs.writeFile(
      './css-refactor-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Report saved: ./css-refactor-report.json');
    
  } finally {
    await browser.close();
  }
}

// 実行
console.log('🚀 CSS Refactoring Visual Test\n');
testCSSRefactor().catch(console.error);