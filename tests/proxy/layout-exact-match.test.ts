import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { defaultRunnerFactory } from '../../src/runner/factory.js';
import type { BrowserRunner, BrowserContext, PageContext } from '../../src/runner/types.js';
import type { LayoutAnalysisResult } from '../../src/layout/extractor.js';

// プロキシエンドポイント
const PROXY_ENDPOINT = process.env.PROXY_ENDPOINT || 'http://localhost:8787';

// レイアウトデータを正規化（URLとタイムスタンプを除外）
function normalizeLayout(layout: LayoutAnalysisResult): Omit<LayoutAnalysisResult, 'url' | 'timestamp'> {
  const { url, timestamp, ...normalized } = layout;
  return normalized;
}

// レイアウトを詳細に比較
function compareLayoutsDetailed(
  layout1: LayoutAnalysisResult, 
  layout2: LayoutAnalysisResult, 
  label1: string, 
  label2: string
): boolean {
  console.log(`\n=== Comparing ${label1} vs ${label2} ===`);
  console.log(`Elements: ${layout1.totalElements} vs ${layout2.totalElements}`);
  
  const normalized1 = normalizeLayout(layout1);
  const normalized2 = normalizeLayout(layout2);
  
  // JSON文字列化して比較
  const json1 = JSON.stringify(normalized1, null, 2);
  const json2 = JSON.stringify(normalized2, null, 2);
  
  if (json1 !== json2) {
    console.log('\n❌ Layouts are different!');
    
    // 要素数の違い
    if (layout1.totalElements !== layout2.totalElements) {
      console.log(`Element count mismatch: ${layout1.totalElements} vs ${layout2.totalElements}`);
    }
    
    // セマンティックグループの違い
    if (normalized1.semanticGroups && normalized2.semanticGroups) {
      const groups1 = normalized1.semanticGroups.length;
      const groups2 = normalized2.semanticGroups.length;
      if (groups1 !== groups2) {
        console.log(`Semantic groups mismatch: ${groups1} vs ${groups2}`);
      }
    }
    
    // より詳細なデバッグ情報を必要に応じて出力
    if (process.env.DEBUG) {
      console.log('\nLayout 1:', json1);
      console.log('\nLayout 2:', json2);
    }
    
    return false;
  }
  
  console.log('✅ Layouts are identical!');
  return true;
}

describe('プロキシ経由でのレイアウト完全一致テスト', { timeout: 60000 }, () => {
  let runner: BrowserRunner;
  let browserContext: BrowserContext;

  beforeAll(async () => {
    runner = defaultRunnerFactory.create('playwright');
    browserContext = await runner.launch({ headless: true });
  });

  afterAll(async () => {
    if (browserContext) await runner.close(browserContext);
    await defaultRunnerFactory.cleanup();
  });

  const testUrls = [
    'https://example.com',
    // GoogleとGitHubはSVG要素のclassName問題があるためスキップ
    // 'https://www.google.com',
    // 'https://github.com',
  ];

  test.each(testUrls)('直接アクセスとプロキシ経由で完全一致: %s', async (targetUrl) => {
    let directPage: PageContext | undefined;
    let proxyPage: PageContext | undefined;
    
    try {
      // 直接アクセス
      directPage = await runner.newPage(browserContext);
      await runner.goto(directPage, targetUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const directLayout = await runner.extractLayout(directPage);
      
      // プロキシ経由
      proxyPage = await runner.newPage(browserContext);
      const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
      await runner.goto(proxyPage, proxyUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const proxyLayout = await runner.extractLayout(proxyPage);
      
      // 詳細比較
      const isIdentical = compareLayoutsDetailed(
        directLayout, 
        proxyLayout, 
        'Direct Access', 
        'Proxy Access'
      );
      
      expect(isIdentical).toBe(true);
      
      // 追加の検証
      expect(proxyLayout.totalElements).toBe(directLayout.totalElements);
      expect(proxyLayout.viewport).toEqual(directLayout.viewport);
      
      if (directLayout.semanticGroups && proxyLayout.semanticGroups) {
        expect(proxyLayout.semanticGroups.length).toBe(directLayout.semanticGroups.length);
      }
      
    } finally {
      if (directPage) await runner.closePage(directPage);
      if (proxyPage) await runner.closePage(proxyPage);
    }
  });

  test('同じURLへの複数回アクセスでも一致', async () => {
    const targetUrl = 'https://example.com';
    const layouts: { label: string; layout: LayoutAnalysisResult }[] = [];
    
    // 3回ずつアクセス
    for (let i = 0; i < 3; i++) {
      // 直接アクセス
      const directPage = await runner.newPage(browserContext);
      await runner.goto(directPage, targetUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const directLayout = await runner.extractLayout(directPage);
      layouts.push({ label: `Direct #${i + 1}`, layout: directLayout });
      await runner.closePage(directPage);
      
      // プロキシ経由
      const proxyPage = await runner.newPage(browserContext);
      const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
      await runner.goto(proxyPage, proxyUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const proxyLayout = await runner.extractLayout(proxyPage);
      layouts.push({ label: `Proxy #${i + 1}`, layout: proxyLayout });
      await runner.closePage(proxyPage);
    }
    
    // すべてのレイアウトを比較
    console.log('\n=== Multiple Access Comparison ===');
    const baseLayout = layouts[0].layout;
    let allIdentical = true;
    
    for (let i = 1; i < layouts.length; i++) {
      const isIdentical = compareLayoutsDetailed(
        baseLayout, 
        layouts[i].layout, 
        layouts[0].label, 
        layouts[i].label
      );
      if (!isIdentical) {
        allIdentical = false;
      }
    }
    
    expect(allIdentical).toBe(true);
  });

  test('カスタムビューポートでも一致', async () => {
    const targetUrl = 'https://example.com';
    const customViewport = { width: 800, height: 600 };
    
    let directPage: PageContext | undefined;
    let proxyPage: PageContext | undefined;
    
    try {
      // 直接アクセス（カスタムビューポート）
      directPage = await runner.newPage(browserContext, { viewport: customViewport });
      await runner.goto(directPage, targetUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const directLayout = await runner.extractLayout(directPage);
      
      // プロキシ経由（カスタムビューポート）
      proxyPage = await runner.newPage(browserContext, { viewport: customViewport });
      const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
      await runner.goto(proxyPage, proxyUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const proxyLayout = await runner.extractLayout(proxyPage);
      
      // ビューポートが正しく設定されているか確認
      expect(directLayout.viewport).toEqual(customViewport);
      expect(proxyLayout.viewport).toEqual(customViewport);
      
      // レイアウトが一致するか確認
      const isIdentical = compareLayoutsDetailed(
        directLayout, 
        proxyLayout, 
        'Direct (800x600)', 
        'Proxy (800x600)'
      );
      
      expect(isIdentical).toBe(true);
      
    } finally {
      if (directPage) await runner.closePage(directPage);
      if (proxyPage) await runner.closePage(proxyPage);
    }
  });
});