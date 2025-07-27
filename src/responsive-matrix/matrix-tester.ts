import { Page } from 'playwright';
import { 
  VisualCheckConfig, 
  UrlConfig, 
  ViewportSize, 
  ResponsiveMatrixResult,
  ViewportTestResult,
  MediaQueryConsistency 
} from '../types.js';
import { BrowserController } from '../browser-controller.js';
import { extractLayoutScript } from '../layout/extractor.js';
import { compareLayouts } from '../layout/comparator.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export class ResponsiveMatrixTester {
  private browserController: BrowserController;
  private config: VisualCheckConfig;
  
  constructor(browserController: BrowserController, config: VisualCheckConfig) {
    this.browserController = browserController;
    this.config = config;
  }
  
  /**
   * 単一URLに対してマトリクステストを実行
   */
  async testUrl(urlConfig: UrlConfig): Promise<ResponsiveMatrixResult> {
    const timestamp = new Date().toISOString();
    const viewportResults: ViewportTestResult[] = [];
    const mediaQueryMap = new Map<string, Set<string>>();
    
    // デフォルトビューポートを設定
    const viewports = this.config.responsiveMatrix?.viewports || this.getDefaultViewports();
    
    // 各ビューポートでテスト実行
    for (const viewport of viewports) {
      try {
        const result = await this.testViewport(urlConfig, viewport);
        viewportResults.push(result);
        
        // メディアクエリの記録
        for (const query of result.appliedMediaQueries) {
          if (!mediaQueryMap.has(query)) {
            mediaQueryMap.set(query, new Set());
          }
          mediaQueryMap.get(query)!.add(viewport.name);
        }
      } catch (error) {
        viewportResults.push({
          viewport,
          snapshotPath: '',
          appliedMediaQueries: [],
          cssFingerprint: '',
          layoutStructure: null,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // メディアクエリの一貫性をチェック
    const mediaQueryConsistency = this.checkMediaQueryConsistency(
      mediaQueryMap,
      viewports,
      this.config.responsiveMatrix?.breakpoints
    );
    
    // 結果の集計
    const summary = this.calculateSummary(viewportResults, mediaQueryConsistency);
    
    return {
      url: urlConfig,
      timestamp,
      viewportResults,
      mediaQueryConsistency,
      passed: summary.failedViewports === 0 && summary.mediaQueryIssues === 0,
      summary
    };
  }
  
  /**
   * 特定のビューポートでテストを実行
   */
  private async testViewport(
    urlConfig: UrlConfig, 
    viewport: ViewportSize
  ): Promise<ViewportTestResult> {
    const page = await this.browserController.newPage();
    
    try {
      // ビューポートを設定
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height
      });
      
      if (viewport.deviceScaleFactor) {
        await page.evaluate((dpr) => {
          (window as any).devicePixelRatio = dpr;
        }, viewport.deviceScaleFactor);
      }
      
      if (viewport.userAgent) {
        await page.setExtraHTTPHeaders({
          'User-Agent': viewport.userAgent
        });
      }
      
      // ページにアクセス
      const fullUrl = this.config.baseUrl ? 
        new URL(urlConfig.url, this.config.baseUrl).toString() : 
        urlConfig.url;
      
      await page.goto(fullUrl, { waitUntil: 'networkidle' });
      
      // 待機処理
      if (urlConfig.waitFor) {
        await this.handleWaitFor(page, urlConfig.waitFor);
      }
      
      // スクリーンショット前の処理
      if (urlConfig.beforeScreenshot) {
        await this.handleBeforeScreenshot(page, urlConfig.beforeScreenshot);
      }
      
      // メディアクエリの取得
      const appliedMediaQueries = await this.getAppliedMediaQueries(page);
      
      // CSS計算値のフィンガープリント生成
      const cssFingerprint = await this.generateCSSFingerprint(page);
      
      // レイアウト構造の抽出
      const layoutStructure = await page.evaluate(extractLayoutScript);
      
      // スクリーンショットの保存
      const snapshotPath = await this.saveScreenshot(
        page, 
        urlConfig, 
        viewport,
        urlConfig.screenshot
      );
      
      return {
        viewport,
        snapshotPath,
        appliedMediaQueries,
        cssFingerprint,
        layoutStructure
      };
    } finally {
      await page.close();
    }
  }
  
  /**
   * 適用されているメディアクエリを取得
   */
  private async getAppliedMediaQueries(page: Page): Promise<string[]> {
    return await page.evaluate(() => {
      const queries: string[] = [];
      const styleSheets = Array.from(document.styleSheets);
      
      for (const sheet of styleSheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule instanceof CSSMediaRule) {
              // メディアクエリが現在のビューポートで適用されているかチェック
              if (window.matchMedia(rule.conditionText).matches) {
                queries.push(rule.conditionText);
              }
            }
          }
        } catch (e) {
          // クロスオリジンのスタイルシートはアクセスできない場合がある
        }
      }
      
      return [...new Set(queries)].sort();
    });
  }
  
  /**
   * CSS計算値のフィンガープリントを生成
   */
  private async generateCSSFingerprint(page: Page): Promise<string> {
    const cssData = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const cssMap = new Map<string, any>();
      
      // 重要な要素のスタイルを収集
      const importantSelectors = [
        'body', 'header', 'nav', 'main', 'article', 'section', 
        'aside', 'footer', '.container', '.wrapper'
      ];
      
      for (const selector of importantSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const computed = window.getComputedStyle(element);
          const relevantProps = [
            'display', 'position', 'width', 'height', 'margin', 
            'padding', 'flexDirection', 'gridTemplateColumns',
            'float', 'clear'
          ];
          
          const styles: any = {};
          for (const prop of relevantProps) {
            styles[prop] = computed.getPropertyValue(prop);
          }
          
          cssMap.set(selector, styles);
        }
      }
      
      return JSON.stringify(Array.from(cssMap.entries()).sort());
    });
    
    // ハッシュ生成
    return crypto.createHash('sha256').update(cssData).digest('hex').substring(0, 16);
  }
  
  /**
   * メディアクエリの一貫性をチェック
   */
  private checkMediaQueryConsistency(
    mediaQueryMap: Map<string, Set<string>>,
    viewports: ViewportSize[],
    breakpoints?: Array<{name: string; minWidth?: number; maxWidth?: number}>
  ): MediaQueryConsistency[] {
    const results: MediaQueryConsistency[] = [];
    
    for (const [query, actualViewportNames] of mediaQueryMap) {
      const expectedViewports = this.getExpectedViewportsForQuery(
        query, 
        viewports,
        breakpoints
      );
      
      const actual = Array.from(actualViewportNames).sort();
      const expected = expectedViewports.sort();
      const isConsistent = JSON.stringify(actual) === JSON.stringify(expected);
      
      const inconsistencies: string[] = [];
      
      // 期待されるが適用されていないビューポート
      const missing = expected.filter(v => !actual.includes(v));
      if (missing.length > 0) {
        inconsistencies.push(`Missing in: ${missing.join(', ')}`);
      }
      
      // 期待されないが適用されているビューポート
      const unexpected = actual.filter(v => !expected.includes(v));
      if (unexpected.length > 0) {
        inconsistencies.push(`Unexpected in: ${unexpected.join(', ')}`);
      }
      
      results.push({
        query,
        expectedViewports: expected,
        actualViewports: actual,
        isConsistent,
        inconsistencies: isConsistent ? undefined : inconsistencies
      });
    }
    
    return results;
  }
  
  /**
   * メディアクエリに基づいて期待されるビューポートを取得
   */
  private getExpectedViewportsForQuery(
    query: string,
    viewports: ViewportSize[],
    breakpoints?: Array<{name: string; minWidth?: number; maxWidth?: number}>
  ): string[] {
    const expected: string[] = [];
    
    // メディアクエリから幅の条件を抽出
    const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
    const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);
    
    const minWidth = minWidthMatch ? parseInt(minWidthMatch[1]) : 0;
    const maxWidth = maxWidthMatch ? parseInt(maxWidthMatch[1]) : Infinity;
    
    // 各ビューポートがクエリに一致するかチェック
    for (const viewport of viewports) {
      if (viewport.width >= minWidth && viewport.width <= maxWidth) {
        expected.push(viewport.name);
      }
    }
    
    return expected;
  }
  
  /**
   * スクリーンショットを保存
   */
  private async saveScreenshot(
    page: Page,
    urlConfig: UrlConfig,
    viewport: ViewportSize,
    screenshotConfig?: any
  ): Promise<string> {
    const snapshotDir = this.config.snapshotDir || './snapshots';
    const filename = `${urlConfig.name}-${viewport.name}-${viewport.width}x${viewport.height}.png`;
    const filepath = path.join(snapshotDir, 'responsive-matrix', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    if (screenshotConfig?.selector) {
      await page.locator(screenshotConfig.selector).screenshot({ path: filepath });
    } else {
      await page.screenshot({
        path: filepath,
        fullPage: screenshotConfig?.fullPage !== false,
        clip: screenshotConfig?.clip
      });
    }
    
    return filepath;
  }
  
  /**
   * 待機処理
   */
  private async handleWaitFor(page: Page, waitFor: any): Promise<void> {
    if (waitFor.selector) {
      await page.waitForSelector(waitFor.selector, {
        timeout: waitFor.timeout || 30000
      });
    }
    
    if (waitFor.networkIdle) {
      await page.waitForLoadState('networkidle');
    }
    
    if (waitFor.timeout && !waitFor.selector) {
      await page.waitForTimeout(waitFor.timeout);
    }
  }
  
  /**
   * スクリーンショット前の処理
   */
  private async handleBeforeScreenshot(page: Page, before: any): Promise<void> {
    if (before.script) {
      await page.evaluate(before.script);
    }
    
    if (before.click) {
      for (const selector of before.click) {
        await page.click(selector);
      }
    }
    
    if (before.hide) {
      for (const selector of before.hide) {
        await page.locator(selector).evaluate((el: HTMLElement) => {
          el.style.display = 'none';
        });
      }
    }
    
    if (before.scrollTo) {
      await page.evaluate(({ x, y }) => {
        window.scrollTo(x, y);
      }, before.scrollTo);
    }
  }
  
  /**
   * デフォルトのビューポートを取得
   */
  private getDefaultViewports(): ViewportSize[] {
    return [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'wide', width: 1920, height: 1080 }
    ];
  }
  
  /**
   * サマリーを計算
   */
  private calculateSummary(
    viewportResults: ViewportTestResult[],
    mediaQueryConsistency: MediaQueryConsistency[]
  ) {
    const passedViewports = viewportResults.filter(r => !r.error).length;
    const failedViewports = viewportResults.filter(r => r.error).length;
    const mediaQueryIssues = mediaQueryConsistency.filter(m => !m.isConsistent).length;
    
    // レイアウトの不整合をチェック
    let layoutInconsistencies = 0;
    const layouts = viewportResults
      .filter(r => r.layoutStructure)
      .map(r => r.layoutStructure);
    
    // 隣接するビューポート間でレイアウトを比較
    for (let i = 1; i < layouts.length; i++) {
      const comparison = compareLayouts(layouts[i - 1], layouts[i]);
      if (comparison.similarity < (this.config.responsiveMatrix?.cssSimilarityThreshold || 0.8)) {
        layoutInconsistencies++;
      }
    }
    
    return {
      totalViewports: viewportResults.length,
      passedViewports,
      failedViewports,
      mediaQueryIssues,
      layoutInconsistencies
    };
  }
}