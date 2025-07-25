/**
 * レイアウト安定性チェック
 * 
 * 同じURLから複数回レイアウトを取得し、一貫性があることを確認します。
 * これにより、レイアウト抽出の信頼性を検証します。
 */

import { chromium } from '@playwright/test';
import { extractLayoutScript } from '../../dist/layout/extractor.js';
import { extractSemanticLayoutScript } from '../../dist/layout/semantic-analyzer.js';
import { compareLayouts } from '../../dist/layout/comparator.js';
import type { LayoutAnalysisResult } from '../../dist/index.js';

interface StabilityCheckResult {
  url: string;
  isStable: boolean;
  attempts: number;
  similarities: number[];
  issues: string[];
}

/**
 * レイアウトの安定性をチェック
 */
export async function checkLayoutStability(
  url: string,
  options: {
    attempts?: number;
    waitBetween?: number;
    semantic?: boolean;
    threshold?: number;
  } = {}
): Promise<StabilityCheckResult> {
  const {
    attempts = 3,
    waitBetween = 1000,
    semantic = true,
    threshold = 98
  } = options;

  const browser = await chromium.launch({ headless: true });
  const extractScript = semantic ? extractSemanticLayoutScript : extractLayoutScript;
  const results: LayoutAnalysisResult[] = [];
  const issues: string[] = [];

  try {
    // 複数回レイアウトを取得
    for (let i = 0; i < attempts; i++) {
      const page = await browser.newPage();
      
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500); // 追加の安定化待機
        
        const layout = await page.evaluate(extractScript) as LayoutAnalysisResult;
        results.push(layout);
        
        await page.close();
        
        if (i < attempts - 1) {
          await new Promise(resolve => setTimeout(resolve, waitBetween));
        }
      } catch (error) {
        issues.push(`Attempt ${i + 1} failed: ${error}`);
        await page.close();
      }
    }

    // 結果を比較
    const similarities: number[] = [];
    let isStable = true;

    for (let i = 1; i < results.length; i++) {
      const comparison = compareLayouts(results[0], results[i]);
      similarities.push(comparison.similarity);
      
      if (comparison.similarity < threshold) {
        isStable = false;
        issues.push(`Attempt ${i + 1} similarity: ${comparison.similarity.toFixed(2)}% (below threshold ${threshold}%)`);
        
        // 主な差分を記録
        const majorDifferences = comparison.differences.slice(0, 5);
        majorDifferences.forEach(diff => {
          issues.push(`  - ${diff.type}: ${diff.path}`);
        });
      }
    }

    return {
      url,
      isStable,
      attempts: results.length,
      similarities,
      issues
    };
  } finally {
    await browser.close();
  }
}

/**
 * 複数のURLの安定性をバッチチェック
 */
export async function batchStabilityCheck(
  urls: string[],
  options?: {
    attempts?: number;
    waitBetween?: number;
    semantic?: boolean;
    threshold?: number;
  }
): Promise<Map<string, StabilityCheckResult>> {
  const results = new Map<string, StabilityCheckResult>();

  for (const url of urls) {
    console.log(`\nChecking stability for: ${url}`);
    const result = await checkLayoutStability(url, options);
    results.set(url, result);
    
    // 結果を表示
    console.log(`  Status: ${result.isStable ? '✅ STABLE' : '❌ UNSTABLE'}`);
    if (result.similarities.length > 0) {
      console.log(`  Similarities: ${result.similarities.map(s => `${s.toFixed(2)}%`).join(', ')}`);
    }
    if (result.issues.length > 0) {
      console.log('  Issues:');
      result.issues.forEach(issue => console.log(`    ${issue}`));
    }
  }

  return results;
}

// CLI実行用
if (import.meta.url === `file://${process.argv[1]}`) {
  const urls = process.argv.slice(2);
  
  if (urls.length === 0) {
    console.log('Usage: node layout-stability-check.js <url1> [url2] [url3] ...');
    console.log('Example: node layout-stability-check.js https://example.com https://google.com');
    process.exit(1);
  }

  (async () => {
    try {
      console.log('🔍 Checking layout stability...\n');
      
      const results = await batchStabilityCheck(urls, {
        attempts: 3,
        waitBetween: 1000,
        semantic: true,
        threshold: 95
      });
      
      // サマリーを表示
      console.log('\n📊 Summary:');
      let stableCount = 0;
      let unstableCount = 0;
      
      results.forEach((result, url) => {
        if (result.isStable) {
          stableCount++;
        } else {
          unstableCount++;
        }
      });
      
      console.log(`  Total URLs: ${results.size}`);
      console.log(`  Stable: ${stableCount}`);
      console.log(`  Unstable: ${unstableCount}`);
      
      if (unstableCount > 0) {
        console.log('\n⚠️  Some URLs showed unstable layouts. This may indicate:');
        console.log('  - Dynamic content that changes between page loads');
        console.log('  - Animations or transitions that affect layout');
        console.log('  - A/B testing or personalization');
        console.log('  - Issues with the layout extraction logic');
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}