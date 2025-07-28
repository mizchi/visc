/**
 * V2 Stability Types - 安定性分析の型定義
 */

import { LayoutSummary } from '../types/index.js';

/**
 * 安定性分析のオプション
 */
export interface StabilityAnalysisOptions {
  minIterations?: number;
  maxIterations?: number;
  targetStability?: number;
  earlyStopThreshold?: number;
  delay?: number;
}

/**
 * 安定性の進捗状況
 */
export interface StabilityProgress {
  iteration: number;
  currentStability: number;
  unstableNodeCount: number;
  totalNodeCount: number;
  confidence: number;
  shouldContinue: boolean;
  reason?: string;
}

/**
 * ノードの変動情報
 */
export interface NodeVariation {
  nodeId: string;
  tagName: string;
  className?: string;
  variations: {
    position: { count: number; values: Array<{ x: number; y: number; width: number; height: number }> };
    text: { count: number; values: string[] };
    visibility: { count: number; values: boolean[] };
    importance: { count: number; values: number[] };
  };
  stabilityScore: number;
}

/**
 * 安定性分析の結果
 */
export interface StabilityAnalysisResult {
  totalNodes: number;
  stableNodes: number;
  unstableNodes: NodeVariation[];
  overallStabilityScore: number;
  iterations: number;
  recommendations: StabilityRecommendations;
  layoutSummaries: LayoutSummary[];
}

/**
 * 安定性に基づく推奨設定
 */
export interface StabilityRecommendations {
  confidenceLevel: number;
  pixelTolerance: number;
  percentageTolerance: number;
  ignoreSelectors: string[];
  ignoreAttributes: string[];
  unstableAreas: Array<{
    selector: string;
    reason: string;
    variationType: 'position' | 'text' | 'visibility' | 'mixed';
  }>;
}

/**
 * 適応的安定性チェックの設定
 */
export interface AdaptiveStabilityConfig {
  url: string;
  minIterations?: number;
  maxIterations?: number;
  viewport?: { width: number; height: number };
  outputDir?: string;
  delay?: number;
  targetStability?: number;
  earlyStopThreshold?: number;
}

/**
 * 最終的な安定性設定
 */
export interface FinalStabilityConfig {
  stability: {
    enabled: boolean;
    toleranceThreshold: number;
    percentageThreshold: number;
    ignoreSelectors: string[];
    ignoreAttributes: string[];
    overallStability: number;
    analysisDate: string;
    confidenceLevel: number;
    adaptiveAnalysis: {
      totalIterations: number;
      convergenceReason?: string;
      stabilityProgression: Array<{
        iteration: number;
        stability: number;
      }>;
    };
  };
  viewport: { width: number; height: number };
  metadata: {
    url: string;
    iterations: number;
    totalNodes: number;
    unstableNodes: number;
    analysisMethod: 'adaptive';
  };
}