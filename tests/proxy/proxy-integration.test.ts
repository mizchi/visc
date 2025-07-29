import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { defaultRunnerFactory } from '../../src/browser/runners/factory.js';
import { compareLayouts } from '../../src/layout/comparator.js';
import type { BrowserRunner, BrowserContext, PageContext } from '../../src/browser/runners/types.js';

// Cloudflare Workerのプロキシエンドポイント
// 実際のデプロイ時はこのURLを更新する必要があります
const PROXY_ENDPOINT = process.env.PROXY_ENDPOINT || 'http://localhost:8787';

describe('プロキシ経由での動作確認', { timeout: 60000 }, () => {
  let runner: BrowserRunner;
  let browserContext: BrowserContext;
  let directPage: PageContext;
  let proxyPage: PageContext;

  beforeAll(async () => {
    runner = defaultRunnerFactory.create('playwright');
    browserContext = await runner.launch({ headless: true });
  });

  afterAll(async () => {
    if (directPage) await runner.closePage(directPage);
    if (proxyPage) await runner.closePage(proxyPage);
    if (browserContext) await runner.close(browserContext);
    await defaultRunnerFactory.cleanup();
  });

  test.skip('直接アクセスとプロキシ経由のレイアウトが一致する', async () => {
    const targetUrl = 'https://example.com';
    
    console.log('Testing direct access to:', targetUrl);
    // 直接アクセス
    directPage = await runner.newPage(browserContext);
    await runner.goto(directPage, targetUrl, { waitFor: { networkIdle: true, timeout: 30000 } });
    const directLayout = await runner.extractLayout(directPage);
    console.log('Direct layout extracted:', { totalElements: directLayout.totalElements });
    
    // プロキシ経由でアクセス
    proxyPage = await runner.newPage(browserContext);
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
    console.log('Testing proxy access to:', proxyUrl);
    await runner.goto(proxyPage, proxyUrl, { waitFor: { networkIdle: true, timeout: 30000 } });
    const proxyLayout = await runner.extractLayout(proxyPage);
    console.log('Proxy layout extracted:', { totalElements: proxyLayout.totalElements });
    
    // デバッグ情報を出力
    console.log('Direct layout:', JSON.stringify(directLayout, null, 2));
    console.log('Proxy layout:', JSON.stringify(proxyLayout, null, 2));
    
    // URLとtimestampを除外して比較用のデータを作成
    const directLayoutForComparison = {
      ...directLayout,
      url: 'normalized',
      timestamp: 'normalized'
    };
    const proxyLayoutForComparison = {
      ...proxyLayout,
      url: 'normalized',
      timestamp: 'normalized'
    };
    
    // レイアウトの比較
    const comparison = compareLayouts(directLayoutForComparison, proxyLayoutForComparison);
    console.log('Comparison result:', {
      similarity: comparison.similarity,
      differences: comparison.differences.length,
      summary: comparison.summary
    });
    
    // プロキシ経由でも同じレイアウトが取得できることを確認
    expect(comparison.similarity).toBeGreaterThan(95); // 95%以上の類似度
    expect(comparison.differences.length).toBeLessThan(5); // 変更点が5個未満
    
    // 基本的な要素数が一致することを確認
    expect(proxyLayout.totalElements).toBeCloseTo(directLayout.totalElements, 5);
    
    // セマンティックグループの数が近いことを確認
    if (directLayout.semanticGroups && proxyLayout.semanticGroups) {
      expect(proxyLayout.semanticGroups.length).toBeCloseTo(
        directLayout.semanticGroups.length, 
        2
      );
    }
  });

  test('プロキシヘッダーが正しく設定される', async () => {
    const targetUrl = 'https://example.com';
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
    
    const page = await runner.newPage(browserContext);
    
    // レスポンスをインターセプト
    let proxyHeaders: Record<string, string> = {};
    await runner.evaluate(page, () => {
      // @ts-ignore
      window.__interceptedHeaders = {};
    });
    
    // プロキシ経由でアクセス
    await runner.goto(page, proxyUrl);
    
    // fetch APIをオーバーライドしてヘッダーを確認
    const headers = await runner.evaluate(page, async () => {
      const response = await fetch(window.location.href);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return headers;
    });
    
    // プロキシ固有のヘッダーを確認
    expect(headers['x-proxy-by']).toBe('visual-checker-cloudflare-proxy');
    expect(headers['x-original-url']).toBe(targetUrl);
    
    await runner.closePage(page);
  });

  test.skip('異なるビューポートサイズでもプロキシ経由で正しく動作', async () => {
    const targetUrl = 'https://example.com';
    
    // デスクトップサイズ
    const desktopPage = await runner.newPage(browserContext, {
      viewport: { width: 1280, height: 720 }
    });
    await runner.goto(desktopPage, `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`);
    const desktopLayout = await runner.extractLayout(desktopPage);
    
    // モバイルサイズ
    const mobilePage = await runner.newPage(browserContext, {
      viewport: { width: 375, height: 667 }
    });
    await runner.goto(mobilePage, `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`);
    const mobileLayout = await runner.extractLayout(mobilePage);
    
    // ビューポートサイズが正しく記録されていることを確認
    expect(desktopLayout.viewport.width).toBe(1280);
    expect(mobileLayout.viewport.width).toBe(375);
    
    // レスポンシブデザインが反映されていることを確認
    // （デスクトップとモバイルで異なるレイアウトになることを期待）
    const comparison = compareLayouts(desktopLayout, mobileLayout);
    expect(comparison.similarity).toBeLessThan(90); // 90%未満の類似度（異なるレイアウト）
    
    await runner.closePage(desktopPage);
    await runner.closePage(mobilePage);
  });

  test('プロキシでCORSが正しく設定される', async () => {
    const targetUrl = 'https://example.com';
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
    
    // fetchを使用して直接プロキシにリクエスト
    const response = await fetch(proxyUrl);
    
    // CORSヘッダーが設定されていることを確認
    console.log('Response headers:', {
      'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
      'x-proxy-by': response.headers.get('x-proxy-by'),
      'x-original-url': response.headers.get('x-original-url'),
    });
    
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('x-proxy-by')).toBe('visual-checker-cloudflare-proxy');
    expect(response.headers.get('x-original-url')).toBe(targetUrl);
    
    // レスポンスボディが正しくHTMLであることを確認
    const text = await response.text();
    expect(text).toContain('<title>Example Domain</title>');
  });
  
  test.skip('プロキシ経由でHTMLが正しく取得できる', async () => {
    const targetUrl = 'https://example.com';
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
    
    const page = await runner.newPage(browserContext);
    
    // プロキシ経由でアクセス
    await runner.goto(page, proxyUrl);
    
    // HTMLコンテンツを取得
    const htmlContent = await runner.evaluate(page, () => {
      return document.documentElement.outerHTML;
    });
    
    // 基本的なHTML構造が含まれていることを確認
    expect(htmlContent).toContain('<title>Example Domain</title>');
    expect(htmlContent).toContain('Example Domain');
    expect(htmlContent).toContain('More information...');
    
    // プロキシが挿入したURL変換が動作していることを確認
    const links = await runner.evaluate(page, () => {
      return Array.from(document.querySelectorAll('a')).map(a => a.href);
    });
    
    console.log('Links found:', links);
    
    await runner.closePage(page);
  });
  
  test.skip('プロキシのエラーハンドリング', async () => {
    const page = await runner.newPage(browserContext);
    
    // 無効なURLの場合
    const invalidUrl = `${PROXY_ENDPOINT}?url=invalid-url`;
    await runner.goto(page, invalidUrl);
    
    const bodyText = await runner.evaluate(page, () => document.body.textContent);
    expect(bodyText).toContain('Invalid target URL format');
    
    // URLパラメータがない場合
    await runner.goto(page, PROXY_ENDPOINT);
    const errorText = await runner.evaluate(page, () => document.body.textContent);
    expect(errorText).toContain('Target URL is required');
    
    await runner.closePage(page);
  });
});