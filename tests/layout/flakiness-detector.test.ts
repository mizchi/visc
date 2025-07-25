import { describe, test, expect } from 'vitest';
import { detectFlakiness, generateFlakinessReport } from '../../src/layout/flakiness-detector.js';
import type { LayoutAnalysisResult, SemanticGroup } from '../../src/layout/extractor.js';

// テスト用のモックデータ作成
function createMockLayout(
  groups: Partial<SemanticGroup>[],
  viewport = { width: 1280, height: 720 }
): LayoutAnalysisResult {
  return {
    url: 'http://example.com',
    timestamp: new Date().toISOString(),
    viewport,
    semanticGroups: groups.map((g, i) => ({
      id: g.id || `group-${i}`,
      type: g.type || 'content',
      bounds: g.bounds || { x: 0, y: 0, width: 100, height: 100 },
      elements: g.elements || [],
      children: g.children || [],
      depth: g.depth || 0,
      label: g.label || `Group ${i}`,
      importance: g.importance || 50
    })),
    totalElements: groups.length,
    statistics: {
      groupCount: groups.length,
      patternCount: 0,
      interactiveElements: 0,
      accessibilityCount: 0
    }
  };
}

describe('フレーキーネス検出', () => {
  test('安定したレイアウトは0%のフレーキーネススコアを持つ', () => {
    const layout = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    // 同じレイアウトを3回
    const results = [layout, layout, layout];
    const analysis = detectFlakiness(results);
    
    expect(analysis.overallScore).toBe(0);
    expect(analysis.flakyElements).toHaveLength(0);
    expect(analysis.stableCount).toBe(2); // 2つの要素
    expect(analysis.unstableCount).toBe(0);
  });

  test('位置が変動する要素を検出する', () => {
    const results = [
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
      ]),
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 10, width: 1280, height: 60 } }
      ]),
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 5, width: 1280, height: 60 } }
      ]),
    ];
    
    const analysis = detectFlakiness(results);
    
    expect(analysis.overallScore).toBeGreaterThan(0);
    expect(analysis.flakyElements).toHaveLength(1);
    expect(analysis.flakyElements[0].flakinessType).toBe('position');
    expect(analysis.categorizedFlakiness.position).toHaveLength(1);
  });

  test('サイズが変動する要素を検出する', () => {
    const results = [
      createMockLayout([
        { type: 'section', bounds: { x: 0, y: 0, width: 1280, height: 500 } }
      ]),
      createMockLayout([
        { type: 'section', bounds: { x: 0, y: 0, width: 1280, height: 600 } }
      ]),
      createMockLayout([
        { type: 'section', bounds: { x: 0, y: 0, width: 1280, height: 550 } }
      ]),
    ];
    
    const analysis = detectFlakiness(results);
    
    expect(analysis.flakyElements).toHaveLength(1);
    expect(analysis.flakyElements[0].flakinessType).toBe('size');
    expect(analysis.categorizedFlakiness.size).toHaveLength(1);
  });

  test('コンテンツが変動する要素を検出する', () => {
    const results = [
      createMockLayout([
        { type: 'content', label: 'Hello World' }
      ]),
      createMockLayout([
        { type: 'content', label: 'Hello Universe' }
      ]),
      createMockLayout([
        { type: 'content', label: 'Hello World' }
      ]),
    ];
    
    const analysis = detectFlakiness(results);
    
    expect(analysis.flakyElements).toHaveLength(1);
    expect(analysis.flakyElements[0].flakinessType).toBe('content');
    expect(analysis.categorizedFlakiness.content).toHaveLength(1);
  });

  test('存在が不安定な要素を検出する', () => {
    const results = [
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
        { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
      ]),
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
        // section が存在しない
      ]),
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
        { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
      ]),
    ];
    
    const analysis = detectFlakiness(results);
    
    const existenceFlaky = analysis.flakyElements.find(
      e => e.variations.some(v => v.property === 'existence')
    );
    expect(existenceFlaky).toBeDefined();
    expect(existenceFlaky?.occurrenceRate).toBeCloseTo(0.67, 2);
  });

  test('複数の変動タイプを持つ要素を検出する', () => {
    const results = [
      createMockLayout([
        { type: 'interactive', bounds: { x: 0, y: 0, width: 100, height: 50 }, label: 'Button' }
      ]),
      createMockLayout([
        { type: 'interactive', bounds: { x: 10, y: 5, width: 120, height: 50 }, label: 'Click Me' }
      ]),
      createMockLayout([
        { type: 'interactive', bounds: { x: 5, y: 0, width: 110, height: 60 }, label: 'Button' }
      ]),
    ];
    
    const analysis = detectFlakiness(results);
    
    expect(analysis.flakyElements).toHaveLength(1);
    expect(analysis.flakyElements[0].flakinessType).toBe('mixed');
    expect(analysis.flakyElements[0].variations.length).toBeGreaterThan(2);
  });

  test('閾値内の変動は無視される', () => {
    const results = [
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
      ]),
      createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 2, width: 1280, height: 60 } }
      ]),
      createMockLayout([
        { type: 'navigation', bounds: { x: 1, y: 1, width: 1280, height: 60 } }
      ]),
    ];
    
    const analysis = detectFlakiness(results, { positionThreshold: 5 });
    
    expect(analysis.overallScore).toBe(0);
    expect(analysis.flakyElements).toHaveLength(0);
  });

  test('変動の統計情報が正しく計算される', () => {
    const results = [
      createMockLayout([
        { type: 'content', importance: 50 }
      ]),
      createMockLayout([
        { type: 'content', importance: 50 }
      ]),
      createMockLayout([
        { type: 'content', importance: 80 }
      ]),
      createMockLayout([
        { type: 'content', importance: 50 }
      ]),
    ];
    
    const analysis = detectFlakiness(results);
    
    const element = analysis.flakyElements[0];
    const importanceVariation = element.variations.find(v => v.property === 'importance');
    
    expect(importanceVariation).toBeDefined();
    expect(importanceVariation?.values).toHaveLength(2);
    
    // 値は文字列に変換されている
    const values = importanceVariation!.values;
    const value50 = values.find(v => v.value === '50');
    const value80 = values.find(v => v.value === '80');
    
    expect(value50).toBeDefined();
    expect(value80).toBeDefined();
    
    // 3つの50と1つの80があるが、比較時に各値が2回ずつ記録される
    // (比較の両側の値が記録されるため)
    const total = value50!.count + value80!.count;
    expect(total).toBeGreaterThanOrEqual(4);
    
    // 50の方が多い
    expect(value50!.count).toBeGreaterThan(value80!.count);
  });

  test('LayoutElement の変動も検出する', () => {
    const createLayoutWithElements = (x: number, text: string) => {
      const layout = createMockLayout([]);
      layout.elements = [{
        tagName: 'DIV',
        className: 'content',
        id: 'test',
        rect: { x, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: x },
        text,
        role: null,
        ariaLabel: null,
        ariaAttributes: {},
        isInteractive: false,
        hasParentWithSameSize: false,
        computedStyle: {
          display: 'block',
          position: 'static',
          zIndex: 'auto',
          backgroundColor: 'transparent',
          color: 'black',
          fontSize: '16px',
          fontWeight: 'normal'
        }
      }];
      return layout;
    };

    const results = [
      createLayoutWithElements(0, 'Hello'),
      createLayoutWithElements(10, 'Hello'),
      createLayoutWithElements(5, 'World'),
    ];
    
    const analysis = detectFlakiness(results);
    
    expect(analysis.flakyElements.length).toBeGreaterThan(0);
    // 位置とテキストの両方が変動
    const element = analysis.flakyElements[0];
    expect(element.variations.some(v => v.property === 'x')).toBe(true);
    expect(element.variations.some(v => v.property === 'text')).toBe(true);
  });

  test('最低2つの結果が必要', () => {
    const layout = createMockLayout([]);
    
    expect(() => detectFlakiness([layout])).toThrow('最低2つの結果が必要');
  });
});

describe('フレーキーネスレポート生成', () => {
  const mockAnalysis = {
    overallScore: 25.5,
    flakyElements: [
      {
        path: 'semanticGroup[0]',
        identifier: { type: 'navigation', label: 'Main Nav' },
        flakinessType: 'position' as const,
        score: 75,
        variations: [
          {
            property: 'y',
            values: [
              { value: 0, count: 2, percentage: 50 },
              { value: 10, count: 2, percentage: 50 }
            ],
            variance: 0.5
          }
        ],
        occurrenceCount: 4,
        occurrenceRate: 1
      }
    ],
    stableCount: 3,
    unstableCount: 1,
    sampleCount: 4,
    categorizedFlakiness: {
      position: [{
        path: 'semanticGroup[0]',
        identifier: { type: 'navigation', label: 'Main Nav' },
        flakinessType: 'position' as const,
        score: 75,
        variations: [],
        occurrenceCount: 4,
        occurrenceRate: 1
      }],
      size: [],
      content: [],
      existence: [],
      style: []
    }
  };

  test('テキスト形式のサマリーレポート', () => {
    const report = generateFlakinessReport(mockAnalysis, {
      verbosity: 'summary',
      format: 'text'
    });
    
    expect(report).toContain('フレーキーネス分析レポート');
    expect(report).toContain('全体スコア: 25.5%');
    expect(report).toContain('サンプル数: 4');
    expect(report).not.toContain('不安定な要素');
  });

  test('詳細なマークダウンレポート', () => {
    const report = generateFlakinessReport(mockAnalysis, {
      verbosity: 'detailed',
      format: 'markdown'
    });
    
    expect(report).toContain('# フレーキーネス分析レポート');
    expect(report).toContain('## 概要');
    expect(report).toContain('## カテゴリ別統計');
    expect(report).toContain('## 不安定な要素');
    expect(report).toContain('semanticGroup[0]');
    expect(report).toContain('**スコア**: 75.0%');
  });

  test('完全なJSONレポート', () => {
    const report = generateFlakinessReport(mockAnalysis, {
      format: 'json'
    });
    
    const parsed = JSON.parse(report);
    expect(parsed.overallScore).toBe(25.5);
    expect(parsed.flakyElements).toHaveLength(1);
    expect(parsed.sampleCount).toBe(4);
  });

  test('フルレポートには変動の詳細が含まれる', () => {
    const report = generateFlakinessReport(mockAnalysis, {
      verbosity: 'full',
      format: 'text'
    });
    
    expect(report).toContain('変動:');
    expect(report).toContain('y: 0 (50.0%), 10 (50.0%)');
  });
});