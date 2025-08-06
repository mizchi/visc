# visc - ビジュアル回帰テストツールの紹介

## なぜ visc を作ったか

E2Eテストは重いし壊れやすい。特にレンダリング結果やCSS崩れの検出には向いてない。

ビジュアル回帰テストツールは既にいくつかあるけど、大抵は以下の問題がある：

- ピクセル単位の比較で誤検知が多い
- DOM要素単位の比較で意味のある変更を見逃す
- セットアップが複雑
- CIで動かすのが面倒

visc はこれらの問題を解決する。

## コア機能

### セマンティックなビジュアルグループ比較

DOM要素を個別に比較するんじゃなくて、意味のあるビジュアルグループとして比較する。

```typescript
// 従来: 個別のDOM要素を比較
// → テキストが1px動いただけで差分として検出

// visc: ビジュアルグループで比較
// → ヘッダー、サイドバー、メインコンテンツなど意味のある単位で比較
```

### 自動キャリブレーション

初回実行時に複数回サンプリングして、そのページの「揺れ」を分析する。これにより最適な閾値を自動決定。

```bash
# 初回実行で自動的にキャリブレーション
visc check

# 出力例
🔧 Analyzing home... (confidence: 95.2%)
```

### LCP待機とスマートな待機戦略

Largest Contentful Paint (LCP) を待つことで、ページの主要コンテンツが表示されるまで確実に待機。

```typescript
// captureOptions で細かく制御可能
{
  waitForLCP: true,  // デフォルト: true
  additionalWait: 500  // LCP後の追加待機時間
}
```

### ネットワーク制御

広告やアナリティクスをブロックしたり、CSSファイルを差し替えたりできる。

```json
{
  "captureOptions": {
    "networkBlocks": ["**/gtag/**", "**/analytics/**"]
  },
  "compareOptions": {
    "overrides": {
      "**/main.css": "./test-overrides/broken.css"
    }
  }
}
```

## 使い方

### 最小構成

```bash
# インストール
npm install -g @mizchi/visc

# 設定ファイル作成
cat > visc.config.json << EOF
{
  "version": "1.0",
  "viewports": {
    "desktop": {
      "name": "Desktop",
      "width": 1280,
      "height": 800
    }
  },
  "testCases": [
    {
      "id": "home",
      "url": "https://example.com"
    }
  ]
}
EOF

# 実行
visc check
```

初回実行でベースラインを作成、2回目以降で差分検出。

### TUIモード

進捗をリアルタイムで確認したい場合：

```bash
visc check --tui
```

各キャプチャの状態遷移が見える：
- requesting → waiting-lcp → extracting → completed

## E2Eテストとの使い分け

E2Eテストが必要なケース：
- ユーザーインタラクションのテスト
- フォーム送信の確認
- 複雑なステート管理の検証

visc が向いてるケース：
- レイアウト崩れの検出
- CSS変更の影響確認
- レスポンシブデザインの検証
- デプロイ前の最終確認

## 実装の工夫

### なぜセマンティックグループなのか

単純なDOM diffだと、以下のような問題がある：

1. 動的に生成されるIDやクラス名で誤検知
2. 1pxのズレでも差分として検出
3. 意味のない変更（広告の切り替わりなど）も検出

visc は要素を意味のあるグループにまとめることで、これらの問題を回避。

### パフォーマンス

並列実行に対応：

```bash
# 8並列で実行（ローカルサイト向け）
visc check -p 8 --interval 0
```

外部サイトの場合は適切なインターバルを設定：

```bash
# 500msのインターバルで順次実行
visc check --interval 500
```

## まとめ

visc はE2Eテストの代替ではなく、ビジュアル面の品質保証に特化したツール。

特徴：
- セマンティックな比較で誤検知を削減
- 自動キャリブレーションで閾値調整不要
- シンプルなCLIインターフェース
- CI/CDに組み込みやすい

CSS変更やレイアウト調整の影響を素早く確認したい時に使ってほしい。

## リンク

- GitHub: https://github.com/mizchi/visual-checker
- npm: https://www.npmjs.com/package/@mizchi/visc