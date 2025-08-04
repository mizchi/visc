/**
 * フレーキーネス検出機能
 * 
 * 複数回のクロール結果を分析して、不安定な要素を特定します。
 */

import type { LayoutAnalysisResult, SemanticGroup, LayoutElement } from "./extractor.js";
import { compareLayouts } from "./comparator.js";

export interface FlakinessAnalysis {
  /** 全体のフレーキーネススコア (0-100, 0が最も安定) */
  overallScore: number;
  /** フレーキーな要素のリスト */
  flakyElements: FlakyElement[];
  /** 安定している要素の数 */
  stableCount: number;
  /** 不安定な要素の数 */
  unstableCount: number;
  /** 分析に使用されたサンプル数 */
  sampleCount: number;
  /** カテゴリ別のフレーキーネス統計 */
  categorizedFlakiness: {
    position: FlakyElement[];
    size: FlakyElement[];
    content: FlakyElement[];
    existence: FlakyElement[];
    style: FlakyElement[];
  };
}

export interface FlakyElement {
  /** 要素のパス */
  path: string;
  /** 要素の識別情報 */
  identifier: {
    type?: string;
    tagName?: string;
    id?: string;
    className?: string;
    label?: string;
  };
  /** フレーキーネスの種類 */
  flakinessType: 'position' | 'size' | 'content' | 'existence' | 'style' | 'mixed';
  /** フレーキーネススコア (0-100) */
  score: number;
  /** 変動の詳細 */
  variations: VariationDetail[];
  /** 出現回数 */
  occurrenceCount: number;
  /** 全体に対する出現率 */
  occurrenceRate: number;
}

export interface VariationDetail {
  property: string;
  values: Array<{
    value: unknown;
    count: number;
    percentage: number;
  }>;
  variance?: number;
}

interface ElementTracker {
  path: string;
  identifier: any;
  occurrences: Map<string, any[]>; // property -> values
  appearanceCount: number;
}

/**
 * 複数のレイアウト分析結果からフレーキーネスを検出
 */
export function detectFlakiness(
  results: LayoutAnalysisResult[],
  options: {
    /** 位置の変動を検出する閾値（ピクセル） */
    positionThreshold?: number;
    /** サイズの変動を検出する閾値（ピクセル） */
    sizeThreshold?: number;
    /** フレーキーと判定する変動率の閾値（0-1） */
    flakinessThreshold?: number;
    /** テキストの変更を無視 */
    ignoreText?: boolean;
    /** スタイルの変更を無視 */
    ignoreStyle?: boolean;
  } = {}
): FlakinessAnalysis {
  const {
    positionThreshold = 5,
    sizeThreshold = 5,
    flakinessThreshold = 0.2,
    ignoreText = false,
    ignoreStyle = false,
  } = options;

  if (results.length < 2) {
    throw new Error("フレーキーネス検出には最低2つの結果が必要です");
  }

  const elementTrackers = new Map<string, ElementTracker>();
  const sampleCount = results.length;

  // 全ての結果を比較して要素の変動を追跡
  for (let i = 0; i < results.length; i++) {
    trackElements(results[i], elementTrackers, i);
    
    // 他の全ての結果と比較
    for (let j = i + 1; j < results.length; j++) {
      const comparison = compareLayouts(results[i], results[j], {
        threshold: Math.min(positionThreshold, sizeThreshold),
        ignoreText,
        ignoreStyle,
      });

      // 差分を追跡
      comparison.differences.forEach(diff => {
        updateTrackerWithDifference(elementTrackers, diff, i, j);
      });
    }
  }

  // フレーキーな要素を分析
  const flakyElements: FlakyElement[] = [];
  const categorized = {
    position: [] as FlakyElement[],
    size: [] as FlakyElement[],
    content: [] as FlakyElement[],
    existence: [] as FlakyElement[],
    style: [] as FlakyElement[],
  };

  elementTrackers.forEach((tracker, path) => {
    const analysis = analyzeElementFlakiness(
      tracker,
      sampleCount,
      { positionThreshold, sizeThreshold, flakinessThreshold }
    );

    if (analysis && analysis.score > 0) {
      flakyElements.push(analysis);
      
      // カテゴリ分け
      if (analysis.flakinessType !== 'mixed') {
        categorized[analysis.flakinessType].push(analysis);
      } else {
        // mixed の場合は最も変動が大きいカテゴリに分類
        const mainType = determineMainFlakinessType(analysis.variations);
        categorized[mainType].push(analysis);
      }
    }
  });

  // フレーキーネススコアの計算
  const unstableCount = flakyElements.length;
  const totalElements = elementTrackers.size;
  const stableCount = totalElements - unstableCount;
  const overallScore = totalElements > 0 
    ? (unstableCount / totalElements) * 100 
    : 0;

  return {
    overallScore,
    flakyElements: flakyElements.sort((a, b) => b.score - a.score),
    stableCount,
    unstableCount,
    sampleCount,
    categorizedFlakiness: categorized,
  };
}

/**
 * レイアウト結果から要素を追跡
 */
function trackElements(
  result: LayoutAnalysisResult,
  trackers: Map<string, ElementTracker>,
  resultIndex: number
): void {
  // SemanticGroups を追跡
  if (result.semanticGroups) {
    result.semanticGroups.forEach((group, index) => {
      trackSemanticGroup(group, `semanticGroup[${index}]`, trackers, resultIndex);
    });
  }

  // LayoutElements を追跡
  if (result.elements) {
    result.elements.forEach((element, index) => {
      trackLayoutElement(element, `element[${index}]`, trackers, resultIndex);
    });
  }
}

/**
 * SemanticGroupを再帰的に追跡
 */
function trackSemanticGroup(
  group: SemanticGroup,
  path: string,
  trackers: Map<string, ElementTracker>,
  resultIndex: number
): void {
  let tracker = trackers.get(path);
  if (!tracker) {
    tracker = {
      path,
      identifier: {
        type: group.type,
        id: group.id,
        label: group.label,
      },
      occurrences: new Map(),
      appearanceCount: 0,
    };
    trackers.set(path, tracker);
  }

  tracker.appearanceCount++;
  
  // プロパティを記録
  recordProperty(tracker, 'x', group.bounds.x);
  recordProperty(tracker, 'y', group.bounds.y);
  recordProperty(tracker, 'width', group.bounds.width);
  recordProperty(tracker, 'height', group.bounds.height);
  recordProperty(tracker, 'importance', group.importance);
  recordProperty(tracker, 'label', group.label);

  // 子要素を再帰的に追跡
  if (group.children) {
    group.children.forEach((child, index) => {
      trackSemanticGroup(child, `${path}/child[${index}]`, trackers, resultIndex);
    });
  }
}

/**
 * LayoutElementを追跡
 */
function trackLayoutElement(
  element: LayoutElement,
  path: string,
  trackers: Map<string, ElementTracker>,
  resultIndex: number
): void {
  let tracker = trackers.get(path);
  if (!tracker) {
    tracker = {
      path,
      identifier: {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
      },
      occurrences: new Map(),
      appearanceCount: 0,
    };
    trackers.set(path, tracker);
  }

  tracker.appearanceCount++;
  
  // プロパティを記録
  recordProperty(tracker, 'x', element.rect.x);
  recordProperty(tracker, 'y', element.rect.y);
  recordProperty(tracker, 'width', element.rect.width);
  recordProperty(tracker, 'height', element.rect.height);
  if (element.text !== undefined) {
    recordProperty(tracker, 'text', element.text);
  }
  if (element.computedStyle?.fontSize) {
    recordProperty(tracker, 'fontSize', element.computedStyle.fontSize);
  }
}

/**
 * プロパティの値を記録
 */
function recordProperty(tracker: ElementTracker, property: string, value: unknown): void {
  if (!tracker.occurrences.has(property)) {
    tracker.occurrences.set(property, []);
  }
  tracker.occurrences.get(property)!.push(value);
}

/**
 * 差分情報でトラッカーを更新
 */
function updateTrackerWithDifference(
  trackers: Map<string, ElementTracker>,
  diff: any,
  index1: number,
  index2: number
): void {
  const tracker = trackers.get(diff.path);
  if (!tracker) return;

  // 変更の詳細を記録
  if (diff.changes) {
    diff.changes.forEach((change: any) => {
      recordProperty(tracker, change.property, change.before);
      recordProperty(tracker, change.property, change.after);
    });
  }
}

/**
 * 要素のフレーキーネスを分析
 */
function analyzeElementFlakiness(
  tracker: ElementTracker,
  totalSamples: number,
  options: {
    positionThreshold: number;
    sizeThreshold: number;
    flakinessThreshold: number;
  }
): FlakyElement | null {
  const variations: VariationDetail[] = [];
  let flakinessTypes = new Set<string>();
  let totalScore = 0;
  let propertyCount = 0;

  // 各プロパティの変動を分析
  tracker.occurrences.forEach((values, property) => {
    const analysis = analyzePropertyVariation(values, property, options);
    if (analysis && analysis.variance! > options.flakinessThreshold) {
      variations.push(analysis);
      flakinessTypes.add(getPropertyCategory(property));
      totalScore += analysis.variance! * 100;
      propertyCount++;
    }
  });

  // 存在の不安定性をチェック
  const occurrenceRate = tracker.appearanceCount / totalSamples;
  if (occurrenceRate < 1 && occurrenceRate > 0) {
    flakinessTypes.add('existence');
    variations.push({
      property: 'existence',
      values: [
        { value: 'present', count: tracker.appearanceCount, percentage: occurrenceRate * 100 },
        { value: 'absent', count: totalSamples - tracker.appearanceCount, percentage: (1 - occurrenceRate) * 100 }
      ],
      variance: 1 - occurrenceRate,
    });
    totalScore += (1 - occurrenceRate) * 100;
    propertyCount++;
  }

  if (variations.length === 0) {
    return null;
  }

  // フレーキーネスタイプの決定
  let flakinessType: FlakyElement['flakinessType'];
  if (flakinessTypes.size === 1) {
    flakinessType = Array.from(flakinessTypes)[0] as FlakyElement['flakinessType'];
  } else {
    flakinessType = 'mixed';
  }

  return {
    path: tracker.path,
    identifier: tracker.identifier,
    flakinessType,
    score: propertyCount > 0 ? totalScore / propertyCount : 0,
    variations,
    occurrenceCount: tracker.appearanceCount,
    occurrenceRate,
  };
}

/**
 * プロパティの変動を分析
 */
function analyzePropertyVariation(
  values: unknown[],
  property: string,
  options: {
    positionThreshold: number;
    sizeThreshold: number;
  }
): VariationDetail | null {
  const valueMap = new Map<string, number>();
  
  // 値をグループ化（数値の場合は閾値を考慮）
  values.forEach(value => {
    const key = normalizeValue(value, property, options);
    valueMap.set(key, (valueMap.get(key) || 0) + 1);
  });

  // 単一の値しかない場合は変動なし
  if (valueMap.size <= 1) {
    return null;
  }

  const total = values.length;
  const valueStats = Array.from(valueMap.entries()).map(([value, count]) => ({
    value: value === 'null' ? null : value,
    count,
    percentage: (count / total) * 100,
  }));

  // 分散を計算（最も頻度の高い値からの偏差）
  const maxCount = Math.max(...valueStats.map(v => v.count));
  const variance = 1 - (maxCount / total);

  return {
    property,
    values: valueStats.sort((a, b) => b.count - a.count),
    variance,
  };
}

/**
 * 値を正規化（閾値を考慮）
 */
function normalizeValue(
  value: unknown,
  property: string,
  options: { positionThreshold: number; sizeThreshold: number }
): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  // 数値プロパティの場合
  if (typeof value === 'number' && ['x', 'y', 'width', 'height'].includes(property)) {
    const threshold = ['x', 'y'].includes(property) 
      ? options.positionThreshold 
      : options.sizeThreshold;
    
    // 閾値でグループ化
    return String(Math.round(value / threshold) * threshold);
  }

  return String(value);
}

/**
 * プロパティのカテゴリを取得
 */
function getPropertyCategory(property: string): 'position' | 'size' | 'content' | 'style' {
  if (['x', 'y'].includes(property)) return 'position';
  if (['width', 'height'].includes(property)) return 'size';
  if (['text', 'label'].includes(property)) return 'content';
  return 'style';
}

/**
 * 主要なフレーキーネスタイプを決定
 */
function determineMainFlakinessType(
  variations: VariationDetail[]
): 'position' | 'size' | 'content' | 'existence' | 'style' {
  const categoryScores = {
    position: 0,
    size: 0,
    content: 0,
    existence: 0,
    style: 0,
  };

  variations.forEach(v => {
    const category = v.property === 'existence' 
      ? 'existence' 
      : getPropertyCategory(v.property);
    categoryScores[category] += v.variance || 0;
  });

  return Object.entries(categoryScores)
    .sort(([, a], [, b]) => b - a)[0][0] as any;
}

/**
 * フレーキーネスレポートを生成
 */
export function generateFlakinessReport(
  analysis: FlakinessAnalysis,
  options: {
    /** 詳細レベル */
    verbosity?: 'summary' | 'detailed' | 'full';
    /** フォーマット */
    format?: 'text' | 'json' | 'markdown';
  } = {}
): string {
  const { verbosity = 'detailed', format = 'text' } = options;

  if (format === 'json') {
    return JSON.stringify(analysis, null, 2);
  }

  const lines: string[] = [];

  if (format === 'markdown') {
    lines.push('# フレーキーネス分析レポート');
    lines.push('');
    lines.push(`## 概要`);
    lines.push(`- **全体スコア**: ${analysis.overallScore.toFixed(1)}% (0%が最も安定)`);
    lines.push(`- **サンプル数**: ${analysis.sampleCount}`);
    lines.push(`- **安定要素**: ${analysis.stableCount}`);
    lines.push(`- **不安定要素**: ${analysis.unstableCount}`);
    lines.push('');
    
    if (verbosity !== 'summary') {
      lines.push('## カテゴリ別統計');
      Object.entries(analysis.categorizedFlakiness).forEach(([category, elements]) => {
        if (elements.length > 0) {
          lines.push(`- **${category}**: ${elements.length}要素`);
        }
      });
      lines.push('');
    }

    if (verbosity === 'detailed' || verbosity === 'full') {
      lines.push('## 不安定な要素 (上位10件)');
      const topElements = analysis.flakyElements.slice(0, 10);
      topElements.forEach((element, index) => {
        lines.push(`### ${index + 1}. ${element.path}`);
        lines.push(`- **スコア**: ${element.score.toFixed(1)}%`);
        lines.push(`- **タイプ**: ${element.flakinessType}`);
        lines.push(`- **出現率**: ${element.occurrenceRate * 100}%`);
        
        if (verbosity === 'full') {
          lines.push('- **変動**:');
          element.variations.forEach(v => {
            lines.push(`  - ${v.property}: ${v.values.map(val => 
              `${val.value} (${val.percentage.toFixed(1)}%)`
            ).join(', ')}`);
          });
        }
        lines.push('');
      });
    }
  } else {
    // テキスト形式
    lines.push('=== フレーキーネス分析レポート ===');
    lines.push(`全体スコア: ${analysis.overallScore.toFixed(1)}% (0%が最も安定)`);
    lines.push(`サンプル数: ${analysis.sampleCount}`);
    lines.push(`安定要素: ${analysis.stableCount}`);
    lines.push(`不安定要素: ${analysis.unstableCount}`);
    lines.push('');
    
    if (verbosity !== 'summary') {
      lines.push('カテゴリ別:');
      Object.entries(analysis.categorizedFlakiness).forEach(([category, elements]) => {
        if (elements.length > 0) {
          lines.push(`  ${category}: ${elements.length}要素`);
        }
      });
      lines.push('');
    }

    if (verbosity === 'detailed' || verbosity === 'full') {
      lines.push('不安定な要素 (上位10件):');
      const topElements = analysis.flakyElements.slice(0, 10);
      topElements.forEach((element, index) => {
        lines.push(`${index + 1}. ${element.path}`);
        lines.push(`   スコア: ${element.score.toFixed(1)}%`);
        lines.push(`   タイプ: ${element.flakinessType}`);
        lines.push(`   出現率: ${(element.occurrenceRate * 100).toFixed(1)}%`);
        
        if (verbosity === 'full' && element.variations.length > 0) {
          lines.push('   変動:');
          element.variations.forEach(v => {
            const valuesStr = v.values
              .slice(0, 3)
              .map(val => `${val.value} (${val.percentage.toFixed(1)}%)`)
              .join(', ');
            lines.push(`     ${v.property}: ${valuesStr}`);
          });
        }
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}