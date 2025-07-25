/**
 * Cloudflare Worker Proxy for Visual Checker Testing
 *
 * 注意: テスト用プロキシです
 * このプロキシは任意のドメインへのリクエストを転送し、
 * visual-checkerがプロキシ経由でも正しく動作することを検証するために使用されます。
 */

export interface Env {
  ENVIRONMENT?: string;
}

// CORSヘッダーを追加
function corsHeaders(origin: string): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", origin || "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Target-URL"
  );
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    // CORS preflight対応
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    try {
      // X-Target-URLヘッダーまたはクエリパラメータからターゲットURLを取得
      let targetUrl =
        request.headers.get("X-Target-URL") || url.searchParams.get("url");

      if (!targetUrl) {
        return new Response(
          JSON.stringify({
            error:
              "Target URL is required. Please provide X-Target-URL header or url query parameter.",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...Object.fromEntries(corsHeaders(origin)),
            },
          }
        );
      }

      // URLの検証
      try {
        new URL(targetUrl);
      } catch (e) {
        return new Response(
          JSON.stringify({
            error: "Invalid target URL format",
          }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...Object.fromEntries(corsHeaders(origin)),
            },
          }
        );
      }

      // リクエストヘッダーの準備（プロキシ関連のヘッダーを除外）
      const headers = new Headers();
      for (const [key, value] of request.headers) {
        if (
          !["host", "x-target-url", "cf-connecting-ip", "cf-ray"].includes(
            key.toLowerCase()
          )
        ) {
          headers.set(key, value);
        }
      }

      // User-Agentを設定（visual-checkerであることを示す）
      headers.set("User-Agent", "Visual-Checker-Proxy/1.0 (Cloudflare Worker)");

      // ターゲットへのリクエストを作成
      const targetRequest = new Request(targetUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "follow",
      });

      // リクエストを転送
      const response = await fetch(targetRequest);

      // レスポンスヘッダーの準備
      const responseHeaders = new Headers(response.headers);

      // CORSヘッダーを追加
      for (const [key, value] of corsHeaders(origin)) {
        responseHeaders.set(key, value);
      }

      // オリジナルのURLを示すヘッダーを追加
      responseHeaders.set("X-Original-URL", targetUrl);
      responseHeaders.set("X-Proxy-By", "visual-checker-cloudflare-proxy");

      // Content-Security-Policyを調整（必要に応じて）
      if (responseHeaders.has("Content-Security-Policy")) {
        responseHeaders.delete("Content-Security-Policy");
      }

      // HTMLコンテンツの場合、ベースURLを注入
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        let body = await response.text();

        // <base>タグが存在しない場合は追加
        if (!body.includes("<base")) {
          const baseUrl = new URL(targetUrl).origin;
          body = body.replace(/<head[^>]*>/i, `$&\n<base href="${baseUrl}/">`);
        }

        // 相対URLを絶対URLに変換
        const targetOrigin = new URL(targetUrl).origin;
        body = body
          .replace(/src="\/([^"]+)"/g, `src="${targetOrigin}/$1"`)
          .replace(/href="\/([^"]+)"/g, `href="${targetOrigin}/$1"`);

        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }

      // その他のコンテンツはそのまま返す
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("Proxy error:", error);

      return new Response(
        JSON.stringify({
          error: "Proxy error occurred",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...Object.fromEntries(corsHeaders(origin)),
          },
        }
      );
    }
  },
};
