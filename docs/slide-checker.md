# Slide Checker - スライド検証機能

Visual Checkerのスライド検証機能は、プレゼンテーション用スライドやスライド作成ツールの出力が、固定サイズで適切に表示されることを自動検証します。

## 概要

スライドツールで作成されたコンテンツは通常、固定サイズ（例：1200x800px）で設計され、オーバーフローを含まないことが期待されます。この機能は以下を検証します：

- 固定ディメンションの検出
- オーバーフロー要素の検出
- レスポンシブ要素の警告
- スライドパターンの認識

## 基本的な使い方

### スライドの自動検出

```typescript
import { detectSlide } from '@mizchi/visc';

// ページのレイアウト分析を実行
const analysis = await analyzeLayout(page);

// スライドとして検出
const detection = detectSlide(analysis, {
  width: 1200,      // 期待される幅
  height: 800,      // 期待される高さ
  allowedOverflow: false  // オーバーフローを許可しない
});

// 結果の確認
if (detection.isSlide) {
  console.log(`スライドとして検出されました (信頼度: ${detection.confidence}%)`);
  console.log(`実際のサイズ: ${detection.dimensions.width}x${detection.dimensions.height}`);
  console.log(`アスペクト比: ${detection.dimensions.aspectRatio.toFixed(2)}`);
}
```

### 特定サイズでの検証

```typescript
import { validateSlide } from '@mizchi/visc';

// 1200x800のスライドとして検証
const violations = validateSlide(analysis, {
  width: 1200,
  height: 800,
  aspectRatio: 3/2,
  allowedOverflow: false,
  maxContentDepth: 5
});

// 違反の処理
violations.forEach(violation => {
  switch (violation.severity) {
    case 'error':
      console.error(`❌ ${violation.message}`);
      break;
    case 'warning':
      console.warn(`⚠️ ${violation.message}`);
      break;
    case 'info':
      console.log(`ℹ️ ${violation.message}`);
      break;
  }
});
```

## 検出結果の構造

### SlideDetectionResult

```typescript
interface SlideDetectionResult {
  isSlide: boolean;           // スライドとして判定されたか
  confidence: number;          // 信頼度スコア (0-100)
  dimensions: {                // 検出されたサイズ
    width: number;
    height: number;
    aspectRatio: number;
  };
  violations: SlideViolation[]; // 検出された問題
  metadata: {
    hasFixedDimensions: boolean;  // 固定サイズか
    hasOverflow: boolean;          // オーバーフローがあるか
    contentFitsWithinBounds: boolean; // コンテンツが境界内か
    followsSlidePatterns: boolean;    // スライドパターンに従うか
    slideType?: 'presentation' | 'document' | 'canvas' | 'hybrid';
  };
  recommendations: string[];    // 改善提案
}
```

### 違反の種類

```typescript
interface SlideViolation {
  type: 'overflow' | 'dimensions' | 'content-overflow' | 
        'aspect-ratio' | 'nested-scroll' | 'responsive-element';
  severity: 'error' | 'warning' | 'info';
  element?: VisualNode;  // 問題のある要素
  message: string;       // 説明メッセージ
  details?: any;         // 詳細情報
}
```

## 一般的なスライドサイズ

システムは以下の一般的なスライドサイズを認識します：

| サイズ | アスペクト比 | 用途 |
|--------|------------|------|
| 1920x1080 | 16:9 | Full HD プレゼンテーション |
| 1280x720 | 16:9 | HD プレゼンテーション |
| 1200x800 | 3:2 | カスタムスライド |
| 1024x768 | 4:3 | 標準プレゼンテーション |
| 800x600 | 4:3 | 小型プレゼンテーション |

## 検出される問題

### 1. オーバーフロー問題

```typescript
// 例：スクロール可能な要素の検出
{
  type: 'overflow',
  severity: 'error',
  message: 'Overflow detected: vertical scroll in div',
  details: {
    scrollType: 'vertical',
    scrollDimensions: {
      scrollHeight: 1200,
      clientHeight: 400
    }
  }
}
```

### 2. サイズ不一致

```typescript
// 例：期待されるサイズと異なる
{
  type: 'dimensions',
  severity: 'error',
  message: 'Width mismatch: expected 1200px, got 1180px',
  details: {
    expected: 1200,
    actual: 1180
  }
}
```

### 3. レスポンシブ要素

```typescript
// 例：ビューポート単位の使用
{
  type: 'responsive-element',
  severity: 'warning',
  message: 'Element uses viewport units which may cause inconsistency',
  details: {
    width: '80vw',
    height: '50vh'
  }
}
```

## 最適化の推奨事項

```typescript
import { getSlideOptimizationRecommendations } from '@mizchi/visc';

const recommendations = getSlideOptimizationRecommendations(detection);

recommendations.forEach(recommendation => {
  console.log(`💡 ${recommendation}`);
});

// 出力例：
// 💡 Use fixed pixel dimensions for consistent slide rendering
// 💡 Remove overflow to ensure all content is visible
// 💡 Replace percentage and viewport units with fixed pixel values
```

## CI/CDでの利用

### GitHub Actions

```yaml
name: Slide Validation

on: [push, pull_request]

jobs:
  validate-slides:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm install
        
      - name: Validate slides
        run: |
          npx visc check slides/*.html \
            --validate-slide \
            --slide-width 1200 \
            --slide-height 800 \
            --no-overflow
```

### プログラマティックな検証

```typescript
import { detectSlide, validateSlide } from '@mizchi/visc';
import puppeteer from 'puppeteer';

async function validateSlideFiles(files: string[]) {
  const browser = await puppeteer.launch();
  const results = [];
  
  for (const file of files) {
    const page = await browser.newPage();
    await page.goto(`file://${file}`);
    
    // ビューポートを設定
    await page.setViewport({ width: 1200, height: 800 });
    
    // レイアウト分析
    const analysis = await analyzeLayout(page);
    
    // スライド検証
    const detection = detectSlide(analysis, {
      width: 1200,
      height: 800,
      allowedOverflow: false
    });
    
    if (!detection.isSlide || detection.confidence < 80) {
      console.error(`❌ ${file} is not a valid slide`);
      detection.violations.forEach(v => {
        console.error(`  ${v.severity}: ${v.message}`);
      });
    } else {
      console.log(`✅ ${file} is a valid slide (${detection.confidence}% confidence)`);
    }
    
    results.push({ file, detection });
    await page.close();
  }
  
  await browser.close();
  return results;
}
```

## ベストプラクティス

### 良いスライドの例

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .slide {
      width: 1200px;    /* 固定幅 */
      height: 800px;    /* 固定高さ */
      overflow: hidden; /* オーバーフローなし */
      position: relative;
    }
    
    .content {
      position: absolute;
      top: 100px;
      left: 80px;
      right: 80px;
      bottom: 100px;
    }
    
    /* 固定サイズの要素 */
    .title {
      font-size: 48px;  /* px単位 */
      margin-bottom: 30px;
    }
  </style>
</head>
<body>
  <div class="slide">
    <div class="content">
      <h1 class="title">スライドタイトル</h1>
      <p>コンテンツはすべて境界内に収まっています</p>
    </div>
  </div>
</body>
</html>
```

### 避けるべきパターン

```html
<!-- ❌ 悪い例 -->
<style>
  .slide {
    width: 100vw;      /* ビューポート単位 */
    height: 100vh;     /* ビューポート単位 */
    overflow: auto;    /* スクロール可能 */
  }
  
  .content {
    width: 80%;        /* パーセンテージ */
    min-height: 1000px; /* 固定高さを超える */
  }
  
  .responsive-text {
    font-size: 3vw;    /* ビューポート単位 */
  }
</style>
```

## トラブルシューティング

### Q: スライドが検出されない

A: 以下を確認してください：
- コンテナが固定サイズ（px単位）で定義されているか
- overflow: hidden が設定されているか
- コンテンツが境界内に収まっているか

### Q: 信頼度スコアが低い

A: 信頼度は以下の要因で計算されます：
- 固定ディメンション（30ポイント）
- オーバーフローなし（25ポイント）
- コンテンツが境界内（20ポイント）
- スライドパターン（15ポイント）
- 標準サイズとの一致（10ポイント）

### Q: レスポンシブ要素の警告が出る

A: 以下を修正してください：
- `vw`, `vh` などのビューポート単位を `px` に変更
- パーセンテージ幅/高さを固定値に変更
- `min-width`, `max-width` を適切に設定

## APIリファレンス

### detectSlide(analysis, config?)

スライドを自動検出します。

**パラメータ:**
- `analysis`: VisualTreeAnalysis - レイアウト分析結果
- `config`: SlideConfiguration（オプション）
  - `width`: number - 期待される幅
  - `height`: number - 期待される高さ
  - `aspectRatio`: number - アスペクト比
  - `allowedOverflow`: boolean - オーバーフローを許可
  - `maxContentDepth`: number - 最大コンテンツ深度

**戻り値:** SlideDetectionResult

### validateSlide(analysis, config)

特定の設定でスライドを検証します。

**パラメータ:**
- `analysis`: VisualTreeAnalysis - レイアウト分析結果
- `config`: SlideConfiguration - 検証設定

**戻り値:** SlideViolation[]

### getSlideValidationRules(strict?)

標準的な検証ルールを取得します。

**パラメータ:**
- `strict`: boolean - 厳格モード（デフォルト: true）

**戻り値:** SlideConfiguration

### getSlideOptimizationRecommendations(result)

最適化の推奨事項を生成します。

**パラメータ:**
- `result`: SlideDetectionResult - 検出結果

**戻り値:** string[]

## まとめ

スライド検証機能は、プレゼンテーションコンテンツが意図した通りに表示されることを保証します。固定サイズ、オーバーフローなし、レスポンシブ要素なしという原則に従うことで、どの環境でも一貫した表示を実現できます。