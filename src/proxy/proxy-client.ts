import type { ProxyOverride } from '../types.js';

/**
 * プロキシクライアント
 * Visual CheckerからプロキシにOverride設定を送信する
 */
export class ProxyClient {
  private proxyUrl: string;
  private overrides: ProxyOverride[];

  constructor(proxyUrl: string, overrides: ProxyOverride[] = []) {
    this.proxyUrl = proxyUrl;
    this.overrides = overrides;
  }

  /**
   * プロキシ経由でURLにアクセスするためのURLを生成
   */
  getProxiedUrl(targetUrl: string): string {
    const url = new URL(this.proxyUrl);
    url.searchParams.set('url', targetUrl);
    return url.toString();
  }

  /**
   * プロキシリクエスト用のヘッダーを生成
   */
  getProxyHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.overrides.length > 0) {
      // オーバーライド設定をJSON形式でヘッダーに含める
      headers['X-Override-Config'] = JSON.stringify(this.overrides);
    }
    
    return headers;
  }

  /**
   * Playwright用の設定を生成
   */
  getPlaywrightContext() {
    return {
      extraHTTPHeaders: this.getProxyHeaders()
    };
  }

  /**
   * 特定のURLに対してオーバーライドを追加
   */
  addOverride(override: ProxyOverride): void {
    this.overrides.push(override);
  }

  /**
   * オーバーライドをクリア
   */
  clearOverrides(): void {
    this.overrides = [];
  }

  /**
   * 現在のオーバーライド設定を取得
   */
  getOverrides(): ProxyOverride[] {
    return [...this.overrides];
  }
}

/**
 * プロキシ設定からクライアントを作成
 */
export function createProxyClient(
  config: { proxy?: { enabled?: boolean; url?: string; overrides?: ProxyOverride[] } }
): ProxyClient | null {
  if (!config.proxy?.enabled || !config.proxy?.url) {
    return null;
  }

  return new ProxyClient(config.proxy.url, config.proxy.overrides || []);
}