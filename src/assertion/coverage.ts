import { createPuppeteerDriver, PuppeteerDriver, CoverageReport } from '../driver/puppeteer-driver.js';
import { getSemanticLayout } from '../layout/semantic-layout.js';
import { renderSemanticLayoutToSVG } from './semantic-svg.js';
import { 
  ensureDir, 
  writeFile, 
  writeJSON, 
  readFile,
  removeFile
} from '../io/file.js';
import { 
  launchPuppeteer,
  createPuppeteerPage,
  closePuppeteer
} from '../io/puppeteer.js';
import path from 'path';

export interface CoverageAssertOptions {
  viewports?: Array<{ width: number; height: number; name?: string }>;
  outputDir?: string;
  generateSVG?: boolean;
  coverage?: boolean;
}

export interface ViewportTestResult {
  viewport: { width: number; height: number };
  viewportName: string;
  screenshot: string;
  semanticLayout?: {
    json: string;
    svg?: string;
  };
  coverage?: CoverageReport;
}

export interface CoverageTestResult {
  name: string;
  viewports: ViewportTestResult[];
  totalCoverage?: CoverageReport;
}

/**
 * カバレッジ計測機能付きのアサーションコンテキストを作成
 */
export async function createCoverageAssert(options: CoverageAssertOptions = {}) {
  const defaultOptions = {
    viewports: options.viewports ?? [
      { width: 1280, height: 720, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ],
    outputDir: options.outputDir ?? './output',
    generateSVG: options.generateSVG ?? true,
    coverage: options.coverage ?? true
  };

  const browser = await launchPuppeteer({ headless: true });

  return {
    /**
     * 複数のviewportでテストを実行
     */
    async testWithViewports(
      name: string,
      url: string,
      options?: Partial<CoverageAssertOptions>
    ): Promise<CoverageTestResult> {
      const opts = { ...defaultOptions, ...options };
      const page = await createPuppeteerPage(browser, opts.viewports[0]);
      const driver = createPuppeteerDriver({ page, browser }) as PuppeteerDriver;

      // カバレッジ計測を開始
      if (opts.coverage) {
        await driver.startCoverage();
      }

      // 最初のページ読み込み
      await driver.goto(url);

      const results: ViewportTestResult[] = [];

      // 各viewportでテスト
      for (const viewport of opts.viewports) {
        const viewportName = viewport.name || `${viewport.width}x${viewport.height}`;
        const viewportDir = path.join(opts.outputDir, name, viewportName);
        
        await ensureDir(viewportDir);
        await ensureDir(path.join(viewportDir, 'screenshots'));
        
        if (opts.generateSVG) {
          await ensureDir(path.join(viewportDir, 'semantic'));
        }

        // viewportを変更
        await driver.setViewport(viewport);
        
        // 少し待つ（レイアウトの再計算のため）
        await new Promise(resolve => setTimeout(resolve, 500));

        // スクリーンショットを撮影
        const screenshotPath = path.join(viewportDir, 'screenshots', 'screenshot.png');
        const screenshotBuffer = await driver.screenshot({ path: screenshotPath });

        const result: ViewportTestResult = {
          viewport,
          viewportName,
          screenshot: screenshotPath
        };

        // セマンティックレイアウトを取得
        if (opts.generateSVG) {
          const semanticLayout = await getSemanticLayout(driver);
          
          // JSONとして保存
          const jsonPath = path.join(viewportDir, 'semantic', 'layout.json');
          await writeJSON(jsonPath, semanticLayout);
          
          // SVGとして保存
          const svg = renderSemanticLayoutToSVG(
            semanticLayout,
            viewport.width,
            viewport.height
          );
          const svgPath = path.join(viewportDir, 'semantic', 'layout.svg');
          await writeFile(svgPath, svg);

          result.semanticLayout = {
            json: jsonPath,
            svg: svgPath
          };
        }

        // 現在のカバレッジを取得
        if (opts.coverage) {
          result.coverage = await driver.getCoverageReport();
          
          // カバレッジレポートを保存
          const coveragePath = path.join(viewportDir, 'coverage.json');
          await writeJSON(coveragePath, result.coverage);
        }

        results.push(result);
      }

      // 最終的なカバレッジを取得
      let totalCoverage: CoverageReport | undefined;
      if (opts.coverage) {
        totalCoverage = await driver.stopCoverage();
        
        // 総合カバレッジレポートを保存
        const totalCoveragePath = path.join(opts.outputDir, name, 'total-coverage.json');
        await writeJSON(totalCoveragePath, totalCoverage);
      }

      await driver.close();

      return {
        name,
        viewports: results,
        totalCoverage
      };
    },

    /**
     * 規約ベースのテスト（複数viewport対応）
     */
    async testSemanticLayoutWithViewports(
      name: string,
      options?: Partial<CoverageAssertOptions>
    ): Promise<CoverageTestResult> {
      const opts = { ...defaultOptions, ...options };
      const dir = `./assets/${name}`;
      const htmlFile = `${dir}/index.html`;
      const fileUrl = `file://${path.resolve(htmlFile)}`;

      return this.testWithViewports(name, fileUrl, opts);
    },

    /**
     * クリーンアップ
     */
    async cleanup(): Promise<void> {
      await closePuppeteer(browser);
    }
  };
}

/**
 * カバレッジのアサーション
 */
export function assertCoverage(
  coverage: CoverageReport,
  thresholds: {
    js?: number;
    css?: number;
  } = {}
): void {
  const jsThreshold = thresholds.js ?? 80;
  const cssThreshold = thresholds.css ?? 80;

  if (coverage.js.percentage < jsThreshold) {
    throw new Error(
      `JavaScript coverage ${coverage.js.percentage}% is below threshold ${jsThreshold}%`
    );
  }

  if (coverage.css.percentage < cssThreshold) {
    throw new Error(
      `CSS coverage ${coverage.css.percentage}% is below threshold ${cssThreshold}%`
    );
  }
}