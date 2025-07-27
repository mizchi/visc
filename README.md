WIP: not published yet

---

# Visual Checker

A visual regression testing framework for web applications with layout analysis capabilities. This tool reduces AI image processing costs by extracting and comparing structured layout data instead of raw images.

指定された URL リストに対してビジュアルリグレッションテストを実行し、レイアウト構造を抽出・比較することで、AI の画像入力コストを削減するツールです。

## なぜ Visual Checker を使うのか

### AI コスト削減

- **画像入力は高価**: AI モデルへの画像入力は、テキストと比較して処理コストが高い
- **構造化データで代替**: レイアウトの意味的な構造を JSON 形式で抽出し、画像の代わりに使用
- **効率的な差分検出**: ピクセル単位の比較ではなく、DOM 要素の構造的な変化を検出

### レイアウト分析機能

- セマンティックグループの自動検出（navigation, section, container 等）
- 要素の重要度スコアリング
- アクセシビリティ情報の保持
- レスポンシブデザインの変化追跡

## 特徴

- 🔍 複数 URL の一括テスト
- 📸 スナップショットの自動比較
- 🎨 差分画像の生成
- 📱 デバイスエミュレーション対応
- ⚙️ 柔軟な設定オプション
- 🚀 Playwright ベースの高速実行

## インストール

### npm (グローバル)

```bash
npm install -g visual-checker
```

### npm (ローカル)

```bash
npm install --save-dev visual-checker
```

### ソースからビルド

```bash
git clone https://github.com/mizchi/visual-checker.git
cd visual-checker
npm install
npm run build
```

## 使い方

### 1. 初期化

プロジェクトディレクトリで初期化:

```bash
visual-checker init
```

### 2. 設定ファイルの編集

`configs/visual-check.config.json`を編集:

```json
{
  "baseUrl": "http://localhost:3000",
  "snapshotDir": "./snapshots",
  "playwright": {
    "browser": "chromium",
    "headless": true,
    "viewport": {
      "width": 1280,
      "height": 720
    }
  },
  "comparison": {
    "threshold": 0.1,
    "generateDiff": true,
    "diffDir": "./diffs"
  },
  "urls": [
    {
      "name": "home",
      "url": "/",
      "waitFor": {
        "networkIdle": true
      }
    },
    {
      "name": "products-detail",
      "url": "/products/548215",
      "waitFor": {
        "selector": ".product-show-inner",
        "networkIdle": true
      }
    }
  ]
}
```

### 3. ベースラインの作成

初回実行時やベースラインを更新する場合:

```bash
visual-checker update -c configs/visual-check.config.json
```

### 4. テストの実行

```bash
visual-checker test -c configs/visual-check.config.json
```

### 5. 画像の直接比較

```bash
visual-checker compare baseline.png current.png -t 0.1 -o diff.png
```

## 設定オプション

### URLConfig

| オプション                | 説明                           | デフォルト |
| ------------------------- | ------------------------------ | ---------- |
| `name`                    | URL 識別子（ファイル名に使用） | 必須       |
| `url`                     | テスト対象の URL               | 必須       |
| `waitFor.timeout`         | 待機時間（ミリ秒）             | 30000      |
| `waitFor.selector`        | 待機するセレクタ               | -          |
| `waitFor.networkIdle`     | ネットワークアイドル待機       | false      |
| `beforeScreenshot.script` | 実行する JavaScript            | -          |
| `beforeScreenshot.click`  | クリックするセレクタ配列       | -          |
| `beforeScreenshot.hide`   | 非表示にするセレクタ配列       | -          |
| `screenshot.fullPage`     | フルページスクリーンショット   | true       |
| `screenshot.selector`     | 特定要素のスクリーンショット   | -          |

### Playwright 設定

| オプション | 説明               | デフォルト |
| ---------- | ------------------ | ---------- |
| `browser`  | ブラウザタイプ     | chromium   |
| `headless` | ヘッドレスモード   | true       |
| `viewport` | ビューポートサイズ | -          |
| `device`   | デバイスプリセット | -          |

### 比較設定

| オプション     | 説明                          | デフォルト |
| -------------- | ----------------------------- | ---------- |
| `threshold`    | 許容する差分のしきい値（0-1） | 0.1        |
| `generateDiff` | 差分画像を生成するか          | true       |
| `diffDir`      | 差分画像の保存先              | ./diffs    |

## 高度な使い方

### モバイルデバイスでのテスト

```json
{
  "playwright": {
    "device": "iPhone 12"
  }
}
```

### 特定要素のスクリーンショット

```json
{
  "urls": [
    {
      "name": "header-only",
      "url": "/",
      "screenshot": {
        "selector": "header"
      }
    }
  ]
}
```

### 動的コンテンツの非表示

```json
{
  "urls": [
    {
      "name": "static-content",
      "url": "/",
      "beforeScreenshot": {
        "hide": [".ads", ".dynamic-banner"]
      }
    }
  ]
}
```

## CI/CD 統合

GitHub Actions での例:

```yaml
- name: Run Visual Tests
  run: |
    npm install
    npm run build
    node .mizchi/visual-checker/dist/cli.js test
```

## トラブルシューティング

### ブラウザが起動しない

```bash
# Playwrightの依存関係をインストール
npx playwright install-deps
```

### 差分が検出される

- `threshold`値を調整
- 動的コンテンツを`hide`で非表示に
- `waitFor`設定で読み込み完了を確実に待機

## レイアウト分析機能

### 基本的な使用方法

```typescript
import { extractLayoutScript, compareLayouts } from "visual-checker";

// レイアウトの抽出
const baseline = await page.evaluate(extractLayoutScript);
const current = await page.evaluate(extractLayoutScript);

// レイアウトの比較
const comparison = compareLayouts(baseline, current);
console.log(`Similarity: ${comparison.similarity}%`);
console.log(`Changes: ${comparison.differences.length}`);
```

### フレームワーク非依存のアサーション

```typescript
import { assertLayoutsIdentical, assertLayoutsSimilar } from "visual-checker";

// 完全一致を検証
assertLayoutsIdentical(baseline, current);

// 類似度で検証（95%以上）
assertLayoutsSimilar(baseline, current, 95);

// 特定の変更を禁止
assertNoLayoutChanges(baseline, current, ["removed", "added"]);
```

### レイアウトの安定性チェック

```bash
# 同じURLから複数回レイアウトを取得して一貫性を確認
npm run stability-check https://example.com

# 複数URLをバッチチェック
npm run stability-check https://example.com https://google.com
```

### データ形式

レイアウトデータは以下の情報を含みます：

```typescript
interface LayoutAnalysisResult {
  url: string;
  timestamp: string;
  viewport: { width: number; height: number };
  semanticGroups: SemanticGroup[];
  totalElements: number;
  statistics: {
    groupCount: number;
    patternCount: number;
    interactiveElements: number;
    accessibilityCount: number;
  };
}
```

## プロキシ経由でのテスト

Visual Checker は、Cloudflare Worker プロキシ経由でのアクセスもサポートしています。これにより、プロキシ環境下でも正しくレイアウト情報を抽出できることを検証できます。

### プロキシのセットアップ

```bash
# プロキシの依存関係をインストール
npm run proxy:setup

# ローカルでプロキシを起動（別ターミナル）
npm run proxy:dev
```

### プロキシ経由でのテスト実行

```bash
# ローカルプロキシを使用
PROXY_ENDPOINT=http://localhost:8787 npm run test:proxy

# デプロイされたプロキシを使用
PROXY_ENDPOINT=https://your-worker.workers.dev npm run test:proxy
```

### プロキシの仕組み

1. Cloudflare Worker が任意の URL へのリクエストを転送
2. CORS ヘッダーの自動追加
3. HTML コンテンツの相対 URL 解決
4. レスポンスの透過的な転送

詳細は `cloudflare-proxy/README.md` を参照してください。

## レスポンシブマトリクステスト

異なるビューポート幅でのレスポンシブデザインの一貫性を検証し、メディアクエリの適用状況を追跡します。この機能により、複数のデバイスサイズでCSSが正しく適用されているかを自動的に検証できます。

### 基本的な使い方

```bash
# レスポンシブマトリクステストの実行
visual-checker matrix -c configs/responsive-matrix.config.json

# HTMLレポートを生成
visual-checker matrix -c configs/responsive-matrix.config.json --report-html reports/matrix.html

# 特定のURLのみテスト
visual-checker matrix -c configs/responsive-matrix.config.json -u home

# カスタムビューポートサイズでテスト
visual-checker matrix -c configs/responsive-matrix.config.json --viewport "320x568,768x1024,1920x1080"
```

### 設定例

```json
{
  "responsiveMatrix": {
    "enabled": true,
    "viewports": [
      {
        "name": "mobile",
        "width": 375,
        "height": 667,
        "deviceScaleFactor": 2
      },
      {
        "name": "tablet",
        "width": 768,
        "height": 1024
      },
      {
        "name": "desktop",
        "width": 1920,
        "height": 1080
      }
    ],
    "breakpoints": [
      {
        "name": "mobile",
        "maxWidth": 767
      },
      {
        "name": "tablet", 
        "minWidth": 768,
        "maxWidth": 1023
      },
      {
        "name": "desktop",
        "minWidth": 1024
      }
    ],
    "cssSimilarityThreshold": 0.85
  }
}
```

### 検証内容

1. **メディアクエリの一貫性**
   - 各ビューポートで適用されるメディアクエリを追跡
   - 期待されるブレークポイントでの適用を検証
   - 不整合を検出してレポート

2. **レイアウト構造の比較**
   - 異なるビューポート間でのレイアウト変化を分析
   - CSS計算値のフィンガープリントを生成
   - 予期しないレイアウト崩壊を検出

3. **レポート生成**
   - HTML形式：視覚的なレポート（スクリーンショット付き）
   - JSON形式：プログラムでの処理用
   - Markdown形式：ドキュメント統合用

### プログラムでの使用

```typescript
import { ResponsiveMatrixTester, ResponsiveMatrixReportGenerator } from "visual-checker";

// テスターの初期化
const tester = new ResponsiveMatrixTester(browserController, config);

// URLのテスト実行
const result = await tester.testUrl({
  name: "home",
  url: "https://example.com"
});

// レポート生成
const reporter = new ResponsiveMatrixReportGenerator();
await reporter.generateHTMLReport([result], "report.html");

// 結果の確認
console.log(`成功: ${result.passed}`);
console.log(`メディアクエリ問題: ${result.summary.mediaQueryIssues}`);
console.log(`レイアウト不整合: ${result.summary.layoutInconsistencies}`);
```

### 仕様詳細

#### 1. ビューポート設定

各ビューポートで以下の設定が可能：

```typescript
interface ViewportSize {
  name: string;                    // ビューポート名（例: "mobile", "tablet"）
  width: number;                   // 幅（ピクセル）
  height: number;                  // 高さ（ピクセル）
  deviceScaleFactor?: number;      // デバイスピクセル比（オプション）
  userAgent?: string;              // ユーザーエージェント（オプション）
}
```

#### 2. メディアクエリ検証

各ビューポートで以下の処理を実行：

1. **メディアクエリの抽出**
   - ページ内のすべてのスタイルシートから`@media`ルールを検出
   - `window.matchMedia()`を使用して現在のビューポートでの適用状態を確認

2. **一貫性チェック**
   - 設定されたブレークポイントと実際の適用状況を比較
   - 期待されるビューポートで適用されていない場合は不整合として記録

3. **検証ルール**
   - `min-width`と`max-width`の値からビューポートの適用範囲を計算
   - ギャップ（例: max-width: 767px と min-width: 769px）を検出

#### 3. CSS フィンガープリント

重要な要素のスタイルをハッシュ化して比較：

```javascript
// 収集対象のCSSプロパティ
const relevantProps = [
  'display', 'position', 'width', 'height', 
  'margin', 'padding', 'flexDirection', 
  'gridTemplateColumns', 'float', 'clear'
];

// 対象セレクタ
const importantSelectors = [
  'body', 'header', 'nav', 'main', 'article', 
  'section', 'aside', 'footer', '.container', '.wrapper'
];
```

#### 4. レイアウト構造比較

各ビューポート間でレイアウト構造を比較：

- セマンティックグループの検出と比較
- 要素の位置・サイズの変化を追跡
- 類似度スコアの計算（デフォルト閾値: 0.85）

#### 5. レポート内容

生成されるレポートには以下の情報が含まれます：

**HTMLレポート**
- 各ビューポートのスクリーンショット
- 適用されたメディアクエリのリスト
- CSSフィンガープリント
- メディアクエリの不整合詳細
- レイアウト変更の概要

**JSONレポート**
```json
{
  "timestamp": "2025-01-27T12:00:00Z",
  "summary": {
    "totalUrls": 1,
    "passedUrls": 0,
    "totalViewports": 5,
    "totalIssues": 2
  },
  "results": [{
    "url": { "name": "home", "url": "/" },
    "viewportResults": [...],
    "mediaQueryConsistency": [...],
    "passed": false
  }]
}
```

**Markdownレポート**
- 表形式でのビューポート結果
- メディアクエリ問題の詳細リスト
- 推奨される修正方法

### ベストプラクティス

1. **ブレークポイントの設計**
   - モバイルファースト: `min-width`を基本に設計
   - ギャップを避ける: 連続したブレークポイントを設定
   - 一般的なデバイスサイズを考慮

2. **テスト戦略**
   - 主要なブレークポイントの境界値でテスト
   - 実際のデバイスサイズを含める
   - CIでの定期実行

3. **問題の修正**
   - メディアクエリの重複を避ける
   - フォールバックスタイルの設定
   - プログレッシブエンハンスメント

### トラブルシューティング

**メディアクエリが検出されない場合**
- クロスオリジンのスタイルシートはアクセスできない可能性
- インラインスタイルの`@media`ルールも確認

## 本文除外レイアウト比較

記事ページやブログ投稿など、本文コンテンツが頻繁に変更されるページでは、レイアウトの変更と本文の変更を区別することが重要です。本文除外機能を使用することで、ナビゲーション、ヘッダー、フッター、サイドバーなどのレイアウト要素のみを比較できます。

### 基本的な使い方

```bash
# 本文を除外してレイアウトを比較
visual-checker compare https://example.com/article1 https://example.com/article2 --exclude-content

# 除外方法を指定（hide: 非表示にする, remove: 削除する）
visual-checker compare https://example.com/article1 https://example.com/article2 --exclude-content --exclude-method hide
```

### プログラム的な使用

```typescript
import { compareLayoutsWithContentExclusion } from "visual-checker";

// 本文を除外してレイアウトを比較
const result = await compareLayoutsWithContentExclusion(page1, page2, {
  excludeContent: true,
  excludeMethod: 'hide', // 'hide' または 'remove'
  readabilityOptions: {
    // Readabilityのオプション（オプション）
    charThreshold: 500
  }
});

// 結果の確認
if (result.contentExtraction?.baseline.success) {
  console.log(`Baseline article: ${result.contentExtraction.baseline.title}`);
  console.log(`Text length: ${result.contentExtraction.baseline.textLength}`);
}

// 本文除外後のレイアウト比較結果
if (result.excludedContentComparison) {
  console.log(`Layout similarity: ${result.excludedContentComparison.similarity}%`);
  console.log(`Layout changes: ${result.excludedContentComparison.differences.length}`);
}
```

### 動作原理

1. **本文抽出**: [@mizchi/readability](https://github.com/mizchi/readability)を使用して、ページから本文コンテンツを自動的に抽出
2. **要素の特定**: 抽出された本文に対応するDOM要素を特定
3. **除外処理**: 
   - `hide`: 要素を非表示にする（レイアウトは保持）
   - `remove`: 要素を完全に削除（レイアウトが変わる可能性）
4. **レイアウト比較**: 本文除外後のレイアウトを比較

### 使用例

#### ニュースサイトの更新監視

```typescript
const config = {
  urls: [
    { name: "news", url: "https://news.example.com/latest" }
  ],
  comparison: {
    excludeContent: true,
    excludeMethod: 'hide'
  }
};

// 本文が更新されてもレイアウトが変わらなければ通知しない
const runner = new TestRunner(config);
const results = await runner.runTests();
```

#### ブログテンプレートの検証

```typescript
// 異なる記事で同じレイアウトが使用されているか確認
const posts = [
  "https://blog.example.com/post1",
  "https://blog.example.com/post2",
  "https://blog.example.com/post3"
];

for (let i = 1; i < posts.length; i++) {
  const result = await compareLayoutsWithContentExclusion(
    await browser.newPage(posts[0]),
    await browser.newPage(posts[i]),
    { excludeContent: true }
  );
  
  if (result.excludedContentComparison?.similarity < 95) {
    console.warn(`Layout inconsistency detected between post 1 and post ${i + 1}`);
  }
}
```

### 注意事項

- 本文抽出の精度はページの構造に依存します
- 動的に生成されるコンテンツは正しく抽出されない場合があります
- SPAやJavaScriptで後から挿入されるコンテンツには対応していません
- JavaScriptで動的に追加されるスタイルに注意

**レイアウト不整合が多い場合**
- `cssSimilarityThreshold`を調整（0.7〜0.9）
- 動的コンテンツを`beforeScreenshot.hide`で除外
- アニメーション完了を待つ設定を追加

**パフォーマンスの問題**
- ビューポート数を必要最小限に
- `screenshot.fullPage: false`で部分的なキャプチャ
- 並列実行の検討

## プロキシオーバーライド機能

Visual Checkerでは、プロキシ経由でのアクセス時に特定のリクエスト・レスポンスを書き換えることができます。これにより、認証が必要なAPIのテストやモックレスポンスの返却、トラッキングスクリプトのブロックなどが可能になります。

### 基本的な使い方

```json
{
  "proxy": {
    "enabled": true,
    "url": "http://localhost:8787",
    "overrides": [
      {
        "match": {
          "url": "/api/",
          "method": ["GET", "POST"]
        },
        "request": {
          "headers": {
            "Authorization": "Bearer test-token-12345"
          }
        }
      }
    ]
  }
}
```

### オーバーライド設定

#### マッチング条件

リクエストをマッチングするための条件を指定します：

```typescript
interface ProxyOverride {
  match: {
    url?: string | RegExp;              // URLパターン（文字列または正規表現）
    method?: string | string[];         // HTTPメソッド
    headers?: Record<string, string | RegExp>;  // ヘッダー条件
  };
  priority?: number;  // 優先度（高い値が優先）
  enabled?: boolean | (() => boolean);  // 有効/無効の切り替え
}
```

#### リクエストの書き換え

```typescript
{
  request?: {
    url?: string | ((originalUrl: string) => string);
    headers?: Record<string, string | ((originalValue?: string) => string)>;
    body?: string | Buffer | ((originalBody: string | Buffer) => string | Buffer);
  }
}
```

#### レスポンスの書き換え

```typescript
{
  response?: {
    // 部分的な書き換え
    status?: number;
    headers?: Record<string, string | ((originalValue?: string) => string)>;
    body?: string | Buffer | ((originalBody: string | Buffer) => string | Buffer);
    
    // 完全な置き換え
    replace?: {
      status: number;
      headers: Record<string, string>;
      body: string | Buffer;
    };
  }
}
```

### 実用例

#### 1. 認証ヘッダーの追加

```json
{
  "match": {
    "url": "/api/",
    "method": ["GET", "POST", "PUT", "DELETE"]
  },
  "request": {
    "headers": {
      "Authorization": "Bearer production-api-key"
    }
  }
}
```

#### 2. トラッキングスクリプトのブロック

```json
{
  "match": {
    "url": "/(google-analytics|facebook|tracking)/"
  },
  "response": {
    "replace": {
      "status": 204,
      "headers": {},
      "body": ""
    }
  },
  "priority": 10
}
```

#### 3. APIレスポンスのモック

```json
{
  "match": {
    "url": "/api/users",
    "method": "GET"
  },
  "response": {
    "replace": {
      "status": 200,
      "headers": {
        "Content-Type": "application/json"
      },
      "body": "[{\"id\":1,\"name\":\"Test User\",\"email\":\"test@example.com\"}]"
    }
  }
}
```

#### 4. キャッシュヘッダーの追加

```json
{
  "match": {
    "url": "\\.(css|js)$"
  },
  "response": {
    "headers": {
      "Cache-Control": "public, max-age=31536000"
    }
  }
}
```

#### 5. 動的な書き換え（プログラム使用時）

```typescript
import { ProxyOverrideHandler, commonOverrides } from "visual-checker";

// 共通のオーバーライドプリセット
const overrides = [
  // 認証ヘッダーの追加
  commonOverrides.addAuthHeader('your-api-token'),
  
  // トラッキングをブロック
  commonOverrides.blockTracking(),
  
  // キャッシュを無効化
  commonOverrides.disableCache(),
  
  // Cookieを削除
  commonOverrides.removeCookie('session'),
  
  // APIエンドポイントをモック
  commonOverrides.mockApiEndpoint('/api/data', { items: [] }),
  
  // カスタムオーバーライド
  {
    match: { url: /\.json$/ },
    request: {
      headers: {
        'X-Request-Time': () => new Date().toISOString()
      }
    }
  }
];

const config = {
  proxy: {
    enabled: true,
    url: "http://localhost:8787",
    overrides
  }
};
```

### 優先度について

複数のオーバーライドがマッチする場合、`priority`値が高いものが選択されます：

```json
[
  {
    "match": { "url": "/api/" },
    "priority": 1,
    "response": { "status": 200 }
  },
  {
    "match": { "url": "/api/admin" },
    "priority": 10,  // こちらが優先される
    "response": { "status": 403 }
  }
]
```

### トラブルシューティング

**オーバーライドが適用されない場合**
- URLパターンが正しいか確認（正規表現の場合は文字列として渡す）
- プロキシが有効になっているか確認（`proxy.enabled: true`）
- 優先度の設定を確認

**ヘッダーが上書きされない場合**
- ブラウザが自動的に設定するヘッダーは上書きできない場合があります
- `request.headers`は既存のヘッダーとマージされます

## AI 分析によるエラー分類

Visual Checker は AI を使用してレイアウトの変更を自動分析し、適切なアクションを実行できます。

### Gemini API の設定

```bash
# .envファイルにAPIキーを設定
echo "GOOGLE_API_KEY=your-gemini-api-key" >> .env
```

### AI 分析の使用例

```typescript
import { createGeminiWorkflowConfig, WorkflowEngine } from "visual-checker";

// Geminiを使ったワークフロー設定
const workflowConfig = createGeminiWorkflowConfig(
  process.env.GOOGLE_API_KEY,
  "gemini-2.0-flash-exp" // 高速モデル
);

// ワークフローエンジンの作成
const engine = new WorkflowEngine(testConfig, workflowConfig);

// テストの実行とAI分析
const result = await engine.execute(urlConfig);

// 分析結果の確認
console.log(`エラータイプ: ${result.errorAnalysis.errorType}`);
console.log(`推奨アクション: ${result.errorAnalysis.suggestedAction}`);
console.log(`判断理由: ${result.errorAnalysis.reasoning}`);
```

### エラータイプ

AI は以下の 4 つのタイプに変更を分類します：

1. **BROKEN**: 明確に壊れているエラー（要素の消失、レイアウト崩壊）
2. **MEANINGFUL_CHANGE**: 意味のある変更（デザイン更新、機能追加）
3. **STOCHASTIC**: 確率的な出力（広告、動的コンテンツ）
4. **UNKNOWN**: 分類が困難

### 自動アクション

エラータイプに応じて以下のアクションが実行されます：

- **CONTINUE**: テストを続行
- **UPDATE_BASELINE**: ベースラインを更新
- **IGNORE_ELEMENT**: 特定要素を無視リストに追加
- **RETRY**: リトライ（確率的エラーの場合は追加回数）
- **MANUAL_REVIEW**: 手動確認が必要
- **STOP**: テストを停止

### スクリーンショット分析

Gemini の画像認識機能を使用してより精度の高い分析が可能です：

```typescript
// スクリーンショットを含む分析
const analysis = await aiProvider.analyzeLayoutChange(comparison, context, {
  baseline: "path/to/baseline.png",
  current: "path/to/current.png",
});
```

## ライセンス

MIT
