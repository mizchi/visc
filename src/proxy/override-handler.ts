import type { ProxyOverride } from '../types.js';

/**
 * プロキシオーバーライドハンドラー
 * リクエスト/レスポンスの書き換えを管理
 */
export class ProxyOverrideHandler {
  private overrides: ProxyOverride[];

  constructor(overrides: ProxyOverride[] = []) {
    // 優先度でソート（高い順）
    this.overrides = [...overrides].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );
  }

  /**
   * リクエストに対してマッチするオーバーライドを見つける
   */
  findMatchingOverride(url: string, method: string, headers: Record<string, string>): ProxyOverride | null {
    for (const override of this.overrides) {
      // 有効チェック
      if (override.enabled === false) continue;
      if (typeof override.enabled === 'function' && !override.enabled()) continue;

      // URLマッチング
      if (override.match.url) {
        const urlPattern = override.match.url;
        if (typeof urlPattern === 'string') {
          if (!url.includes(urlPattern)) continue;
        } else if (urlPattern instanceof RegExp) {
          if (!urlPattern.test(url)) continue;
        }
      }

      // メソッドマッチング
      if (override.match.method) {
        const methods = Array.isArray(override.match.method) 
          ? override.match.method 
          : [override.match.method];
        if (!methods.includes(method.toUpperCase())) continue;
      }

      // ヘッダーマッチング
      if (override.match.headers) {
        let headerMatches = true;
        for (const [key, pattern] of Object.entries(override.match.headers)) {
          const headerValue = headers[key.toLowerCase()];
          if (!headerValue) {
            headerMatches = false;
            break;
          }
          
          if (typeof pattern === 'string') {
            if (headerValue !== pattern) {
              headerMatches = false;
              break;
            }
          } else if (pattern instanceof RegExp) {
            if (!pattern.test(headerValue)) {
              headerMatches = false;
              break;
            }
          }
        }
        if (!headerMatches) continue;
      }

      // すべての条件がマッチ
      return override;
    }

    return null;
  }

  /**
   * リクエストを書き換える
   */
  applyRequestOverride(
    override: ProxyOverride,
    originalUrl: string,
    originalHeaders: Record<string, string>,
    originalBody?: string | Buffer
  ): {
    url: string;
    headers: Record<string, string>;
    body?: string | Buffer;
  } {
    let url = originalUrl;
    let headers = { ...originalHeaders };
    let body = originalBody;

    if (override.request) {
      // URL書き換え
      if (override.request.url) {
        if (typeof override.request.url === 'function') {
          url = override.request.url(originalUrl);
        } else {
          url = override.request.url;
        }
      }

      // ヘッダー書き換え
      if (override.request.headers) {
        for (const [key, value] of Object.entries(override.request.headers)) {
          if (typeof value === 'function') {
            headers[key] = value(headers[key]);
          } else {
            headers[key] = value;
          }
        }
      }

      // ボディ書き換え
      if (override.request.body !== undefined) {
        if (typeof override.request.body === 'function') {
          body = override.request.body(body || '');
        } else {
          body = override.request.body;
        }
      }
    }

    return { url, headers, body };
  }

  /**
   * レスポンスを書き換える
   */
  applyResponseOverride(
    override: ProxyOverride,
    originalStatus: number,
    originalHeaders: Record<string, string>,
    originalBody?: string | Buffer
  ): {
    status: number;
    headers: Record<string, string>;
    body?: string | Buffer;
  } {
    // 完全置き換えの場合
    if (override.response?.replace) {
      return {
        status: override.response.replace.status,
        headers: { ...override.response.replace.headers },
        body: override.response.replace.body
      };
    }

    let status = originalStatus;
    let headers = { ...originalHeaders };
    let body = originalBody;

    if (override.response) {
      // ステータスコード書き換え
      if (override.response.status !== undefined) {
        status = override.response.status;
      }

      // ヘッダー書き換え
      if (override.response.headers) {
        for (const [key, value] of Object.entries(override.response.headers)) {
          if (typeof value === 'function') {
            headers[key] = value(headers[key]);
          } else {
            headers[key] = value;
          }
        }
      }

      // ボディ書き換え
      if (override.response.body !== undefined) {
        if (typeof override.response.body === 'function') {
          body = override.response.body(body || '');
        } else {
          body = override.response.body;
        }
      }
    }

    return { status, headers, body };
  }
}

/**
 * 一般的なオーバーライドのプリセット
 */
export const commonOverrides = {
  /**
   * 認証ヘッダーを追加
   */
  addAuthHeader: (token: string): ProxyOverride => ({
    match: {},
    request: {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  }),

  /**
   * 特定のAPIエンドポイントをモック
   */
  mockApiEndpoint: (urlPattern: string, responseData: any): ProxyOverride => ({
    match: {
      url: urlPattern
    },
    response: {
      replace: {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(responseData)
      }
    }
  }),

  /**
   * 広告やトラッキングスクリプトをブロック
   */
  blockTracking: (): ProxyOverride => ({
    match: {
      url: /\/(google-analytics|facebook|doubleclick|analytics|tracking)/
    },
    response: {
      replace: {
        status: 204,
        headers: {},
        body: ''
      }
    }
  }),

  /**
   * 特定のCookieを削除
   */
  removeCookie: (cookieName: string): ProxyOverride => ({
    match: {},
    response: {
      headers: {
        'Set-Cookie': (original) => {
          if (!original) return '';
          const cookies = original.split(',');
          return cookies
            .filter(cookie => !cookie.trim().startsWith(`${cookieName}=`))
            .join(',');
        }
      }
    }
  }),

  /**
   * キャッシュを無効化
   */
  disableCache: (): ProxyOverride => ({
    match: {},
    request: {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    },
    response: {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  })
};