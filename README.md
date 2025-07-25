# Visual Checker

A visual regression testing framework for web applications with layout analysis capabilities. This tool reduces AI image processing costs by extracting and comparing structured layout data instead of raw images.

指定されたURLリストに対してビジュアルリグレッションテストを実行し、レイアウト構造を抽出・比較することで、AIの画像入力コストを削減するツールです。

## なぜ Visual Checker を使うのか

### AIコスト削減
- **画像入力は高価**: AIモデルへの画像入力は、テキストと比較して処理コストが高い
- **構造化データで代替**: レイアウトの意味的な構造をJSON形式で抽出し、画像の代わりに使用
- **効率的な差分検出**: ピクセル単位の比較ではなく、DOM要素の構造的な変化を検出

### レイアウト分析機能
- セマンティックグループの自動検出（navigation, section, container等）
- 要素の重要度スコアリング
- アクセシビリティ情報の保持
- レスポンシブデザインの変化追跡

## 特徴

- 🔍 複数URLの一括テスト
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

| オプション | 説明 | デフォルト |
|---|---|---|
| `name` | URL識別子（ファイル名に使用） | 必須 |
| `url` | テスト対象のURL | 必須 |
| `waitFor.timeout` | 待機時間（ミリ秒） | 30000 |
| `waitFor.selector` | 待機するセレクタ | - |
| `waitFor.networkIdle` | ネットワークアイドル待機 | false |
| `beforeScreenshot.script` | 実行するJavaScript | - |
| `beforeScreenshot.click` | クリックするセレクタ配列 | - |
| `beforeScreenshot.hide` | 非表示にするセレクタ配列 | - |
| `screenshot.fullPage` | フルページスクリーンショット | true |
| `screenshot.selector` | 特定要素のスクリーンショット | - |

### Playwright設定

| オプション | 説明 | デフォルト |
|---|---|---|
| `browser` | ブラウザタイプ | chromium |
| `headless` | ヘッドレスモード | true |
| `viewport` | ビューポートサイズ | - |
| `device` | デバイスプリセット | - |

### 比較設定

| オプション | 説明 | デフォルト |
|---|---|---|
| `threshold` | 許容する差分のしきい値（0-1） | 0.1 |
| `generateDiff` | 差分画像を生成するか | true |
| `diffDir` | 差分画像の保存先 | ./diffs |

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

## CI/CD統合

GitHub Actionsでの例:

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
import { extractLayoutScript, compareLayouts } from 'visual-checker';

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
import { assertLayoutsIdentical, assertLayoutsSimilar } from 'visual-checker';

// 完全一致を検証
assertLayoutsIdentical(baseline, current);

// 類似度で検証（95%以上）
assertLayoutsSimilar(baseline, current, 95);

// 特定の変更を禁止
assertNoLayoutChanges(baseline, current, ['removed', 'added']);
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

Visual Checkerは、Cloudflare Workerプロキシ経由でのアクセスもサポートしています。これにより、プロキシ環境下でも正しくレイアウト情報を抽出できることを検証できます。

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

1. Cloudflare Workerが任意のURLへのリクエストを転送
2. CORSヘッダーの自動追加
3. HTMLコンテンツの相対URL解決
4. レスポンスの透過的な転送

詳細は `cloudflare-proxy/README.md` を参照してください。

## AI分析によるエラー分類

Visual CheckerはAIを使用してレイアウトの変更を自動分析し、適切なアクションを実行できます。

### Gemini APIの設定

```bash
# .envファイルにAPIキーを設定
echo "GOOGLE_API_KEY=your-gemini-api-key" >> .env
```

### AI分析の使用例

```typescript
import { createGeminiWorkflowConfig, WorkflowEngine } from 'visual-checker';

// Geminiを使ったワークフロー設定
const workflowConfig = createGeminiWorkflowConfig(
  process.env.GOOGLE_API_KEY,
  'gemini-2.0-flash-exp' // 高速モデル
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

AIは以下の4つのタイプに変更を分類します：

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

Geminiの画像認識機能を使用してより精度の高い分析が可能です：

```typescript
// スクリーンショットを含む分析
const analysis = await aiProvider.analyzeLayoutChange(
  comparison,
  context,
  {
    baseline: 'path/to/baseline.png',
    current: 'path/to/current.png'
  }
);
```

## ライセンス

MIT