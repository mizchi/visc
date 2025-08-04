# Visual Checker v2 CLI Usage

Visual Checker v2は、アダプティブキャリブレーション機能を備えたビジュアルリグレッションテスティングツールです。

## インストール

```bash
npm install -g @mizchi/visual-checker
```

## コマンド一覧

### 1. `calibrate` - 比較設定の自動生成

複数のサンプルを収集して、最適な比較設定を自動生成します。

```bash
visual-checker-v2 calibrate <url> [options]
```

**オプション:**
- `-n, --samples <number>` - 収集するサンプル数（デフォルト: 5）
- `-d, --delay <ms>` - サンプル間の遅延時間（デフォルト: 1000ms）
- `-o, --output <path>` - 設定ファイルの出力パス（デフォルト: ./visual-checker-settings.json）
- `--viewport <size>` - ビューポートサイズ（デフォルト: 1280x800）
- `--strictness <level>` - 厳密さレベル: low, medium, high（デフォルト: medium）
- `--headless` - ヘッドレスモードで実行（デフォルト: true）

**例:**
```bash
# 基本的な使用
visual-checker-v2 calibrate https://example.com

# 詳細な設定
visual-checker-v2 calibrate https://example.com \
  --samples 10 \
  --delay 2000 \
  --viewport 1920x1080 \
  --strictness high \
  --output ./my-settings.json
```

### 2. `validate` - キャリブレーション済み設定での検証

生成された設定を使用して、URLがベースラインと一致するか検証します。

```bash
visual-checker-v2 validate <url> [options]
```

**オプション:**
- `-s, --settings <path>` - 設定ファイルのパス（デフォルト: ./visual-checker-settings.json）
- `-b, --baseline <path>` - ベースラインレイアウトファイルのパス（オプション）
- `-o, --output <dir>` - 結果の出力ディレクトリ（デフォルト: ./visual-checker-output）
- `--viewport <size>` - ビューポートサイズ（設定を上書き）
- `--save-svg` - SVG可視化を保存

**例:**
```bash
# 初回実行（ベースラインを作成）
visual-checker-v2 validate https://example.com

# ベースラインとの比較
visual-checker-v2 validate https://example.com \
  --baseline ./visual-checker-output/baseline.json \
  --save-svg

# カスタム設定での検証
visual-checker-v2 validate https://example.com \
  --settings ./my-settings.json \
  --baseline ./my-baseline.json
```

### 3. `compare` - 2つのURLまたはファイルを比較

2つのURLまたはレイアウトファイルを直接比較します。

```bash
visual-checker-v2 compare <source1> <source2> [options]
```

**オプション:**
- `-o, --output <dir>` - 出力ディレクトリ（デフォルト: ./visual-checker-output）
- `--viewport <size>` - URLのビューポートサイズ（デフォルト: 1280x800）
- `--threshold <number>` - 類似度の閾値 0-100（デフォルト: 90）

**例:**
```bash
# 2つのURLを比較
visual-checker-v2 compare https://example.com https://staging.example.com

# URLとファイルを比較
visual-checker-v2 compare https://example.com ./baseline.json

# 2つのファイルを比較
visual-checker-v2 compare ./layout1.json ./layout2.json

# カスタム閾値での比較
visual-checker-v2 compare https://old.example.com https://new.example.com \
  --threshold 95 \
  --viewport 1920x1080
```

### 4. `extract` - レイアウトデータを抽出

URLからレイアウトデータを抽出してファイルに保存します。

```bash
visual-checker-v2 extract <url> [options]
```

**オプション:**
- `-o, --output <path>` - 出力ファイルパス（デフォルト: ./layout.json）
- `--viewport <size>` - ビューポートサイズ（デフォルト: 1280x800）
- `--svg` - SVGファイルも保存

**例:**
```bash
# 基本的な抽出
visual-checker-v2 extract https://example.com

# SVGも含めて保存
visual-checker-v2 extract https://example.com \
  --output ./my-layout.json \
  --svg \
  --viewport 1920x1080
```

## ワークフロー例

### 1. 新しいプロジェクトのセットアップ

```bash
# Step 1: 比較設定を生成
visual-checker-v2 calibrate https://myapp.com --samples 10

# Step 2: ベースラインを作成
visual-checker-v2 validate https://myapp.com

# Step 3: CI/CDで検証を実行
visual-checker-v2 validate https://myapp.com \
  --baseline ./visual-checker-output/baseline.json
```

### 2. デプロイ前の検証

```bash
# プロダクションとステージングを比較
visual-checker-v2 compare https://myapp.com https://staging.myapp.com \
  --threshold 95 \
  --output ./deploy-check
```

### 3. レスポンシブデザインのテスト

```bash
# モバイルサイズでキャリブレーション
visual-checker-v2 calibrate https://myapp.com \
  --viewport 375x667 \
  --output ./mobile-settings.json

# タブレットサイズでキャリブレーション  
visual-checker-v2 calibrate https://myapp.com \
  --viewport 768x1024 \
  --output ./tablet-settings.json

# 各デバイスサイズで検証
visual-checker-v2 validate https://myapp.com \
  --settings ./mobile-settings.json \
  --viewport 375x667

visual-checker-v2 validate https://myapp.com \
  --settings ./tablet-settings.json \
  --viewport 768x1024
```

## 出力ファイル

### 設定ファイル (visual-checker-settings.json)

```json
{
  "settings": {
    "positionTolerance": 5,
    "sizeTolerance": 2,
    "textSimilarityThreshold": 0.9,
    "importanceThreshold": 10
  },
  "calibration": {
    "url": "https://example.com",
    "timestamp": "2024-01-20T10:00:00.000Z",
    "sampleCount": 5,
    "confidence": 92.5,
    "stats": {
      "avgPositionVariance": 3.2,
      "avgSizeVariance": 1.5,
      "avgTextSimilarity": 0.95,
      "stableElementRatio": 0.98
    }
  }
}
```

### 検証結果ファイル

```json
{
  "url": "https://example.com",
  "timestamp": "2024-01-20T11:00:00.000Z",
  "result": {
    "isValid": true,
    "similarity": 96.5,
    "violations": [],
    "summary": {
      "totalElements": 150,
      "changedElements": 5,
      "criticalViolations": 0,
      "warnings": 2
    }
  },
  "settings": { ... }
}
```

## 終了コード

- `0` - 成功（検証パス、比較が閾値以上）
- `1` - 失敗（検証失敗、比較が閾値未満、エラー）

## トラブルシューティング

### "No baseline provided" エラー

初回の`validate`実行時は、ベースラインが存在しないため、現在のレイアウトがベースラインとして保存されます。次回以降の実行で`--baseline`オプションを指定してください。

### キャリブレーションの信頼度が低い

- サンプル数を増やす: `--samples 20`
- 遅延時間を増やす: `--delay 3000`
- ページの読み込みが完全に終わるまで待つ

### 誤検知が多い

- strictnessレベルを調整: `--strictness low`
- 動的な要素を無視する設定を追加（今後実装予定）