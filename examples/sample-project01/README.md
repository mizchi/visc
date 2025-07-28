# CSS Visual Regression Test

CSSリファクタリングの視覚的回帰テストツール

## 使い方

### 1. ディレクトリ構造（規約）

```
assets/
└── {テスト名}/
    ├── index.html    # テスト用HTML
    ├── original.css  # オリジナルCSS
    └── refactored.css # リファクタリング後CSS
```

### 2. 実行

```bash
# デフォルト出力 (./output)
npm test

# カスタム出力ディレクトリ
node test.ts --outdir ./my-output
```

### 3. 出力

```
{outdir}/
├── snapshots/     # スクリーンショット
│   ├── {name}-original.png
│   └── {name}-refactored.png
└── diff/          # 差分画像
    └── {name}.png
```

## 例

```typescript
// test.ts内でテストを追加
await t.test('my-component', async () => {
  const result = await visualDiff('my-component');
  assert.ok(result.passed, `差分: ${result.diff}`);
});
```

## オプション

- `threshold`: 許容する差分の閾値（デフォルト: 0.01 = 1%）
- `viewport`: ビューポートサイズ（デフォルト: 1280x720）

```typescript
await visualDiff('main', { 
  threshold: 0.001,  // 0.1%
  viewport: { width: 375, height: 667 }  // モバイル
});
```