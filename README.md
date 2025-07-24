# Visual Checker

A visual regression testing framework for web applications. Capture and compare screenshots of web pages to detect visual changes.

指定されたURLリストに対してビジュアルリグレッションテストを実行するツールです。

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

## ライセンス

MIT