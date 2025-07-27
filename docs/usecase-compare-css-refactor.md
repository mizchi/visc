# CSS リファクタリング検証のユースケース

## 概要

CSSのリファクタリング時に、既存のスタイルと新しいスタイルで視覚的な差分が発生していないかを検証するユースケースです。本番環境の `application-*.css` を差し替え用のCSSで置き換えて、レイアウトの差分を検出します。

## 使用シナリオ

- CSSフレームワークの移行（Bootstrap → Tailwind CSS など）
- CSS設計の変更（BEM → CSS Modules など）
- CSSの最適化・リファクタリング
- デザインシステムの更新

## 実装例

### 1. 最小限のテストスクリプト

```typescript
import { chromium } from '@playwright/test';
import { compareImages } from '@mizchi/visual-checker/core';

const originalCSS = `
  body { background: white; color: black; }
  h1 { color: #333; font-size: 2rem; }
`;

const refactoredCSS = `
  body { background: #f8f9fa; color: #212529; }
  h1 { color: #2c3e50; font-size: 2.2rem; }
`;

const html = `
  <!DOCTYPE html>
  <html>
  <head><style id="css"></style></head>
  <body>
    <h1>CSS Refactor Test</h1>
    <p>Visual regression testing example</p>
  </body>
  </html>
`;

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Original
    await page.setContent(html.replace('<style id="css"></style>', 
                                     `<style>${originalCSS}</style>`));
    await page.screenshot({ path: 'original.png' });
    
    // Refactored
    await page.setContent(html.replace('<style id="css"></style>', 
                                     `<style>${refactoredCSS}</style>`));
    await page.screenshot({ path: 'refactored.png' });
    
    // Compare
    const result = await compareImages('original.png', 'refactored.png', {
      threshold: 0.01,
      generateDiff: true,
      diffPath: 'diff.png'
    });
    
    console.log(`Difference: ${(result.difference * 100).toFixed(2)}%`);
    console.log(`Status: ${result.difference <= 0.01 ? 'PASS' : 'FAIL'}`);
    
  } finally {
    await browser.close();
  }
}

test().catch(console.error);
```

### 2.1 実際のWebサイトでCSSを変更する例

```typescript
import { chromium } from '@playwright/test';
import { compareImages } from '@mizchi/visual-checker/core';

async function testRealWebsite() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Original
    await page.goto('https://example.com');
    await page.screenshot({ path: 'before.png' });
    
    // Apply CSS changes
    await page.addStyleTag({
      content: `
        body { background: #f0f0f0 !important; }
        h1 { color: red !important; }
      `
    });
    await page.screenshot({ path: 'after.png' });
    
    // Compare
    const result = await compareImages('before.png', 'after.png', {
      threshold: 0.01
    });
    
    console.log(`Difference: ${(result.difference * 100).toFixed(2)}%`);
    
  } finally {
    await browser.close();
  }
}
```

### 3. CI/CD統合

```yaml
# .github/workflows/css-refactor-test.yml
name: CSS Refactoring Visual Test

on:
  pull_request:
    paths:
      - 'src/styles/**/*.css'
      - 'refactored/**/*.css'

jobs:
  visual-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Start proxy server
        run: |
          cd cloudflare-proxy
          npm start &
          sleep 5
          
      - name: Run CSS refactoring test
        run: npx ts-node tests/css-refactor-test.ts
        
      - name: Upload diff images
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: css-diff-images
          path: ./css-refactor-diffs/
```

### 4. 高度な使用例

#### レスポンシブデザインの検証

```typescript
// レスポンシブデザインを含めた検証
const viewports = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 }
];

for (const viewport of viewports) {
  await browser.setViewport(viewport);
  
  for (const page of config.urls) {
    const screenshotPath = await browser.captureScreenshot({
      url: `${config.baseUrl}${page.url}`,
      name: `${page.name}-${viewport.name}`
    });
    
    // 比較処理...
  }
}
```

#### 特定の要素のみ検証

```typescript
// 重要な要素のみを対象とした検証
const criticalElements = [
  { selector: 'header', name: 'header' },
  { selector: '.hero-section', name: 'hero' },
  { selector: '.product-grid', name: 'products' },
  { selector: 'footer', name: 'footer' }
];

for (const element of criticalElements) {
  const screenshotPath = await browser.captureScreenshot({
    url: config.baseUrl,
    name: element.name,
    screenshot: {
      selector: element.selector
    }
  });
  
  // 比較処理...
}
```

#### パフォーマンス測定を含めた検証

```typescript
// CSSの変更がパフォーマンスに与える影響も測定
import { measurePageMetrics } from '@mizchi/visual-checker/performance';

const performanceResults = {
  original: await measurePageMetrics(page, { css: 'original' }),
  refactored: await measurePageMetrics(page, { css: 'refactored' })
};

console.log('Performance impact:');
console.log(`  First Paint: ${performanceResults.refactored.firstPaint - performanceResults.original.firstPaint}ms`);
console.log(`  First Contentful Paint: ${performanceResults.refactored.fcp - performanceResults.original.fcp}ms`);
```

## ベストプラクティス

### 1. 段階的な検証

```typescript
// 段階的にしきい値を厳しくしていく
const thresholds = {
  initial: 0.05,    // 5% - 初期段階
  refined: 0.02,    // 2% - 調整後
  final: 0.001      // 0.1% - 最終段階
};
```

### 2. 除外パターンの設定

```typescript
// 動的なコンテンツを除外
const excludeSelectors = [
  '.timestamp',
  '.random-banner',
  '[data-testid="dynamic-content"]'
];

await browser.captureScreenshot({
  url: pageUrl,
  beforeScreenshot: {
    hide: excludeSelectors
  }
});
```

### 3. エラーレポートの生成

```typescript
// 詳細なHTMLレポートを生成
import { generateHTMLReport } from '@mizchi/visual-checker/reporting';

const report = await generateHTMLReport({
  results,
  title: 'CSS Refactoring Visual Regression Report',
  metadata: {
    originalCSS: './styles/application.css',
    refactoredCSS: './refactored/application.css',
    timestamp: new Date().toISOString()
  }
});

await fs.writeFile('./reports/css-refactor.html', report);
```

## トラブルシューティング

### よくある問題と解決方法

1. **フォントの読み込みタイミング**
   ```typescript
   // フォントの読み込みを待つ
   await browser.captureScreenshot({
     url: pageUrl,
     waitFor: {
       timeout: 5000,
       script: 'document.fonts.ready'
     }
   });
   ```

2. **アニメーションの影響**
   ```typescript
   // アニメーションを無効化
   await browser.captureScreenshot({
     url: pageUrl,
     beforeScreenshot: {
       script: `
         const style = document.createElement('style');
         style.textContent = '* { animation: none !important; transition: none !important; }';
         document.head.appendChild(style);
       `
     }
   });
   ```

3. **キャッシュの影響**
   ```typescript
   // キャッシュを無効化
   const browser = new BrowserController({
     launchOptions: {
       args: ['--disable-cache']
     }
   });
   ```

## まとめ

このユースケースを使用することで、CSSのリファクタリングが視覚的な変更を引き起こさないことを自動的に検証できます。CI/CDパイプラインに組み込むことで、安全にCSSの変更をデプロイできるようになります。