import { Browser, BrowserContext } from '@playwright/test';
import { renderSemanticLayoutToSVG } from './semantic-svg.js';
import { createPlaywrightDriver } from '../driver/playwright-driver.js';
import { getSemanticLayout } from '../layout/semantic-layout.js';
import { 
  launchBrowser, 
  createContext, 
  createPage, 
  navigateTo, 
  takeScreenshot,
  closePage,
  closeContext,
  closeBrowser
} from '../io/browser.js';
import { 
  ensureDir, 
  writeFile, 
  writeJSON, 
  readFile,
  removeFile,
  compareImages as compareImageFiles
} from '../io/file.js';
import path from 'path';

export interface VisualAssertOptions {
  threshold?: number;
  viewport?: { width: number; height: number };
  outputDir?: string;
  generateSVG?: boolean;
}

export interface VisualTestResult {
  passed: boolean;
  difference: number;
  differencePercentage: string;
  diffPixels: number;
  files: {
    original: string;
    refactored: string;
    diff?: string;
  };
}

interface VisualAssertContext {
  browser: Browser;
  context: BrowserContext;
  options: Required<VisualAssertOptions>;
}

/**
 * 視覚的アサーションコンテキストを作成
 */
export async function createVisualAssert(options: VisualAssertOptions = {}) {
  const defaultOptions: Required<VisualAssertOptions> = {
    threshold: options.threshold ?? 0.01,
    viewport: options.viewport ?? { width: 1280, height: 720 },
    outputDir: options.outputDir ?? './output',
    generateSVG: options.generateSVG ?? true
  };

  const browser = await launchBrowser('chromium', { headless: true });
  const context = await createContext(browser, { 
    viewport: defaultOptions.viewport 
  });

  const ctx: VisualAssertContext = {
    browser,
    context,
    options: defaultOptions
  };

  return {
    /**
     * セマンティックレイアウトの比較（規約ベース）
     */
    compareSemanticLayout: async (name: string, opts?: Partial<VisualAssertOptions>) => 
      compareSemanticLayout(ctx, name, opts),
    
    /**
     * URLの視覚的差分を比較
     */
    compareUrls: async (originalUrl: string, refactoredUrl: string, name: string, opts?: Partial<VisualAssertOptions>) =>
      compareUrls(ctx, originalUrl, refactoredUrl, name, opts),
    
    /**
     * HTMLコンテンツの視覚的差分を比較
     */
    compareHtml: async (originalHtml: string, refactoredHtml: string, name: string, opts?: Partial<VisualAssertOptions>) =>
      compareHtml(ctx, originalHtml, refactoredHtml, name, opts),
    
    /**
     * クリーンアップ
     */
    cleanup: async () => {
      await closeContext(context);
      await closeBrowser(browser);
    }
  };
}

/**
 * セマンティックレイアウトの比較（規約ベース）
 */
async function compareSemanticLayout(
  ctx: VisualAssertContext,
  name: string,
  options?: Partial<VisualAssertOptions>
): Promise<VisualTestResult> {
  const opts = { ...ctx.options, ...options };
  
  // 規約: assets/{name}/index.html, original.css, refactored.css
  const dir = `./assets/${name}`;
  const htmlFile = `${dir}/index.html`;
  
  // 出力ディレクトリ作成 (test-case ごとに分ける)
  const testCaseDir = path.join(opts.outputDir, name);
  await ensureDir(path.join(testCaseDir, 'snapshots'));
  await ensureDir(path.join(testCaseDir, 'diff'));
  await ensureDir(path.join(testCaseDir, 'semantic'));
  
  // ファイル名にviewportサイズを含める
  const viewportSuffix = `${opts.viewport.width}x${opts.viewport.height}`;
  
  // オリジナルHTML
  const originalPath = await captureFileScreenshot(
    ctx, 
    path.resolve(htmlFile), 
    `original-${viewportSuffix}`, 
    { ...opts, outputDir: testCaseDir }
  );
  
  // リファクタリング後HTML（CSSを差し替え）
  const originalHtml = await readFile(htmlFile);
  const refactoredHtml = originalHtml.replace('original.css', 'refactored.css');
  const tempFile = `${dir}/temp.html`;
  await writeFile(tempFile, refactoredHtml);
  
  const refactoredPath = await captureFileScreenshot(
    ctx,
    path.resolve(tempFile), 
    `refactored-${viewportSuffix}`, 
    { ...opts, outputDir: testCaseDir }
  );
  
  await removeFile(tempFile);
  
  // 比較
  return compareScreenshots(originalPath, refactoredPath, name, { ...opts, outputDir: testCaseDir });
}

/**
 * URLの視覚的差分を比較
 */
async function compareUrls(
  ctx: VisualAssertContext,
  originalUrl: string,
  refactoredUrl: string,
  name: string,
  options?: Partial<VisualAssertOptions>
): Promise<VisualTestResult> {
  const opts = { ...ctx.options, ...options };
  
  // 出力ディレクトリ作成 (test-case ごとに分ける)
  const testCaseDir = path.join(opts.outputDir, name);
  await ensureDir(path.join(testCaseDir, 'snapshots'));
  await ensureDir(path.join(testCaseDir, 'diff'));
  await ensureDir(path.join(testCaseDir, 'semantic'));
  
  // ファイル名にviewportサイズを含める
  const viewportSuffix = `${opts.viewport.width}x${opts.viewport.height}`;
  
  // スクリーンショットを撮影
  const originalPath = await captureScreenshot(ctx, originalUrl, `original-${viewportSuffix}`, { ...opts, outputDir: testCaseDir });
  const refactoredPath = await captureScreenshot(ctx, refactoredUrl, `refactored-${viewportSuffix}`, { ...opts, outputDir: testCaseDir });
  
  // 比較
  return compareScreenshots(originalPath, refactoredPath, name, { ...opts, outputDir: testCaseDir });
}

/**
 * HTMLコンテンツの視覚的差分を比較
 */
async function compareHtml(
  ctx: VisualAssertContext,
  originalHtml: string,
  refactoredHtml: string,
  name: string,
  options?: Partial<VisualAssertOptions>
): Promise<VisualTestResult> {
  const opts = { ...ctx.options, ...options };
  
  // 出力ディレクトリ作成 (test-case ごとに分ける)
  const testCaseDir = path.join(opts.outputDir, name);
  await ensureDir(path.join(testCaseDir, 'snapshots'));
  await ensureDir(path.join(testCaseDir, 'diff'));
  await ensureDir(path.join(testCaseDir, 'semantic'));
  
  // ファイル名にviewportサイズを含める
  const viewportSuffix = `${opts.viewport.width}x${opts.viewport.height}`;
  
  // スクリーンショットを撮影
  const originalPath = await captureHtmlScreenshot(ctx, originalHtml, `original-${viewportSuffix}`, { ...opts, outputDir: testCaseDir });
  const refactoredPath = await captureHtmlScreenshot(ctx, refactoredHtml, `refactored-${viewportSuffix}`, { ...opts, outputDir: testCaseDir });
  
  // 比較
  return compareScreenshots(originalPath, refactoredPath, name, { ...opts, outputDir: testCaseDir });
}

/**
 * URLのスクリーンショットを撮影
 */
async function captureScreenshot(
  ctx: VisualAssertContext,
  url: string,
  name: string,
  options: Required<VisualAssertOptions>
): Promise<string> {
  const page = await createPage(ctx.context);
  try {
    await navigateTo(page, url);
    const screenshotPath = path.join(options.outputDir, 'snapshots', `${name}.png`);
    const buffer = await takeScreenshot(page, { path: screenshotPath, fullPage: true });
    return screenshotPath;
  } finally {
    await closePage(page);
  }
}

/**
 * HTMLコンテンツのスクリーンショットを撮影
 */
async function captureHtmlScreenshot(
  ctx: VisualAssertContext,
  html: string,
  name: string,
  options: Required<VisualAssertOptions>
): Promise<string> {
  const page = await createPage(ctx.context);
  try {
    await page.setContent(html, { waitUntil: 'networkidle' });
    const screenshotPath = path.join(options.outputDir, 'snapshots', `${name}.png`);
    const buffer = await takeScreenshot(page, { path: screenshotPath, fullPage: true });
    return screenshotPath;
  } finally {
    await closePage(page);
  }
}

/**
 * ファイルのスクリーンショットを撮影
 */
async function captureFileScreenshot(
  ctx: VisualAssertContext,
  filePath: string,
  name: string,
  options: Required<VisualAssertOptions>
): Promise<string> {
  const page = await createPage(ctx.context);
  try {
    await navigateTo(page, `file://${filePath}`);
    const screenshotPath = path.join(options.outputDir, 'snapshots', `${name}.png`);
    const buffer = await takeScreenshot(page, { path: screenshotPath, fullPage: true });
    
    // SVG生成が有効な場合
    if (options.generateSVG) {
      await ensureDir(path.join(options.outputDir, 'semantic'));
      
      // ドライバーを作成してレイアウトを取得
      const driver = createPlaywrightDriver({ page, viewport: options.viewport });
      const semanticLayout = await getSemanticLayout(driver);
      
      // JSONファイルとして保存
      const jsonPath = path.join(options.outputDir, 'semantic', `${name}.json`);
      await writeJSON(jsonPath, semanticLayout);
      
      // SVGファイルとして保官
      const svg = renderSemanticLayoutToSVG(
        semanticLayout, 
        options.viewport.width, 
        options.viewport.height
      );
      const svgPath = path.join(options.outputDir, 'semantic', `${name}.svg`);
      await writeFile(svgPath, svg);
    }
    
    return screenshotPath;
  } finally {
    await closePage(page);
  }
}

/**
 * スクリーンショットを比較
 */
async function compareScreenshots(
  originalPath: string,
  refactoredPath: string,
  name: string,
  options: Required<VisualAssertOptions>
): Promise<VisualTestResult> {
  // diffファイル名にもviewportサイズを含める
  const viewportSuffix = `${options.viewport.width}x${options.viewport.height}`;
  const diffPath = path.join(options.outputDir, 'diff', `diff-${viewportSuffix}.png`);
  const result = await compareImageFiles(originalPath, refactoredPath, {
    threshold: options.threshold,
    generateDiff: true,
    diffPath
  });

  return {
    passed: result.difference <= options.threshold,
    difference: result.difference,
    differencePercentage: (result.difference * 100).toFixed(4) + '%',
    diffPixels: result.diffPixels,
    files: {
      original: originalPath,
      refactored: refactoredPath,
      diff: result.diffPath
    }
  };
}

/**
 * シンプルなアサーション関数
 */
export async function assertVisualMatch(
  actual: VisualTestResult,
  message?: string
): Promise<void> {
  if (!actual.passed) {
    const error = new Error(
      message || 
      `Visual difference detected: ${actual.differencePercentage} (${actual.diffPixels} pixels)`
    );
    (error as any).actual = actual.differencePercentage;
    (error as any).expected = 'within threshold';
    (error as any).operator = 'visualMatch';
    throw error;
  }
}