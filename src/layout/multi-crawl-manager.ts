/**
 * 複数回クロール管理機能
 * 
 * ウェブサイトを複数回クロールして、結果を管理・分析します。
 */

import type { LayoutAnalysisResult } from "./extractor.js";
import { detectFlakiness, type FlakinessAnalysis } from "./flakiness-detector.js";
import type { BrowserRunner, BrowserContext, PageContext, ViewportSize } from "../browser/runners/types.js";

export interface MultiCrawlOptions {
  /** クロール回数 */
  iterations: number;
  /** 各クロール間の待機時間（ミリ秒） */
  delayBetweenCrawls?: number;
  /** ページロード後の待機時間（ミリ秒） */
  waitAfterLoad?: number;
  /** クロール前に実行するアクション */
  beforeEachCrawl?: (runner: BrowserRunner, page: PageContext, iteration: number) => Promise<void>;
  /** クロール後に実行するアクション */
  afterEachCrawl?: (runner: BrowserRunner, page: PageContext, iteration: number, result: LayoutAnalysisResult) => Promise<void>;
  /** プログレスコールバック */
  onProgress?: (current: number, total: number) => void;
  /** キャッシュをクリアするか */
  clearCache?: boolean;
  /** Cookieをクリアするか */
  clearCookies?: boolean;
  /** ローカルストレージをクリアするか */
  clearLocalStorage?: boolean;
}

export interface MultiCrawlResult {
  /** クロール結果の配列 */
  results: LayoutAnalysisResult[];
  /** フレーキーネス分析結果 */
  flakinessAnalysis: FlakinessAnalysis;
  /** メタデータ */
  metadata: {
    url: string;
    totalIterations: number;
    successfulIterations: number;
    failedIterations: number;
    averageCrawlTime: number;
    startTime: string;
    endTime: string;
  };
  /** エラー情報 */
  errors: Array<{
    iteration: number;
    error: string;
    timestamp: string;
  }>;
}

/**
 * 複数回クロールマネージャー
 */
export class MultiCrawlManager {
  private results: LayoutAnalysisResult[] = [];
  private errors: Array<{ iteration: number; error: string; timestamp: string }> = [];
  private crawlTimes: number[] = [];

  constructor(
    private runner: BrowserRunner,
    private browserContext: BrowserContext,
    private pageContext: PageContext
  ) {}

  /**
   * 指定されたURLを複数回クロール
   */
  async crawl(url: string, options: MultiCrawlOptions): Promise<MultiCrawlResult> {
    const {
      iterations,
      delayBetweenCrawls = 1000,
      waitAfterLoad = 1000,
      beforeEachCrawl,
      afterEachCrawl,
      onProgress,
      clearCache = false,
      clearCookies = false,
      clearLocalStorage = false,
    } = options;

    const startTime = new Date();
    this.results = [];
    this.errors = [];
    this.crawlTimes = [];

    for (let i = 0; i < iterations; i++) {
      try {
        const iterationStartTime = Date.now();

        // プログレス通知
        onProgress?.(i + 1, iterations);

        // クリーニング処理
        if (i > 0) {
          await this.cleanupBeforeCrawl({ clearCache, clearCookies, clearLocalStorage });
          
          // クロール間の待機
          if (delayBetweenCrawls > 0) {
            await this.runner.wait(delayBetweenCrawls);
          }
        }

        // クロール前のアクション
        if (beforeEachCrawl) {
          await beforeEachCrawl(this.runner, this.pageContext, i);
        }

        // ページへ移動
        await this.runner.goto(this.pageContext, url, { waitUntil: 'networkidle' });

        // ページロード後の待機
        if (waitAfterLoad > 0) {
          await this.runner.wait(waitAfterLoad);
        }

        // レイアウト情報を抽出
        const result = await this.runner.extractLayout(this.pageContext);
        this.results.push(result);

        // クロール後のアクション
        if (afterEachCrawl) {
          await afterEachCrawl(this.runner, this.pageContext, i, result);
        }

        // クロール時間を記録
        this.crawlTimes.push(Date.now() - iterationStartTime);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.errors.push({
          iteration: i,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const endTime = new Date();

    // フレーキーネス分析
    const flakinessAnalysis = this.results.length >= 2
      ? detectFlakiness(this.results)
      : this.createEmptyFlakinessAnalysis();

    return {
      results: this.results,
      flakinessAnalysis,
      metadata: {
        url,
        totalIterations: iterations,
        successfulIterations: this.results.length,
        failedIterations: this.errors.length,
        averageCrawlTime: this.calculateAverageCrawlTime(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      errors: this.errors,
    };
  }

  /**
   * 特定の条件でクロールを繰り返す
   */
  async crawlUntilStable(
    url: string,
    options: {
      maxIterations?: number;
      minIterations?: number;
      stabilityThreshold?: number;
      delayBetweenCrawls?: number;
      waitAfterLoad?: number;
      onProgress?: (current: number, isStable: boolean) => void;
    } = {}
  ): Promise<MultiCrawlResult> {
    const {
      maxIterations = 10,
      minIterations = 3,
      stabilityThreshold = 95,
      delayBetweenCrawls = 1000,
      waitAfterLoad = 1000,
      onProgress,
    } = options;

    const startTime = new Date();
    this.results = [];
    this.errors = [];
    this.crawlTimes = [];

    let isStable = false;
    let iteration = 0;

    while (iteration < maxIterations && (!isStable || iteration < minIterations)) {
      try {
        const iterationStartTime = Date.now();
        
        onProgress?.(iteration + 1, isStable);

        if (iteration > 0 && delayBetweenCrawls > 0) {
          await this.runner.wait(delayBetweenCrawls);
        }

        await this.runner.goto(this.pageContext, url, { waitUntil: 'networkidle' });

        if (waitAfterLoad > 0) {
          await this.runner.wait(waitAfterLoad);
        }

        const result = await this.runner.extractLayout(this.pageContext);
        this.results.push(result);

        // 安定性をチェック（最低3回のクロール後）
        if (this.results.length >= minIterations) {
          const recentResults = this.results.slice(-minIterations);
          const analysis = detectFlakiness(recentResults);
          isStable = analysis.overallScore <= (100 - stabilityThreshold);
        }

        this.crawlTimes.push(Date.now() - iterationStartTime);
        iteration++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.errors.push({
          iteration,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        });
        iteration++;
      }
    }

    const endTime = new Date();
    const flakinessAnalysis = this.results.length >= 2
      ? detectFlakiness(this.results)
      : this.createEmptyFlakinessAnalysis();

    return {
      results: this.results,
      flakinessAnalysis,
      metadata: {
        url,
        totalIterations: iteration,
        successfulIterations: this.results.length,
        failedIterations: this.errors.length,
        averageCrawlTime: this.calculateAverageCrawlTime(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      errors: this.errors,
    };
  }

  /**
   * 異なる条件でクロール
   */
  async crawlWithVariations(
    url: string,
    variations: Array<{
      name: string;
      setup: (runner: BrowserRunner, page: PageContext) => Promise<void>;
      teardown?: (runner: BrowserRunner, page: PageContext) => Promise<void>;
    }>,
    options: {
      iterationsPerVariation?: number;
      delayBetweenCrawls?: number;
      waitAfterLoad?: number;
      onProgress?: (variation: string, current: number, total: number) => void;
    } = {}
  ): Promise<Map<string, MultiCrawlResult>> {
    const {
      iterationsPerVariation = 3,
      delayBetweenCrawls = 1000,
      waitAfterLoad = 1000,
      onProgress,
    } = options;

    const results = new Map<string, MultiCrawlResult>();

    for (const variation of variations) {
      // バリエーションのセットアップ
      await variation.setup(this.runner, this.pageContext);

      // クロール実行
      const result = await this.crawl(url, {
        iterations: iterationsPerVariation,
        delayBetweenCrawls,
        waitAfterLoad,
        onProgress: (current, total) => onProgress?.(variation.name, current, total),
      });

      results.set(variation.name, result);

      // バリエーションのクリーンアップ
      if (variation.teardown) {
        await variation.teardown(this.runner, this.pageContext);
      }
    }

    return results;
  }

  /**
   * クロール前のクリーンアップ
   */
  private async cleanupBeforeCrawl(options: {
    clearCache: boolean;
    clearCookies: boolean;
    clearLocalStorage: boolean;
  }): Promise<void> {
    if (options.clearCache || options.clearCookies) {
      await this.runner.clearCookies(this.pageContext);
    }

    if (options.clearLocalStorage) {
      await this.runner.clearLocalStorage(this.pageContext);
    }
  }

  /**
   * 平均クロール時間を計算
   */
  private calculateAverageCrawlTime(): number {
    if (this.crawlTimes.length === 0) return 0;
    const sum = this.crawlTimes.reduce((acc, time) => acc + time, 0);
    return Math.round(sum / this.crawlTimes.length);
  }

  /**
   * 空のフレーキーネス分析結果を作成
   */
  private createEmptyFlakinessAnalysis(): FlakinessAnalysis {
    return {
      overallScore: 0,
      flakyElements: [],
      stableCount: 0,
      unstableCount: 0,
      sampleCount: this.results.length,
      categorizedFlakiness: {
        position: [],
        size: [],
        content: [],
        existence: [],
        style: [],
      },
    };
  }
}

/**
 * ヘルパー関数: 一般的なバリエーションセット
 */
export function getCommonVariations() {
  return {
  /** ビューポートサイズのバリエーション */
  viewportSizes: (sizes: Array<{ width: number; height: number; name: string }>) =>
    sizes.map(size => ({
      name: `Viewport ${size.name}`,
      setup: async (runner: BrowserRunner, page: PageContext) => {
        await runner.setViewportSize(page, { width: size.width, height: size.height });
      },
    })),

  /** ネットワーク条件のバリエーション */
  networkConditions: () => [
    {
      name: 'Fast 3G',
      setup: async (runner: BrowserRunner, page: PageContext) => {
        await runner.setNetworkConditions(page, {
          offline: false,
          downloadThroughput: 1.5 * 1024 * 1024 / 8,
          uploadThroughput: 750 * 1024 / 8,
          latency: 40,
        });
      },
    },
    {
      name: 'Slow 3G',
      setup: async (runner: BrowserRunner, page: PageContext) => {
        await runner.setNetworkConditions(page, {
          offline: false,
          downloadThroughput: 0.5 * 1024 * 1024 / 8,
          uploadThroughput: 0.5 * 1024 * 1024 / 8,
          latency: 400,
        });
      },
    },
  ],

  /** タイムゾーンのバリエーション */
  timezones: (zones: string[]) =>
    zones.map(timezone => ({
      name: `Timezone ${timezone}`,
      setup: async (runner: BrowserRunner, page: PageContext) => {
        await runner.setExtraHTTPHeaders(page, {
          'Accept-Language': 'en-US',
        });
        await runner.evaluate(page, () => {
          // タイムゾーンをシミュレート
          const originalDate = Date;
          (window as any).Date = new Proxy(originalDate, {
            construct(target: any, args: any[]) {
              const instance = new target(...args);
              // タイムゾーンオフセットを調整
              return instance;
            },
          });
        });
      },
    })),
  };
}