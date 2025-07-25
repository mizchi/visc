# Visual Checker Examples

このディレクトリには、Visual Checkerの使用例が含まれています。

## ディレクトリ構造

### configs/
Visual Checkerの設定ファイルのサンプルです。TypeScript形式（`.ts`）とJSON形式（`.json`）の両方が利用可能です。

TypeScript形式（推奨）:
- `basic.config.ts` - 基本的な設定例
- `advanced.config.ts` - 高度な設定例（複数URLのテスト）
- `mobile.config.ts` - モバイルデバイスのエミュレーション設定例

JSON形式（レガシー）:
- `basic.config.json` - 基本的な設定例
- `advanced.config.json` - 高度な設定例（複数URLのテスト）
- `mobile.config.json` - モバイルデバイスのエミュレーション設定例

### layout/
レイアウト分析機能の使用例です。

- `extract-layout-refactored.ts` - レイアウト抽出の統合サンプル
  - シンプルなレイアウト抽出
  - セマンティックレイアウト抽出
  - 可視化機能
- `layout-stability-check.ts` - レイアウトの安定性チェックツール

### fixtures/
テスト用のHTMLファイルです。

- `test-page.html` - レイアウト抽出のテスト用ページ
- `layout-viewer.html` - レイアウト分析結果を視覚的に確認するビューア

## 使用方法

### レイアウト抽出

```bash
# シンプルなレイアウト抽出
npm run extract simple https://example.com

# セマンティックレイアウト抽出
npm run extract semantic https://example.com

# 可視化（画像出力）
npm run extract visualize https://example.com output.png
```

### レイアウト安定性チェック

```bash
# 単一URLのチェック
npm run stability-check https://example.com

# 複数URLのバッチチェック
npm run stability-check https://example.com https://google.com
```

### ビューアの起動

```bash
# レイアウトビューアをブラウザで開く
npm run viewer
```

## 設定ファイルの使用

### TypeScript形式の設定ファイル（推奨）

TypeScript形式を使用することで、型安全性と自動補完の恩恵を受けられます。

```bash
# 基本的な使用法
visual-checker test -c examples/configs/basic.config.ts

# モバイルテスト
visual-checker test -c examples/configs/mobile.config.ts

# プロジェクトルートのデフォルト設定
visual-checker test  # visual-check.config.ts を使用
```

### 設定ファイルの作成例

```typescript
import type { VisualCheckConfig } from 'visual-checker';

const config: VisualCheckConfig = {
  baseUrl: "http://localhost:3000",
  snapshotDir: "./snapshots",
  playwright: {
    browser: "chromium",
    headless: true,
    viewport: {
      width: 1280,
      height: 720
    }
  },
  urls: [
    {
      name: "home",
      url: "/",
      waitFor: {
        networkIdle: true
      }
    }
  ]
};

export default config;
```

### JSON形式の設定ファイル（レガシー）

```bash
# 基本的な使用法
visual-checker test -c examples/configs/basic.config.json

# モバイルテスト
visual-checker test -c examples/configs/mobile.config.json
```