import { 
  BrowserController,
  SnapshotManager,
  ConfigLoader
} from '../dist/index.js';

async function compareCSSRefactor() {
  const config = await ConfigLoader.fromFile('./config.json');
  
  const browser = new BrowserController({
    headless: true,
    viewport: { width: 1280, height: 720 }
  });
  
  const snapshotManager = new SnapshotManager('./snapshots/css-refactor');
  
  try {
    await browser.launch();
    
    // 1. 元のCSSでベースラインを作成
    console.log('📸 Creating baseline with original CSS...');
    
    const originalScreenshot = await browser.captureScreenshot({
      url: config.baseUrl,
      name: 'example-original'
    });
    
    await snapshotManager.update('example', originalScreenshot);
    console.log('✅ Baseline created:', originalScreenshot);
    
    // 2. プロキシなしでは同じ見た目なので、差分を作るために少し待つ
    console.log('\n🔄 Comparing with same CSS (should match)...');
    
    const sameScreenshot = await browser.captureScreenshot({
      url: config.baseUrl,
      name: 'example-same'
    });
    
    const result = await snapshotManager.compare(
      'example', 
      sameScreenshot,
      {
        threshold: config.comparison.threshold,
        generateDiff: config.comparison.generateDiff
      }
    );
    
    console.log('Comparison result:', {
      match: result.match,
      difference: `${(result.difference * 100).toFixed(2)}%`,
      diffPixels: result.diffPixels
    });
    
    if (!result.match) {
      console.error('❌ Unexpected difference detected!');
      if (result.diffPath) {
        console.error(`   Diff image: ${result.diffPath}`);
      }
    } else {
      console.log('✅ Images match as expected!');
    }
    
  } finally {
    await browser.close();
  }
}

// 実行
compareCSSRefactor().catch(console.error);