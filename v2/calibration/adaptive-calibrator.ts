/**
 * 比較設定の自動キャリブレーション機能
 */

import type { LayoutAnalysisResult } from '../layout/extractor.js';
import { compareLayouts } from '../layout/comparator-v2.js';

export interface ComparisonSettings {
  positionTolerance: number;      // 位置の許容誤差（ピクセル）
  sizeTolerance: number;          // サイズの許容誤差（%）
  textSimilarityThreshold: number; // テキスト類似度の閾値
  importanceThreshold: number;     // 重要度の閾値
  ignoreElements?: string[];       // 無視する要素のセレクタ
}

export interface CalibrationResult {
  settings: ComparisonSettings;
  confidence: number;
  sampleStats: {
    avgPositionVariance: number;
    avgSizeVariance: number;
    avgTextSimilarity: number;
    stableElementRatio: number;
  };
}

/**
 * 複数のレイアウトサンプルから最適な比較設定を自動生成
 */
export function calibrateComparisonSettings(
  samples: LayoutAnalysisResult[],
  options: {
    targetStability?: number;  // 目標とする安定性（0-100）
    strictness?: 'low' | 'medium' | 'high';  // 厳密さのレベル
  } = {}
): CalibrationResult {
  const { targetStability = 95, strictness = 'medium' } = options;
  
  if (samples.length < 2) {
    throw new Error('At least 2 samples are required for calibration');
  }

  // サンプル間の差異を分析
  const variances = analyzeSampleVariances(samples);
  
  // 厳密さに基づいて基準値を調整
  const strictnessMultiplier = {
    low: 1.5,
    medium: 1.0,
    high: 0.7
  }[strictness];

  // 統計に基づいて設定を生成
  const settings: ComparisonSettings = {
    positionTolerance: Math.ceil(variances.maxPositionDrift * strictnessMultiplier),
    sizeTolerance: Math.ceil(variances.maxSizeVariance * 100 * strictnessMultiplier),
    textSimilarityThreshold: Math.max(0.8, 1 - (variances.avgTextDissimilarity * strictnessMultiplier)),
    importanceThreshold: 10,  // デフォルト値
  };

  // 信頼度を計算（サンプル数と分散の安定性に基づく）
  const confidence = calculateConfidence(samples.length, variances);

  return {
    settings,
    confidence,
    sampleStats: {
      avgPositionVariance: variances.avgPositionDrift,
      avgSizeVariance: variances.avgSizeVariance * 100,
      avgTextSimilarity: 1 - variances.avgTextDissimilarity,
      stableElementRatio: variances.stableElementRatio,
    }
  };
}

/**
 * キャリブレーションされた設定を使用して新しいレイアウトを検証
 */
export function validateWithSettings(
  layout: LayoutAnalysisResult,
  baseline: LayoutAnalysisResult,
  settings: ComparisonSettings
): ValidationResult {
  const comparison = compareLayouts(baseline, layout);
  
  const violations: Violation[] = [];
  let totalScore = 0;
  let checkedElements = 0;

  // 各要素の差異をチェック
  comparison.differences.forEach(diff => {
    checkedElements++;
    let elementScore = 100;

    // 位置の検証
    if (diff.type === 'position' || diff.type === 'both') {
      const positionDrift = Math.hypot(
        diff.changes.rect?.x || 0,
        diff.changes.rect?.y || 0
      );
      if (positionDrift > settings.positionTolerance) {
        violations.push({
          elementId: diff.elementId,
          type: 'position',
          expected: settings.positionTolerance,
          actual: positionDrift,
          severity: positionDrift > settings.positionTolerance * 2 ? 'high' : 'medium'
        });
        elementScore -= 25;
      }
    }

    // サイズの検証
    if (diff.type === 'size' || diff.type === 'both') {
      const widthDiff = Math.abs(diff.changes.rect?.width || 0);
      const heightDiff = Math.abs(diff.changes.rect?.height || 0);
      const oldWidth = diff.oldValue.rect?.width || 1;
      const oldHeight = diff.oldValue.rect?.height || 1;
      const widthChangeRatio = widthDiff / oldWidth;
      const heightChangeRatio = heightDiff / oldHeight;
      const maxSizeChange = Math.max(widthChangeRatio, heightChangeRatio) * 100;
      
      if (maxSizeChange > settings.sizeTolerance) {
        violations.push({
          elementId: diff.elementId,
          type: 'size',
          expected: settings.sizeTolerance,
          actual: maxSizeChange,
          severity: maxSizeChange > settings.sizeTolerance * 2 ? 'high' : 'medium'
        });
        elementScore -= 25;
      }
    }

    totalScore += elementScore;
  });

  const similarity = checkedElements > 0 ? totalScore / checkedElements : 100;

  return {
    isValid: violations.filter(v => v.severity === 'high').length === 0,
    similarity,
    violations,
    summary: {
      totalElements: comparison.summary.totalElements,
      changedElements: comparison.summary.totalChanged,
      criticalViolations: violations.filter(v => v.severity === 'high').length,
      warnings: violations.filter(v => v.severity === 'medium').length,
    }
  };
}

// 内部ヘルパー関数

interface SampleVariances {
  maxPositionDrift: number;
  avgPositionDrift: number;
  maxSizeVariance: number;
  avgSizeVariance: number;
  avgTextDissimilarity: number;
  stableElementRatio: number;
}

function analyzeSampleVariances(samples: LayoutAnalysisResult[]): SampleVariances {
  const comparisons = [];
  
  // 全てのサンプルペアを比較
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      comparisons.push(compareLayouts(samples[i], samples[j]));
    }
  }

  // 各比較から統計を収集
  let maxPosDrift = 0;
  let totalPosDrift = 0;
  let maxSizeVar = 0;
  let totalSizeVar = 0;
  let driftCount = 0;

  comparisons.forEach(comp => {
    comp.differences.forEach(diff => {
      if (diff.type === 'position' || diff.type === 'both') {
        const drift = Math.hypot(
          diff.changes.rect?.x || 0,
          diff.changes.rect?.y || 0
        );
        maxPosDrift = Math.max(maxPosDrift, drift);
        totalPosDrift += drift;
        driftCount++;
      }
      
      if (diff.type === 'size' || diff.type === 'both') {
        const widthChange = diff.changes.rect?.width || 0;
        const heightChange = diff.changes.rect?.height || 0;
        const oldWidth = diff.oldValue.rect?.width || 1;
        const oldHeight = diff.oldValue.rect?.height || 1;
        const sizeVar = Math.max(
          Math.abs(widthChange / oldWidth),
          Math.abs(heightChange / oldHeight)
        );
        maxSizeVar = Math.max(maxSizeVar, sizeVar);
        totalSizeVar += sizeVar;
      }
    });
  });

  return {
    maxPositionDrift: maxPosDrift,
    avgPositionDrift: driftCount > 0 ? totalPosDrift / driftCount : 0,
    maxSizeVariance: maxSizeVar,
    avgSizeVariance: driftCount > 0 ? totalSizeVar / driftCount : 0,
    avgTextDissimilarity: 0.1,  // TODO: テキスト類似度の実装
    stableElementRatio: 0.9,    // TODO: 安定要素の割合の実装
  };
}

function calculateConfidence(sampleCount: number, variances: SampleVariances): number {
  // サンプル数による基本信頼度
  const sampleConfidence = Math.min(100, sampleCount * 10);
  
  // 分散の安定性による調整
  const varianceStability = 100 - (variances.avgPositionDrift * 2 + variances.avgSizeVariance * 100);
  
  return Math.max(0, Math.min(100, (sampleConfidence + varianceStability) / 2));
}

// 型定義

export interface ValidationResult {
  isValid: boolean;
  similarity: number;
  violations: Violation[];
  summary: {
    totalElements: number;
    changedElements: number;
    criticalViolations: number;
    warnings: number;
  };
}

interface Violation {
  elementId: string;
  type: 'position' | 'size' | 'text' | 'visibility';
  expected: number;
  actual: number;
  severity: 'low' | 'medium' | 'high';
}