# タスク完了時のチェックリスト

## コード変更後に実行すべきコマンド

1. **型チェック**
   ```bash
   npm run typecheck
   ```

2. **テスト実行**
   ```bash
   npm test
   ```

3. **ビルド確認**
   ```bash
   npm run build
   ```

## 確認事項
- [ ] TypeScriptの型エラーがない
- [ ] 全てのテストが通る
- [ ] ビルドが成功する
- [ ] 新しい機能にはテストが追加されている
- [ ] 既存のAPIの破壊的変更がない場合は後方互換性が保たれている

## 注意点
- `threshold` と `similarityThreshold` は 0〜1 の範囲（比率）で指定
- Puppeteerのリクエストハンドラーは重複登録に注意
- ネットワーク制御（overrides/blocks）は captureLayout 関数内で一元管理