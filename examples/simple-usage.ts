/**
 * Visual Checker の段階的な使用例
 */

// ========================================
// Level 1: Core API - 最も簡単な使い方
// ========================================

import { captureScreenshot, compareImages } from '../src/core/index.js';

async function coreExample() {
  console.log('--- Level 1: Core API Example ---');
  
  // URLのスクリーンショットを撮影
  const result1 = await captureScreenshot('https://example.com', {
    outputPath: './screenshots/example1.png'
  });
  console.log('Screenshot saved to:', result1.path);
  
  // 別のスクリーンショットを撮影
  const result2 = await captureScreenshot('https://example.com', {
    outputPath: './screenshots/example2.png'
  });
  
  // 2つの画像を比較
  const comparison = await compareImages(
    result1.path,
    result2.path,
    {
      threshold: 0.1,
      generateDiff: true,
      diffPath: './screenshots/diff.png'
    }
  );
  
  console.log('Images match:', comparison.match);
  console.log('Difference:', (comparison.difference * 100).toFixed(2) + '%');
  if (comparison.diffPath) {
    console.log('Diff image:', comparison.diffPath);
  }
}

// ========================================
// Level 2: Basic API - 一般的な使い方
// ========================================

import { LegacyBrowserController as BrowserController } from '../src/index.js';
import { SnapshotManager } from '../src/snapshot/index.js';

async function basicExample() {
  console.log('\n--- Level 2: Basic API Example ---');
  
  // ブラウザ制御
  const browser = new BrowserController({
    urls: [],  // 個別にURLを指定
    playwright: {
      headless: true,
      viewport: { width: 1920, height: 1080 }
    }
  } as any);
  
  await browser.launch();
  
  // スナップショット管理
  const snapshots = new SnapshotManager('./snapshots');
  
  // ページのキャプチャ
  const screenshot = await browser.captureScreenshot({
    url: 'https://example.com',
    name: 'home',
    waitFor: {
      networkIdle: true,
      timeout: 5000
    },
    beforeScreenshot: {
      hide: ['.cookie-banner', '.ads']
    }
  });
  
  // ベースラインがない場合は作成
  if (!await snapshots.hasBaseline('home')) {
    await snapshots.update('home', screenshot);
    console.log('Baseline created');
  } else {
    // ベースラインと比較
    const result = await snapshots.compare('home', screenshot, {
      threshold: 0.1,
      generateDiff: true
    });
    
    console.log('Comparison result:', result.match ? 'PASS' : 'FAIL');
    if (!result.match) {
      console.log('Difference:', (result.difference * 100).toFixed(2) + '%');
    }
  }
  
  await browser.close();
}

// ========================================
// Level 3: 設定ファイルを使った使い方
// ========================================

import { ConfigLoader, ConfigValidator } from '../src/config/index.js';
import { SnapshotComparator } from '../src/snapshot/index.js';

async function configExample() {
  console.log('\n--- Level 3: Config-based Example ---');
  
  // 設定ファイルの読み込み
  const config = await ConfigLoader.fromFile('./configs/visual-check.config.json');
  
  // 設定の検証
  const validator = new ConfigValidator();
  const validation = validator.validate(config);
  
  if (!validation.valid) {
    console.error('Config errors:', validation.errors);
    return;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Config warnings:', validation.warnings);
  }
  
  // ブラウザとスナップショットの設定
  const browser = new BrowserController(config as any);
  const comparator = new SnapshotComparator(config.snapshotDir);
  
  await browser.launch();
  
  // すべてのURLをテスト
  const screenshots: string[] = [];
  for (const urlConfig of config.urls!) {
    const screenshotPath = await browser.captureScreenshot(urlConfig);
    screenshots.push(screenshotPath);
  }
  
  // バッチ比較
  const results = await comparator.batchCompare(
    screenshots.map((path: string, i: number) => ({
      name: config.urls![i].name,
      currentPath: path
    })),
    {
      threshold: config.comparison?.threshold,
      generateDiff: config.comparison?.generateDiff
    }
  );
  
  // レポート生成
  const report = comparator.generateReport(results);
  console.log('\n' + report);
  
  await browser.close();
}

// ========================================
// 便利な初期化関数を使った例
// ========================================

// import { createVisualChecker } from '../src/index.js'; // 削除されたためコメントアウト

async function convenientExample() {
  console.log('\n--- Convenient API Example ---');
  
  const vc = await createVisualChecker({
    baseUrl: 'https://example.com',
    snapshotDir: './snapshots',
    browser: {
      headless: true,
      viewport: { width: 1280, height: 720 }
    },
    comparison: {
      threshold: 0.1,
      generateDiff: true
    }
  });
  
  // 初回実行：ベースライン作成
  const result1 = await vc.compare('home', '/');
  console.log('First run:', 'firstRun' in result1 && result1.firstRun ? 'Baseline created' : 'Compared');
  
  // 2回目実行：比較
  const result2 = await vc.compare('home', '/');
  console.log('Second run:', result2.match ? 'PASS' : 'FAIL');
  
  // 明示的な更新
  await vc.update('about', '/about');
  console.log('About page baseline updated');
  
  await vc.close();
}

// ========================================
// 実行
// ========================================

async function main() {
  try {
    await coreExample();
    await basicExample();
    // await configExample(); // 設定ファイルが必要
    // await convenientExample(); // createVisualCheckerが削除されたためコメントアウト
  } catch (error) {
    console.error('Error:', error);
  }
}

main();