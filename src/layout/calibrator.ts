/**
 * 比較設定の自動キャリブレーション機能
 */

import type { VisualTreeAnalysis } from "./extractor.js";
import { compareLayoutTrees } from "./comparator.js";
import { compareVisualNodeGroups } from "./visual-comparator.js";
import { detectFlakiness, type FlakyElement } from "./flakiness-detector.js";

export interface ComparisonSettings {
  positionTolerance: number; // 位置の許容誤差（ピクセル）
  sizeTolerance: number; // サイズの許容誤差（%）
  textSimilarityThreshold: number; // テキスト類似度の閾値
  importanceThreshold: number; // 重要度の閾値
  ignoreElements?: string[]; // 無視する要素のセレクタ
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
  dynamicElements?: DynamicElementInfo[];
}

export interface DynamicElementInfo {
  path: string;
  selector?: string;
  flakinessScore: number;
  changeFrequency: number;
  reason: 'position' | 'size' | 'content' | 'existence' | 'style' | 'mixed';
}

/**
 * 複数のレイアウトサンプルから最適な比較設定を自動生成
 */
export function calibrateComparisonSettings(
  samples: VisualTreeAnalysis[],
  options: {
    targetStability?: number; // 目標とする安定性（0-100）
    strictness?: "low" | "medium" | "high"; // 厳密さのレベル
    detectDynamicElements?: boolean; // 動的要素を検出するか
    dynamicThreshold?: number; // 動的とみなすフレーキーネススコアの閾値
  } = {}
): CalibrationResult {
  const { 
    targetStability = 95, 
    strictness = "medium",
    detectDynamicElements = true,
    dynamicThreshold = 50
  } = options;

  if (samples.length < 2) {
    throw new Error("At least 2 samples are required for calibration");
  }

  // サンプル間の差異を分析
  const variances = analyzeSampleVariances(samples);

  // 動的要素の検出
  let dynamicElements: DynamicElementInfo[] = [];
  let ignoreSelectors: string[] = [];
  
  if (detectDynamicElements) {
    const flakiness = detectFlakiness(samples);
    // console.log(`[Calibrator] Detected ${flakiness.flakyElements.length} flaky elements`);
    // console.log(`[Calibrator] Filtering with threshold: ${dynamicThreshold}%`);
    
    dynamicElements = flakiness.flakyElements
      .filter(elem => {
        // scoreプロパティを使用（flakinessScoreではない）
        const passesThreshold = elem.score >= dynamicThreshold;
        if (passesThreshold && elem.path.startsWith('visualNodeGroup')) {
          // console.log(`[Calibrator] Element ${elem.path} passes threshold with score ${elem.score}%`);
          // console.log(`[Calibrator] Identifier:`, JSON.stringify(elem.identifier));
        }
        return passesThreshold;
      })
      .map(elem => ({
        path: elem.path,
        selector: generateSelector(elem, samples),
        flakinessScore: elem.score, // scoreプロパティを使用
        changeFrequency: elem.changeFrequency,
        reason: elem.flakinessType
      }));
    
    // console.log(`[Calibrator] Dynamic elements after filtering: ${dynamicElements.length}`);
    if (dynamicElements.length > 0) {
      // console.log(`[Calibrator] First 5 dynamic elements:`, dynamicElements.slice(0, 5).map(e => ({
      //   path: e.path,
      //   selector: e.selector,
      //   score: e.flakinessScore.toFixed(1)
      // })));
    }
    
    // 動的要素のセレクタを生成
    ignoreSelectors = dynamicElements
      .filter(elem => elem.selector)
      .map(elem => elem.selector!);
    
    // console.log(`[Calibrator] Generated ${ignoreSelectors.length} ignore selectors`);
  }

  // 厳密さに基づいて基準値を調整
  const strictnessMultiplier = {
    low: 1.5,
    medium: 1.0,
    high: 0.7,
  }[strictness];

  // 統計に基づいて設定を生成（最小値を保証）
  const settings: ComparisonSettings = {
    positionTolerance: Math.max(
      2, // 最小値は2px
      Math.ceil(variances.maxPositionDrift * strictnessMultiplier)
    ),
    sizeTolerance: Math.max(
      5, // 最小値は5%
      Math.ceil(variances.maxSizeVariance * 100 * strictnessMultiplier)
    ),
    textSimilarityThreshold: Math.max(
      0.8,
      1 - variances.avgTextDissimilarity * strictnessMultiplier
    ),
    importanceThreshold: 10, // デフォルト値
    ignoreElements: ignoreSelectors.length > 0 ? ignoreSelectors : undefined
  };

  // 信頼度を計算（サンプル数と分散の安定性に基づく）
  const confidence = calculateConfidence(samples.length, variances);

  const result = {
    settings,
    confidence,
    sampleStats: {
      avgPositionVariance: variances.avgPositionDrift,
      avgSizeVariance: variances.avgSizeVariance * 100,
      avgTextSimilarity: 1 - variances.avgTextDissimilarity,
      stableElementRatio: variances.stableElementRatio,
    },
    dynamicElements: dynamicElements.length > 0 ? dynamicElements : undefined
  };
  
  // console.log(`[Calibrator] Returning result with ${result.dynamicElements?.length || 0} dynamic elements`);
  
  return result;
}

/**
 * キャリブレーションされた設定を使用して新しいレイアウトを検証
 */
export function validateWithSettings(
  layout: VisualTreeAnalysis,
  baseline: VisualTreeAnalysis,
  settings: ComparisonSettings
): ValidationResult {
  const comparison = compareLayoutTrees(baseline, layout);

  const violations: Violation[] = [];
  let totalScore = 0;
  let checkedElements = 0;

  // 各要素の差異をチェック
  comparison.differences.forEach((diff) => {
    checkedElements++;
    let elementScore = 100;

    // 位置の検証
    if (diff.type === "position" || diff.type === "both") {
      const positionDrift = Math.hypot(
        diff.changes.rect?.x || 0,
        diff.changes.rect?.y || 0
      );
      if (positionDrift > settings.positionTolerance) {
        violations.push({
          elementId: diff.elementId,
          type: "position",
          expected: settings.positionTolerance,
          actual: positionDrift,
          severity:
            positionDrift > settings.positionTolerance * 2 ? "high" : "medium",
        });
        elementScore -= 25;
      }
    }

    // サイズの検証
    if (diff.type === "size" || diff.type === "both") {
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
          type: "size",
          expected: settings.sizeTolerance,
          actual: maxSizeChange,
          severity:
            maxSizeChange > settings.sizeTolerance * 2 ? "high" : "medium",
        });
        elementScore -= 25;
      }
    }

    totalScore += elementScore;
  });

  const similarity = checkedElements > 0 ? totalScore / checkedElements : 100;

  return {
    isValid: violations.filter((v) => v.severity === "high").length === 0,
    similarity,
    violations,
    summary: {
      totalElements: comparison.summary.totalElements,
      changedElements: comparison.summary.totalChanged,
      criticalViolations: violations.filter((v) => v.severity === "high")
        .length,
      warnings: violations.filter((v) => v.severity === "medium").length,
    },
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

function analyzeSampleVariances(
  samples: VisualTreeAnalysis[]
): SampleVariances {
  const elementComparisons = [];
  const groupComparisons = [];

  // 全てのサンプルペアを比較
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      // 生の要素レベルでの比較（互換性のため）
      elementComparisons.push(compareLayoutTrees(samples[i], samples[j]));

      // セマンティックグループレベルでの比較
      if (samples[i].visualNodeGroups && samples[j].visualNodeGroups) {
        groupComparisons.push(compareVisualNodeGroups(samples[i], samples[j]));
      }
    }
  }

  // セマンティックグループからの統計を優先的に使用
  if (groupComparisons.length > 0) {
    let maxPosDrift = 0;
    let totalPosDrift = 0;
    let maxSizeVar = 0;
    let totalSizeVar = 0;
    let changeCount = 0;

    groupComparisons.forEach((comp) => {
      comp.differences.forEach((diff) => {
        if (diff.type === "moved" || diff.type === "modified") {
          const xChange = Math.abs(
            (diff.changes?.bounds?.x || 0) - (diff.oldGroup?.bounds.x || 0)
          );
          const yChange = Math.abs(
            (diff.changes?.bounds?.y || 0) - (diff.oldGroup?.bounds.y || 0)
          );
          const drift = Math.hypot(xChange, yChange);

          maxPosDrift = Math.max(maxPosDrift, drift);
          totalPosDrift += drift;
          changeCount++;
        }

        if (diff.type === "resized" || diff.type === "modified") {
          const oldWidth = diff.oldGroup?.bounds.width || 1;
          const oldHeight = diff.oldGroup?.bounds.height || 1;
          const newWidth = diff.newGroup?.bounds.width || oldWidth;
          const newHeight = diff.newGroup?.bounds.height || oldHeight;

          const widthVar = Math.abs(newWidth - oldWidth) / oldWidth;
          const heightVar = Math.abs(newHeight - oldHeight) / oldHeight;
          const sizeVar = Math.max(widthVar, heightVar);

          maxSizeVar = Math.max(maxSizeVar, sizeVar);
          totalSizeVar += sizeVar;
        }
      });
    });

    // グループレベルの安定性を計算
    const avgSimilarity =
      groupComparisons.reduce((sum, comp) => sum + comp.similarity, 0) /
      groupComparisons.length;

    return {
      maxPositionDrift: maxPosDrift,
      avgPositionDrift: changeCount > 0 ? totalPosDrift / changeCount : 0,
      maxSizeVariance: maxSizeVar,
      avgSizeVariance: changeCount > 0 ? totalSizeVar / changeCount : 0,
      avgTextDissimilarity: 0.05, // グループレベルではテキストの変動は少ない
      stableElementRatio: avgSimilarity / 100,
    };
  }

  // フォールバック: 要素レベルの統計を使用
  let maxPosDrift = 0;
  let totalPosDrift = 0;
  let maxSizeVar = 0;
  let totalSizeVar = 0;
  let driftCount = 0;

  elementComparisons.forEach((comp) => {
    comp.differences.forEach((diff) => {
      if (diff.type === "position" || diff.type === "both") {
        const drift = Math.hypot(
          diff.changes.rect?.x || 0,
          diff.changes.rect?.y || 0
        );
        maxPosDrift = Math.max(maxPosDrift, drift);
        totalPosDrift += drift;
        driftCount++;
      }

      if (diff.type === "size" || diff.type === "both") {
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
    avgTextDissimilarity: 0.1,
    stableElementRatio: 0.9,
  };
}

function calculateConfidence(
  sampleCount: number,
  variances: SampleVariances
): number {
  // サンプル数による基本信頼度
  const sampleConfidence = Math.min(100, sampleCount * 10);

  // 分散の安定性による調整
  const varianceStability =
    100 - (variances.avgPositionDrift * 2 + variances.avgSizeVariance * 100);

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
  type: "position" | "size" | "text" | "visibility";
  expected: number;
  actual: number;
  severity: "low" | "medium" | "high";
}

/**
 * フレーキーな要素からCSSセレクタを生成
 */
function generateSelector(
  flakyElement: FlakyElement,
  samples: VisualTreeAnalysis[]
): string | undefined {
  // パスから要素情報を取得
  const identifier = flakyElement.identifier;
  
  // visualNodeGroupの場合
  if (flakyElement.path.startsWith("visualNodeGroup")) {
    // visualNodeGroup配下の要素の場合、通常の要素として処理
    if (identifier.tagName || identifier.id || identifier.className) {
      // 通常の要素処理にフォールスルー
    } else if (identifier.label) {
      // セマンティックグループ自体の場合
      return `[data-visual-label="${identifier.label}"]`;
    } else {
      return undefined;
    }
  }
  
  // 通常の要素の場合
  const parts: string[] = [];
  
  if (identifier.tagName) {
    parts.push(identifier.tagName.toLowerCase());
  }
  
  if (identifier.id) {
    parts.push(`#${identifier.id}`);
  }
  
  if (identifier.className) {
    // クラス名をスペースで分割して最初のクラスを使用
    const classes = identifier.className.split(' ').filter(c => c);
    if (classes.length > 0) {
      parts.push(`.${classes[0]}`);
    }
  }
  
  // セレクタが生成できない場合はundefined
  if (parts.length === 0) {
    return undefined;
  }
  
  return parts.join('');
}
