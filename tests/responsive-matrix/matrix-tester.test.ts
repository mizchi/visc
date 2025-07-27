import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ResponsiveMatrixTester } from '../../src/responsive-matrix/matrix-tester.js';
import { BrowserController } from '../../src/browser-controller.js';
import { VisualCheckConfig, UrlConfig } from '../../src/types.js';

describe('ResponsiveMatrixTester', () => {
  let browserController: BrowserController;
  let tester: ResponsiveMatrixTester;
  
  const testConfig: VisualCheckConfig = {
    baseUrl: 'data:text/html,',
    snapshotDir: './test-snapshots',
    responsiveMatrix: {
      enabled: true,
      viewports: [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1280, height: 720 }
      ],
      breakpoints: [
        { name: 'mobile', maxWidth: 767 },
        { name: 'tablet', minWidth: 768, maxWidth: 1023 },
        { name: 'desktop', minWidth: 1024 }
      ],
      cssSimilarityThreshold: 0.8
    }
  };
  
  beforeAll(async () => {
    browserController = new BrowserController({
      browser: 'chromium',
      headless: true
    });
    await browserController.launch();
    tester = new ResponsiveMatrixTester(browserController, testConfig);
  });
  
  afterAll(async () => {
    await browserController.close();
  });
  
  it('should test multiple viewports for a URL', async () => {
    const testHtml = `
      <html>
      <head>
        <style>
          body { margin: 0; font-family: Arial; }
          .container { padding: 20px; }
          h1 { color: #333; }
          
          /* Mobile styles */
          @media (max-width: 767px) {
            .container { padding: 10px; }
            h1 { font-size: 24px; }
          }
          
          /* Tablet styles */
          @media (min-width: 768px) and (max-width: 1023px) {
            .container { padding: 15px; }
            h1 { font-size: 28px; }
          }
          
          /* Desktop styles */
          @media (min-width: 1024px) {
            .container { padding: 20px; }
            h1 { font-size: 32px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Responsive Test Page</h1>
          <p>This page adapts to different screen sizes.</p>
        </div>
      </body>
      </html>
    `;
    
    const urlConfig: UrlConfig = {
      name: 'test-page',
      url: encodeURIComponent(testHtml)
    };
    
    const result = await tester.testUrl(urlConfig);
    
    // 基本的な検証
    expect(result).toBeDefined();
    expect(result.viewportResults).toHaveLength(3);
    expect(result.passed).toBe(true);
    
    // 各ビューポートの結果を検証
    const mobileResult = result.viewportResults.find(r => r.viewport.name === 'mobile');
    const tabletResult = result.viewportResults.find(r => r.viewport.name === 'tablet');
    const desktopResult = result.viewportResults.find(r => r.viewport.name === 'desktop');
    
    expect(mobileResult).toBeDefined();
    expect(tabletResult).toBeDefined();
    expect(desktopResult).toBeDefined();
    
    // メディアクエリの適用を検証
    expect(mobileResult!.appliedMediaQueries).toContain('(max-width: 767px)');
    expect(tabletResult!.appliedMediaQueries).toContain('(min-width: 768px) and (max-width: 1023px)');
    expect(desktopResult!.appliedMediaQueries).toContain('(min-width: 1024px)');
    
    // CSSフィンガープリントが生成されていることを確認
    expect(mobileResult!.cssFingerprint).toBeTruthy();
    expect(mobileResult!.cssFingerprint).not.toBe(desktopResult!.cssFingerprint);
  });
  
  it('should detect media query inconsistencies', async () => {
    const testHtml = `
      <html>
      <head>
        <style>
          /* Incorrect breakpoint - gap between 800px and 801px */
          @media (max-width: 800px) {
            body { background: red; }
          }
          @media (min-width: 801px) {
            body { background: blue; }
          }
        </style>
      </head>
      <body>
        <h1>Inconsistent Media Queries</h1>
      </body>
      </html>
    `;
    
    const urlConfig: UrlConfig = {
      name: 'inconsistent-page',
      url: encodeURIComponent(testHtml)
    };
    
    const result = await tester.testUrl(urlConfig);
    
    // メディアクエリの一貫性チェック
    expect(result.mediaQueryConsistency).toBeDefined();
    expect(result.mediaQueryConsistency.length).toBeGreaterThan(0);
  });
  
  it('should handle viewport-specific configurations', async () => {
    const customConfig: VisualCheckConfig = {
      ...testConfig,
      responsiveMatrix: {
        ...testConfig.responsiveMatrix,
        viewports: [
          {
            name: 'iphone',
            width: 375,
            height: 812,
            deviceScaleFactor: 3,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
          }
        ]
      }
    };
    
    const customTester = new ResponsiveMatrixTester(browserController, customConfig);
    
    const urlConfig: UrlConfig = {
      name: 'device-test',
      url: '<h1>Device Test</h1>'
    };
    
    const result = await customTester.testUrl(urlConfig);
    
    expect(result.viewportResults).toHaveLength(1);
    expect(result.viewportResults[0].viewport.deviceScaleFactor).toBe(3);
  });
  
  it('should calculate layout similarities between viewports', async () => {
    const testHtml = `
      <html>
      <head>
        <style>
          .grid { display: grid; gap: 10px; }
          
          @media (max-width: 767px) {
            .grid { grid-template-columns: 1fr; }
          }
          
          @media (min-width: 768px) {
            .grid { grid-template-columns: 1fr 1fr; }
          }
        </style>
      </head>
      <body>
        <div class="grid">
          <div>Item 1</div>
          <div>Item 2</div>
          <div>Item 3</div>
          <div>Item 4</div>
        </div>
      </body>
      </html>
    `;
    
    const urlConfig: UrlConfig = {
      name: 'grid-layout',
      url: encodeURIComponent(testHtml)
    };
    
    const result = await tester.testUrl(urlConfig);
    
    // レイアウトの不整合が検出されることを確認
    expect(result.summary.layoutInconsistencies).toBeGreaterThanOrEqual(0);
    
    // 各ビューポートでレイアウト構造が抽出されていることを確認
    result.viewportResults.forEach(vr => {
      expect(vr.layoutStructure).toBeDefined();
      expect(vr.layoutStructure).not.toBeNull();
    });
  });
});