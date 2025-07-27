/**
 * Visual Checker
 * 
 * A visual regression testing framework with progressive API levels
 * 
 * @example
 * ```typescript
 * // Level 1: Core API - 最も簡単な使い方
 * import { captureScreenshot, compareImages } from 'visual-checker';
 * const screenshot = await captureScreenshot('https://example.com');
 * const result = await compareImages('before.png', 'after.png');
 * 
 * // Level 2: Basic API - 一般的な使い方
 * import { BrowserController, SnapshotManager } from 'visual-checker';
 * const browser = new BrowserController();
 * const manager = new SnapshotManager();
 * 
 * // Level 3: Advanced API - 高度な機能
 * import { layout, responsive } from 'visual-checker';
 * const analyzer = new layout.LayoutAnalyzer();
 * const tester = new responsive.MatrixTester();
 * ```
 * 
 * @packageDocumentation
 */

// ========================================
// Level 1: Core API - 最も基本的な機能
// ========================================
export { 
  captureScreenshot, 
  captureMultipleScreenshots,
  compareImages,
  compareMultipleImages
} from './core/index.js';

export type {
  // ScreenshotOptionsはbasicからエクスポートするため除外
  ScreenshotResult,
  CompareOptions,
  CompareResult
} from './core/index.js';

// ========================================
// Level 2: Basic API - よく使う機能
// ========================================
export { 
  BrowserController,
  SnapshotManager,
  ConfigLoader
} from './basic/index.js';

export type {
  BrowserConfig,
  PageOptions,
  BasicConfig
} from './basic/index.js';

// ========================================
// Level 3: Advanced API - 高度な機能（名前空間付き）
// ========================================
// レイアウト分析
// export * as layout from './advanced/layout/index.js';

// レスポンシブテスト
// export * as responsive from './advanced/responsive/index.js';

// コンテンツ分析
// export * as content from './advanced/content/index.js';

// プロキシ機能
// export * as proxy from './advanced/proxy/index.js';

// ========================================
// 既存のエクスポート（後方互換性のため）
// これらは将来的に非推奨になる予定
// ========================================
export { TestRunner } from "./test-runner.js";
export { BrowserController as LegacyBrowserController } from "./browser-controller.js";
export { SnapshotComparator } from "./snapshot-comparator.js";
export type { VisualCheckConfig, UrlConfig, TestResult } from "./types.js";

// Layout analysis exports
export {
  getSemanticType,
  calculateImportance,
  detectPatterns,
  extractLayoutScript,
} from "./layout/extractor.js";

export {
  detectSemanticGroups,
  extractSemanticLayoutScript,
} from "./layout/semantic-analyzer.js";

export type {
  LayoutElement,
  SemanticGroup,
  LayoutPattern,
  LayoutAnalysisResult,
  LayoutRect,
} from "./layout/extractor.js";

// Layout comparison exports
export {
  compareLayouts,
  hasLayoutChanged,
  isLayoutSimilar,
} from "./layout/comparator.js";

export type {
  LayoutDifference,
  LayoutComparisonResult,
} from "./layout/comparator.js";

// Layout assertion exports
export {
  assertLayoutsIdentical,
  assertLayoutsSimilar,
  assertNoLayoutChanges,
  createLayoutMatchers,
  expectLayoutsToMatch,
  LayoutAssertionError,
} from "./layout/assertions.js";

// Flakiness detection exports
export {
  detectFlakiness,
  generateFlakinessReport,
} from "./layout/flakiness-detector.js";

export type {
  FlakinessAnalysis,
  FlakyElement,
  VariationDetail,
} from "./layout/flakiness-detector.js";

export {
  MultiCrawlManager,
  commonVariations,
} from "./layout/multi-crawl-manager.js";

export type {
  MultiCrawlOptions,
  MultiCrawlResult,
} from "./layout/multi-crawl-manager.js";

// Browser runner exports
export * from "./runner/index.js";

// Layout distance calculation exports
export {
  extractRectFeatures,
  calculateRectDistance,
  calculateGroupSimilarity,
  calculateLayoutSimilarity,
  generateLayoutFingerprint,
  isSameLayoutStructure,
} from "./layout/rect-distance.js";

export type {
  RectDistanceOptions,
  RectFeatures,
  LayoutSimilarity,
} from "./layout/rect-distance.js";

// Visual layout comparison exports
export {
  flattenGroups,
  calculateVisualSimilarity,
  isVisuallyEqualLayout,
} from "./layout/rect-distance-visual.js";

// Validator exports
export * from "./validator/index.js";

// Workflow exports
export * from "./workflow/types.js";
export { WorkflowEngine, defaultWorkflowConfig, createGeminiWorkflowConfig } from "./workflow/workflow-engine.js";
export { createAIProvider } from "./workflow/ai-provider-factory.js";

// Responsive Matrix Testing exports
export { ResponsiveMatrixTester } from "./responsive-matrix/matrix-tester.js";
export { ResponsiveMatrixReportGenerator } from "./responsive-matrix/report-generator.js";
export type {
  ResponsiveMatrixResult,
  ViewportTestResult,
  MediaQueryConsistency,
  ViewportSize
} from "./types.js";

// Content-Aware Layout Comparison exports
export {
  compareLayoutsWithContentExclusion,
  analyzeLayoutWithContentAwareness
} from "./layout/content-aware-comparator.js";
export type {
  ContentAwareComparisonOptions,
  ContentAwareComparisonResult,
  ContentExtractionResult
} from "./layout/content-aware-comparator.js";

// ========================================
// 便利な初期化関数
// ========================================

/**
 * Visual Checkerを簡単に始めるための初期化関数
 * 
 * @example
 * ```typescript
 * const vc = await createVisualChecker({
 *   baseUrl: 'https://example.com',
 *   snapshotDir: './snapshots'
 * });
 * 
 * await vc.capture('home', '/');
 * const result = await vc.compare('home', '/');
 * ```
 */
export async function createVisualChecker(config?: any) {
  const { BrowserController } = await import('./basic/browser/controller.js');
  const { SnapshotManager } = await import('./basic/snapshot/manager.js');
  
  const browser = new BrowserController(config?.browser);
  const snapshots = new SnapshotManager(config?.snapshotDir);
  
  return {
    browser,
    snapshots,
    
    async capture(name: string, url: string, options?: any) {
      if (!browser.isLaunched()) {
        await browser.launch();
      }
      const screenshot = await browser.captureScreenshot({
        url: config?.baseUrl ? new URL(url, config.baseUrl).toString() : url,
        name,
        ...options
      });
      return screenshot;
    },
    
    async compare(name: string, url: string, options?: any) {
      const screenshot = await this.capture(name, url, options);
      
      if (!await snapshots.hasBaseline(name)) {
        await snapshots.update(name, screenshot);
        return { match: true, firstRun: true };
      }
      
      return await snapshots.compare(name, screenshot, {
        threshold: config?.comparison?.threshold,
        generateDiff: config?.comparison?.generateDiff
      });
    },
    
    async update(name: string, url: string, options?: any) {
      const screenshot = await this.capture(name, url, options);
      await snapshots.update(name, screenshot);
    },
    
    async close() {
      await browser.close();
    }
  };
}
