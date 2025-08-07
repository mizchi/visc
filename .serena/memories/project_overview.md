# Visual Checker (visc) Project Overview

## プロジェクトの目的
Visual regression testing CLI tool - Web ページのレイアウトをキャプチャして比較し、視覚的な差分を検出するツール

## 技術スタック
- **言語**: TypeScript
- **ランタイム**: Node.js (ESM modules)
- **主要ライブラリ**:
  - Puppeteer (ブラウザ自動化)
  - Commander (CLI)
  - Zod (スキーマバリデーション)
  - Vitest (テスト)
  - React/Ink (TUI)

## コードスタイルと規約
- TypeScript strict mode
- ESM module 形式
- 型定義は src/types.ts に集約
- エラーハンドリングは try-catch で適切に処理
- 非同期処理は async/await を使用

## ディレクトリ構成
```
src/
├── cli/          # CLI関連の実装
├── layout/       # レイアウト抽出・比較ロジック
├── calibration/  # キャリブレーション機能
├── tests/        # テストファイル
└── types.ts      # 型定義
```

## 主要機能
1. レイアウトキャプチャと視覚グループ抽出
2. 自動キャリブレーション
3. ネットワークリクエストの制御（ブロック/オーバーライド）
4. SVG形式での差分可視化
5. 並列実行サポート