/**
 * Cloudflare Worker Proxy for Visual Checker Testing
 *
 * 注意: テスト用プロキシです
 * このプロキシは任意のドメインへのリクエストを転送し、
 * visual-checkerがプロキシ経由でも正しく動作することを検証するために使用されます。
 */

export interface Env {
  ENVIRONMENT?: string;
  OVERRIDE_CONFIG?: string; // JSON形式のオーバーライド設定
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

// オーバーライドのマッチング関数
function findMatchingOverride(
  overrides: any[],
  url: string,
  method: string,
  headers: Headers
): any {
  for (const override of overrides) {
    // URLマッチング
    if (override.match?.url) {
      const pattern = override.match.url;
      if (typeof pattern === 'string' && !url.includes(pattern)) {
        continue;
      }
      // 正規表現パターンの場合（文字列として渡される）
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regex = new RegExp(pattern.slice(1, -1));
        if (!regex.test(url)) continue;
      }
    }

    // メソッドマッチング
    if (override.match?.method) {
      const methods = Array.isArray(override.match.method) 
        ? override.match.method 
        : [override.match.method];
      if (!methods.includes(method.toUpperCase())) continue;
    }

    // ヘッダーマッチング
    if (override.match?.headers) {
      let headerMatches = true;
      for (const [key, pattern] of Object.entries(override.match.headers)) {
        const headerValue = headers.get(key);
        if (!headerValue || headerValue !== pattern) {
          headerMatches = false;
          break;
        }
      }
      if (!headerMatches) continue;
    }

    return override;
  }
  return null;
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
      
      // オーバーライド設定をヘッダーから取得
      const overrideConfig = request.headers.get("X-Override-Config");
      let requestUrl = targetUrl;
      let requestHeaders = headers;
      let requestBody = request.body;
      
      // オーバーライド設定がある場合は適用
      if (overrideConfig) {
        try {
          const overrides = JSON.parse(overrideConfig);
          const override = findMatchingOverride(overrides, targetUrl, request.method, headers);
          
          if (override?.request) {
            // URL書き換え
            if (override.request.url) {
              requestUrl = override.request.url;
            }
            
            // ヘッダー書き換え
            if (override.request.headers) {
              for (const [key, value] of Object.entries(override.request.headers)) {
                requestHeaders.set(key, value as string);
              }
            }
            
            // ボディ書き換え
            if (override.request.body) {
              requestBody = override.request.body as BodyInit;
            }
          }
        } catch (e) {
          console.error("Failed to parse override config:", e);
        }
      }

      // ターゲットへのリクエストを作成
      const targetRequest = new Request(requestUrl, {
        method: request.method,
        headers: requestHeaders,
        body: requestBody,
        redirect: "follow",
      });

      // リクエストを転送
      const response = await fetch(targetRequest);
      
      // レスポンスのオーバーライド処理
      let responseStatus = response.status;
      let responseStatusText = response.statusText;
      let responseBody = response.body;
      let responseHeaders = new Headers(response.headers);
      
      // オーバーライド設定がある場合はレスポンスも処理
      if (overrideConfig) {
        try {
          const overrides = JSON.parse(overrideConfig);
          const override = findMatchingOverride(overrides, targetUrl, request.method, headers);
          
          if (override?.response) {
            // 完全置き換えの場合
            if (override.response.replace) {
              responseStatus = override.response.replace.status;
              responseStatusText = '';
              responseHeaders = new Headers(override.response.replace.headers);
              responseBody = override.response.replace.body;
            } else {
              // 部分的な書き換え
              if (override.response.status !== undefined) {
                responseStatus = override.response.status;
              }
              
              if (override.response.headers) {
                for (const [key, value] of Object.entries(override.response.headers)) {
                  responseHeaders.set(key, value as string);
                }
              }
              
              if (override.response.body !== undefined) {
                responseBody = override.response.body as BodyInit;
              }
            }
          }
        } catch (e) {
          console.error("Failed to apply response override:", e);
        }
      }

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
      const contentType = responseHeaders.get("Content-Type") || "";
      if (contentType.includes("text/html") && !override?.response?.replace) {
        let body = typeof responseBody === 'string' 
          ? responseBody 
          : await response.text();

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
          status: responseStatus,
          statusText: responseStatusText,
          headers: responseHeaders,
        });
      }

      // その他のコンテンツはそのまま返す
      return new Response(responseBody, {
        status: responseStatus,
        statusText: responseStatusText,
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
