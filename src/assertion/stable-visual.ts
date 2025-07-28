import { createVisualAssert, type VisualAssertOptions, type VisualTestResult } from './visual.js';
import { readFile, writeJSON } from '../io/file.js';
import path from 'node:path';

export interface StabilityConfig {
  stability: {
    enabled: boolean;
    toleranceThreshold: number;
    ignoreNodes: string[];
    ignoreAttributes: string[];
    overallStability: number;
    analysisDate: string;
  };
  viewport: { width: number; height: number };
  metadata: {
    url: string;
    iterations: number;
    totalNodes: number;
    unstableNodes: number;
  };
}

export interface StableVisualAssertOptions extends VisualAssertOptions {
  stabilityConfigPath?: string;
  stabilityConfig?: StabilityConfig;
}

export interface StableVisualTestResult extends VisualTestResult {
  stabilityAdjusted: boolean;
  ignoredDifferences?: {
    nodes: number;
    attributes: string[];
  };
}

/**
 * 安定性を考慮した視覚的アサーションコンテキストを作成
 */
export async function createStableVisualAssert(options: StableVisualAssertOptions = {}) {
  // 安定性設定を読み込む
  let stabilityConfig: StabilityConfig | undefined;
  
  if (options.stabilityConfigPath) {
    const configContent = await readFile(options.stabilityConfigPath);
    stabilityConfig = JSON.parse(configContent);
  } else if (options.stabilityConfig) {
    stabilityConfig = options.stabilityConfig;
  }

  // ベースのvisual assertを作成
  const baseAssert = await createVisualAssert({
    ...options,
    threshold: stabilityConfig?.stability.toleranceThreshold || options.threshold,
    viewport: stabilityConfig?.viewport || options.viewport
  });

  return {
    /**
     * 安定性を考慮したセマンティックレイアウトの比較
     */
    async compareStableSemanticLayout(
      name: string, 
      opts?: Partial<StableVisualAssertOptions>
    ): Promise<StableVisualTestResult> {
      const result = await baseAssert.compareSemanticLayout(name, opts);
      
      if (!stabilityConfig?.stability.enabled) {
        return {
          ...result,
          stabilityAdjusted: false
        };
      }

      // 安定性設定に基づいて結果を調整
      const adjustedResult = adjustResultWithStability(result, stabilityConfig);
      
      // 調整結果を保存
      const outputDir = opts?.outputDir || options.outputDir || './output';
      await writeJSON(
        path.join(outputDir, name, 'stability-adjusted-result.json'),
        adjustedResult
      );

      return adjustedResult;
    },

    /**
     * 安定性を考慮したURLの比較
     */
    async compareStableUrls(
      originalUrl: string,
      refactoredUrl: string,
      name: string,
      opts?: Partial<StableVisualAssertOptions>
    ): Promise<StableVisualTestResult> {
      const result = await baseAssert.compareUrls(originalUrl, refactoredUrl, name, opts);
      
      if (!stabilityConfig?.stability.enabled) {
        return {
          ...result,
          stabilityAdjusted: false
        };
      }

      return adjustResultWithStability(result, stabilityConfig);
    },

    /**
     * 安定性設定を更新
     */
    updateStabilityConfig(config: StabilityConfig) {
      stabilityConfig = config;
    },

    /**
     * クリーンアップ
     */
    cleanup: baseAssert.cleanup
  };
}

/**
 * 安定性設定に基づいて結果を調整
 */
function adjustResultWithStability(
  result: VisualTestResult,
  config: StabilityConfig
): StableVisualTestResult {
  const { toleranceThreshold, ignoreNodes, ignoreAttributes } = config.stability;
  
  // 差分が許容閾値以内の場合はパスとする
  let adjustedPassed = result.passed;
  let ignoredNodeCount = 0;
  
  if (!result.passed && result.difference <= toleranceThreshold / 100) {
    adjustedPassed = true;
  }

  // TODO: セマンティックレイアウトの差分から不安定なノードを除外する処理
  // これには、より詳細な差分情報が必要

  return {
    ...result,
    passed: adjustedPassed,
    stabilityAdjusted: true,
    ignoredDifferences: {
      nodes: ignoredNodeCount,
      attributes: ignoreAttributes
    }
  };
}

/**
 * 安定性を考慮したアサーション
 */
export async function assertStableVisualMatch(
  actual: StableVisualTestResult,
  message?: string
): Promise<void> {
  if (!actual.passed) {
    const stabilityInfo = actual.stabilityAdjusted 
      ? ` (安定性調整後: ${actual.ignoredDifferences?.nodes || 0} ノードを無視)`
      : '';
      
    const error = new Error(
      message || 
      `Visual difference detected: ${actual.differencePercentage} (${actual.diffPixels} pixels)${stabilityInfo}`
    );
    (error as any).actual = actual.differencePercentage;
    (error as any).expected = 'within threshold';
    (error as any).operator = 'stableVisualMatch';
    (error as any).stabilityAdjusted = actual.stabilityAdjusted;
    throw error;
  }
}