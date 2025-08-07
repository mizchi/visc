# Visual Checker 開発コマンド

## ビルド・開発
- `npm run build` - TypeScriptをコンパイル、CLI用バンドル生成
- `npm run dev` - 開発モード（ファイル監視）
- `npm run build:watch` - ビルドをウォッチモード

## テスト
- `npm test` - Vitestでテスト実行
- `npm run test:patterns` - パターンテスト実行
- `vitest --ui` - Vitest UIモードでテスト

## 型チェック・リント
- `npm run typecheck` - TypeScript型チェック（tsc --noEmit）

## スキーマ生成
- `npm run generate:schema` - JSON Schema生成

## Git
- `git status` - 変更状況確認
- `git diff` - 差分確認  
- `git log --oneline -n 10` - 最近のコミット確認

## システムコマンド
- `ls` - ディレクトリ内容表示
- `grep -r "pattern" .` - パターン検索（ripgrep: `rg` 推奨）
- `find . -name "*.ts"` - ファイル検索