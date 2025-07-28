#!/usr/bin/env node
import { test } from 'node:test';
import { createCoverageAssert, assertCoverage } from '../../dist/assertion/coverage.js';
import assert from 'node:assert';

const OUTPUT_DIR = process.argv.find(arg => arg.startsWith('--outdir='))?.split('=')[1] || './output';

test('CSSカバレッジ測定テスト', async () => {
  const coverage = await createCoverageAssert({ 
    outputDir: OUTPUT_DIR,
    viewports: [
      { width: 1280, height: 720, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ]
  });

  try {
    const result = await coverage.testSemanticLayoutWithViewports('main', {
      coverage: true,
      generateSVG: true
    });

    console.log(`テスト "${result.name}" の結果:`);
    
    // 各viewportの結果を表示
    for (const viewport of result.viewports) {
      console.log(`\n  Viewport: ${viewport.viewportName}`);
      console.log(`    Screenshot: ${viewport.screenshot}`);
      
      if (viewport.coverage) {
        console.log(`    JS Coverage: ${viewport.coverage.js.percentage}%`);
        console.log(`    CSS Coverage: ${viewport.coverage.css.percentage}%`);
      }
      
      if (viewport.semanticLayout) {
        console.log(`    Semantic Layout: ${viewport.semanticLayout.json}`);
        if (viewport.semanticLayout.svg) {
          console.log(`    SVG: ${viewport.semanticLayout.svg}`);
        }
      }
    }

    // 総合カバレッジを表示
    if (result.totalCoverage) {
      console.log(`\n総合カバレッジ:`);
      console.log(`  JS: ${result.totalCoverage.js.percentage}% (${result.totalCoverage.js.usedBytes}/${result.totalCoverage.js.totalBytes} bytes)`);
      console.log(`  CSS: ${result.totalCoverage.css.percentage}% (${result.totalCoverage.css.usedBytes}/${result.totalCoverage.css.totalBytes} bytes)`);

      // カバレッジのアサーション
      assertCoverage(result.totalCoverage, {
        js: 30,  // 30%以上のJSカバレッジ
        css: 50  // 50%以上のCSSカバレッジ
      });
    }

    assert.ok(result.viewports.length === 3, '3つのviewportでテストが実行された');
  } finally {
    await coverage.cleanup();
  }
});

test('URLベースのカバレッジ測定', async () => {
  const coverage = await createCoverageAssert({ 
    outputDir: OUTPUT_DIR,
    viewports: [
      { width: 1920, height: 1080, name: 'full-hd' }
    ]
  });

  try {
    const result = await coverage.testWithViewports(
      'example-site',
      'https://example.com',
      {
        coverage: true,
        generateSVG: false
      }
    );

    console.log(`\nURLテストの結果:`);
    console.log(`  テスト名: ${result.name}`);
    
    if (result.totalCoverage) {
      console.log(`  JS Coverage: ${result.totalCoverage.js.percentage}%`);
      console.log(`  CSS Coverage: ${result.totalCoverage.css.percentage}%`);
    }
  } finally {
    await coverage.cleanup();
  }
});