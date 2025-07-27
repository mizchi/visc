import { ResponsiveMatrixTester, ResponsiveMatrixReportGenerator } from '../src/index.js';
import { BrowserController } from '../src/browser-controller.js';
import { VisualCheckConfig } from '../src/types.js';

/**
 * レスポンシブマトリクステストの使用例
 */
async function runResponsiveMatrixTest() {
  // 設定
  const config: VisualCheckConfig = {
    baseUrl: 'https://example.com',
    snapshotDir: './snapshots',
    responsiveMatrix: {
      enabled: true,
      viewports: [
        { name: 'mobile-sm', width: 320, height: 568 },
        { name: 'mobile', width: 375, height: 667, deviceScaleFactor: 2 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1280, height: 720 },
        { name: 'wide', width: 1920, height: 1080 }
      ],
      breakpoints: [
        { name: 'mobile', maxWidth: 767 },
        { name: 'tablet', minWidth: 768, maxWidth: 1023 },
        { name: 'desktop', minWidth: 1024 }
      ],
      cssSimilarityThreshold: 0.85
    },
    urls: [
      {
        name: 'homepage',
        url: '/',
        waitFor: { networkIdle: true }
      }
    ]
  };

  // ブラウザコントローラーの初期化
  const browserController = new BrowserController({
    browser: 'chromium',
    headless: true
  });

  try {
    await browserController.launch();
    
    // テスターの初期化
    const tester = new ResponsiveMatrixTester(browserController, config);
    const reportGenerator = new ResponsiveMatrixReportGenerator();
    
    console.log('🚀 Starting responsive matrix test...\n');
    
    // 各URLに対してテストを実行
    const results = [];
    for (const urlConfig of config.urls) {
      console.log(`Testing ${urlConfig.name}...`);
      const result = await tester.testUrl(urlConfig);
      results.push(result);
      
      // 結果の概要を表示
      console.log(`✅ Completed: ${urlConfig.name}`);
      console.log(`   Viewports tested: ${result.summary.totalViewports}`);
      console.log(`   Passed: ${result.summary.passedViewports}`);
      console.log(`   Failed: ${result.summary.failedViewports}`);
      
      if (result.summary.mediaQueryIssues > 0) {
        console.log(`   ⚠️  Media query issues: ${result.summary.mediaQueryIssues}`);
      }
      
      if (result.summary.layoutInconsistencies > 0) {
        console.log(`   ⚠️  Layout inconsistencies: ${result.summary.layoutInconsistencies}`);
      }
      
      console.log('');
    }
    
    // レポートの生成
    console.log('📊 Generating reports...\n');
    
    await reportGenerator.generateHTMLReport(results, './reports/responsive-matrix.html');
    console.log('✅ HTML report saved to: ./reports/responsive-matrix.html');
    
    await reportGenerator.generateJSONReport(results, './reports/responsive-matrix.json');
    console.log('✅ JSON report saved to: ./reports/responsive-matrix.json');
    
    await reportGenerator.generateMarkdownReport(results, './reports/responsive-matrix.md');
    console.log('✅ Markdown report saved to: ./reports/responsive-matrix.md');
    
    // メディアクエリの詳細を表示
    console.log('\n📱 Media Query Analysis:');
    for (const result of results) {
      const inconsistent = result.mediaQueryConsistency.filter(m => !m.isConsistent);
      if (inconsistent.length > 0) {
        console.log(`\n${result.url.name} - Media Query Issues:`);
        inconsistent.forEach(mq => {
          console.log(`  ❌ ${mq.query}`);
          console.log(`     Expected: ${mq.expectedViewports.join(', ')}`);
          console.log(`     Actual: ${mq.actualViewports.join(', ')}`);
        });
      }
    }
    
    // 全体の成功/失敗を判定
    const allPassed = results.every(r => r.passed);
    console.log(`\n${allPassed ? '✅ All tests passed!' : '❌ Some tests failed.'}`);
    
  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    await browserController.close();
  }
}

// プログラム的な使用例
async function programmaticExample() {
  const browserController = new BrowserController({
    browser: 'chromium',
    headless: true
  });
  
  const config: VisualCheckConfig = {
    responsiveMatrix: {
      enabled: true,
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'desktop', width: 1920, height: 1080 }
      ]
    }
  };
  
  await browserController.launch();
  const tester = new ResponsiveMatrixTester(browserController, config);
  
  // 単一URLのテスト
  const result = await tester.testUrl({
    name: 'test-page',
    url: 'https://example.com'
  });
  
  // 結果の検証
  if (result.passed) {
    console.log('✅ レスポンシブデザインが正しく実装されています');
  } else {
    console.log('❌ レスポンシブデザインに問題があります');
    
    // 問題の詳細を表示
    result.mediaQueryConsistency
      .filter(m => !m.isConsistent)
      .forEach(m => {
        console.log(`Media Query Issue: ${m.query}`);
        m.inconsistencies?.forEach(i => console.log(`  - ${i}`));
      });
  }
  
  await browserController.close();
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  runResponsiveMatrixTest().catch(console.error);
}