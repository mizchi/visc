import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { defaultRunnerFactory } from '../../src/runner/factory.js';
import type { BrowserRunner, BrowserContext, PageContext } from '../../src/runner/types.js';
import type { LayoutAnalysisResult } from '../../src/layout/extractor.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// プロキシエンドポイント
const PROXY_ENDPOINT = process.env.PROXY_ENDPOINT || 'http://localhost:8787';

// フィクスチャディレクトリ
const FIXTURES_DIR = path.join(process.cwd(), 'tests/proxy/__fixtures__');

describe('プロキシ経由レイアウトのフィクスチャ保存', { timeout: 60000 }, () => {
  let runner: BrowserRunner;
  let browserContext: BrowserContext;

  beforeAll(async () => {
    runner = defaultRunnerFactory.create('playwright');
    browserContext = await runner.launch({ headless: true });
    
    // フィクスチャディレクトリを確認
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
  });

  afterAll(async () => {
    if (browserContext) await runner.close(browserContext);
    await defaultRunnerFactory.cleanup();
  });

  test('example.comのレイアウトをフィクスチャに保存', async () => {
    const targetUrl = 'https://example.com';
    let directPage: PageContext | undefined;
    let proxyPage: PageContext | undefined;
    
    try {
      // 直接アクセス
      console.log('Fetching layout directly...');
      directPage = await runner.newPage(browserContext);
      await runner.goto(directPage, targetUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const directLayout = await runner.extractLayout(directPage);
      
      // プロキシ経由
      console.log('Fetching layout through proxy...');
      proxyPage = await runner.newPage(browserContext);
      const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
      await runner.goto(proxyPage, proxyUrl, { 
        waitFor: { networkIdle: true, timeout: 30000 } 
      });
      const proxyLayout = await runner.extractLayout(proxyPage);
      
      // タイムスタンプを固定して比較しやすくする
      const timestamp = new Date().toISOString();
      directLayout.timestamp = timestamp;
      proxyLayout.timestamp = timestamp;
      
      // フィクスチャに保存
      const fixtureData = {
        testDate: new Date().toISOString(),
        targetUrl,
        direct: directLayout,
        proxy: proxyLayout,
        comparison: {
          elementsMatch: directLayout.totalElements === proxyLayout.totalElements,
          directElements: directLayout.totalElements,
          proxyElements: proxyLayout.totalElements,
          viewportMatch: JSON.stringify(directLayout.viewport) === JSON.stringify(proxyLayout.viewport),
          directViewport: directLayout.viewport,
          proxyViewport: proxyLayout.viewport,
        }
      };
      
      const fileName = `example-com-layout-${Date.now()}.json`;
      const filePath = path.join(FIXTURES_DIR, fileName);
      
      await fs.writeFile(
        filePath, 
        JSON.stringify(fixtureData, null, 2),
        'utf-8'
      );
      
      console.log(`\n✅ Layout fixture saved to: ${path.relative(process.cwd(), filePath)}`);
      console.log(`   Direct elements: ${directLayout.totalElements}`);
      console.log(`   Proxy elements: ${proxyLayout.totalElements}`);
      console.log(`   Match: ${fixtureData.comparison.elementsMatch ? '✅' : '❌'}`);
      
      // 検証
      expect(proxyLayout.totalElements).toBe(directLayout.totalElements);
      expect(proxyLayout.viewport).toEqual(directLayout.viewport);
      
    } finally {
      if (directPage) await runner.closePage(directPage);
      if (proxyPage) await runner.closePage(proxyPage);
    }
  });

  test('複数URLのレイアウト差分を保存', async () => {
    const testCases = [
      { name: 'example-com', url: 'https://example.com' },
      { name: 'httpbin-html', url: 'https://httpbin.org/html' },
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\nProcessing ${testCase.name}...`);
      
      let directPage: PageContext | undefined;
      let proxyPage: PageContext | undefined;
      
      try {
        // 直接アクセス
        directPage = await runner.newPage(browserContext);
        await runner.goto(directPage, testCase.url, { 
          waitFor: { networkIdle: true, timeout: 30000 } 
        });
        const directLayout = await runner.extractLayout(directPage);
        
        // プロキシ経由
        proxyPage = await runner.newPage(browserContext);
        const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(testCase.url)}`;
        await runner.goto(proxyPage, proxyUrl, { 
          waitFor: { networkIdle: true, timeout: 30000 } 
        });
        const proxyLayout = await runner.extractLayout(proxyPage);
        
        results.push({
          name: testCase.name,
          url: testCase.url,
          direct: {
            elements: directLayout.totalElements,
            viewport: directLayout.viewport,
            semanticGroups: directLayout.semanticGroups?.length || 0,
          },
          proxy: {
            elements: proxyLayout.totalElements,
            viewport: proxyLayout.viewport,
            semanticGroups: proxyLayout.semanticGroups?.length || 0,
          },
          match: directLayout.totalElements === proxyLayout.totalElements,
        });
        
      } catch (error) {
        console.error(`Error processing ${testCase.name}:`, error);
        results.push({
          name: testCase.name,
          url: testCase.url,
          error: error.message,
        });
      } finally {
        if (directPage) await runner.closePage(directPage);
        if (proxyPage) await runner.closePage(proxyPage);
      }
    }
    
    // サマリーを保存
    const summaryPath = path.join(FIXTURES_DIR, `layout-comparison-summary-${Date.now()}.json`);
    await fs.writeFile(
      summaryPath,
      JSON.stringify({
        testDate: new Date().toISOString(),
        proxyEndpoint: PROXY_ENDPOINT,
        results,
      }, null, 2),
      'utf-8'
    );
    
    console.log(`\n✅ Summary saved to: ${path.relative(process.cwd(), summaryPath)}`);
    
    // 結果を表示
    console.log('\n=== Layout Comparison Summary ===');
    for (const result of results) {
      if ('error' in result) {
        console.log(`❌ ${result.name}: Error - ${result.error}`);
      } else {
        console.log(`${result.match ? '✅' : '❌'} ${result.name}: Direct=${result.direct.elements}, Proxy=${result.proxy.elements}`);
      }
    }
  });
});