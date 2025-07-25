# Visual Checker Cloudflare Proxy

このディレクトリには、Visual Checkerのテスト用Cloudflare Workerプロキシが含まれています。

## 目的

プロキシ経由でのアクセスでも、Visual Checkerが正しくレイアウト情報を抽出できることを検証するために使用します。

## セットアップ

```bash
cd cloudflare-proxy
npm install
```

## ローカル開発

```bash
npm run dev
```

デフォルトでは `http://localhost:8787` で起動します。

## 使用方法

### クエリパラメータ経由
```
http://localhost:8787?url=https://example.com
```

### ヘッダー経由
```bash
curl -H "X-Target-URL: https://example.com" http://localhost:8787
```

## デプロイ

```bash
npm run deploy
```

デプロイ後、`wrangler.toml` の設定に基づいてWorkerがデプロイされます。
デプロイされたURLを `PROXY_ENDPOINT` 環境変数に設定してテストを実行してください。

## テスト実行

```bash
# ローカルプロキシでテスト
PROXY_ENDPOINT=http://localhost:8787 npm test tests/proxy/

# デプロイされたプロキシでテスト
PROXY_ENDPOINT=https://your-worker.workers.dev npm test tests/proxy/
```

## 機能

- 任意のURLへのプロキシ
- CORSヘッダーの自動追加
- HTMLコンテンツの相対URL解決
- エラーハンドリング
- レスポンスヘッダーの保持

## レスポンスヘッダー

プロキシは以下のヘッダーを追加します:

- `Access-Control-Allow-Origin: *` - CORS許可
- `X-Proxy-By: visual-checker-cloudflare-proxy` - プロキシ識別子
- `X-Original-URL: <target-url>` - オリジナルURL

## テスト結果

プロキシ統合テストは以下を検証します:

✅ CORSヘッダーが正しく設定される
✅ プロキシ識別ヘッダーが追加される
✅ HTMLコンテンツが正しく取得できる