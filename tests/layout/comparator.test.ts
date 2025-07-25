import { describe, test, expect } from 'vitest';
import { compareLayouts, hasLayoutChanged, isLayoutSimilar } from '../../src/layout/comparator.js';
import type { LayoutAnalysisResult, SemanticGroup } from '../../src/layout/extractor.js';

// テスト用のモックデータ作成
function createMockLayout(groups: Partial<SemanticGroup>[]): LayoutAnalysisResult {
  return {
    url: 'http://example.com',
    timestamp: new Date().toISOString(),
    viewport: { width: 1280, height: 720 },
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

describe('レイアウト比較関数', () => {
  test('同一のレイアウトを比較すると100%の類似度になる', () => {
    const layout = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const result = compareLayouts(layout, layout);
    
    expect(result.identical).toBe(true);
    expect(result.similarity).toBe(100);
    expect(result.differences).toHaveLength(0);
  });

  test('要素が追加された場合を検出する', () => {
    const baseline = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const current = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const result = compareLayouts(baseline, current);
    
    expect(result.identical).toBe(false);
    expect(result.summary.added).toBe(1);
    expect(result.differences[0].type).toBe('added');
  });

  test('要素が削除された場合を検出する', () => {
    const baseline = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const current = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const result = compareLayouts(baseline, current);
    
    expect(result.identical).toBe(false);
    expect(result.summary.removed).toBe(1);
    expect(result.differences[0].type).toBe('removed');
  });

  test('要素の位置が変更された場合を検出する', () => {
    const baseline = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const current = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 10, width: 1280, height: 60 } }
    ]);
    
    const result = compareLayouts(baseline, current);
    
    expect(result.identical).toBe(false);
    expect(result.summary.moved).toBe(1);
    expect(result.differences[0].type).toBe('moved');
    expect(result.differences[0].changes).toContainEqual({
      property: 'y',
      before: 0,
      after: 10
    });
  });

  test('要素のサイズが変更された場合を検出する', () => {
    const baseline = createMockLayout([
      { type: 'section', bounds: { x: 0, y: 0, width: 1280, height: 500 } }
    ]);
    
    const current = createMockLayout([
      { type: 'section', bounds: { x: 0, y: 0, width: 1280, height: 600 } }
    ]);
    
    const result = compareLayouts(baseline, current);
    
    expect(result.identical).toBe(false);
    expect(result.summary.modified).toBe(1);
    expect(result.differences[0].changes).toContainEqual({
      property: 'height',
      before: 500,
      after: 600
    });
  });

  test('閾値内の変更は無視される', () => {
    const baseline = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const current = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 1, width: 1280, height: 60 } }
    ]);
    
    const result = compareLayouts(baseline, current, { threshold: 2 });
    
    expect(result.identical).toBe(true);
    expect(result.similarity).toBe(100);
  });

  test('重要度の変化を検出する', () => {
    const baseline = createMockLayout([
      { type: 'section', importance: 50, bounds: { x: 0, y: 0, width: 100, height: 100 } }
    ]);
    
    const current = createMockLayout([
      { type: 'section', importance: 80, bounds: { x: 0, y: 0, width: 100, height: 100 } }
    ]);
    
    const result = compareLayouts(baseline, current);
    
    expect(result.identical).toBe(false);
    expect(result.differences[0].changes).toContainEqual({
      property: 'importance',
      before: 50,
      after: 80
    });
  });
});

describe('ヘルパー関数', () => {
  test('hasLayoutChangedが正しく動作する', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    expect(hasLayoutChanged(layout1, layout1)).toBe(false);
    expect(hasLayoutChanged(layout1, layout2)).toBe(true);
  });

  test('isLayoutSimilarが正しく動作する', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 }, label: 'Nav' }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 5, width: 1280, height: 60 }, label: 'Nav' }
    ]);
    
    // 小さな位置の変更は高い類似度を保つべき
    const result = compareLayouts(layout1, layout2);
    console.log('Similarity:', result.similarity, 'Differences:', result.differences);
    
    expect(isLayoutSimilar(layout1, layout2, 80)).toBe(true);
    expect(isLayoutSimilar(layout1, layout2, 100)).toBe(false);
  });

  test('複数の変更タイプが混在する場合を正しく検出する', () => {
    const baseline = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } },
      { type: 'container', bounds: { x: 0, y: 560, width: 1280, height: 200 } }
    ]);
    
    const current = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 10, width: 1280, height: 60 } }, // moved
      { type: 'section', bounds: { x: 0, y: 70, width: 1280, height: 400 } }, // modified (位置とサイズ)
      { type: 'interactive', bounds: { x: 500, y: 1200, width: 600, height: 300 } } // added (container removed - 完全に異なる位置とサイズ)
    ]);
    
    const result = compareLayouts(baseline, current);
    
    expect(result.identical).toBe(false);
    expect(result.summary.moved).toBeGreaterThanOrEqual(1);
    expect(result.summary.modified).toBeGreaterThanOrEqual(1);
    expect(result.summary.added).toBeGreaterThanOrEqual(1);
    expect(result.summary.removed).toBeGreaterThanOrEqual(1);
  });

  test('オプションでテキストとスタイルの変更を無視できる', () => {
    const baseline = createMockLayout([
      { 
        type: 'content', 
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        label: 'Original Text'
      }
    ]);
    
    const current = createMockLayout([
      { 
        type: 'content', 
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        label: 'Modified Text'
      }
    ]);
    
    // テキストの変更を無視
    const resultIgnoreText = compareLayouts(baseline, current, { ignoreText: true });
    expect(resultIgnoreText.identical).toBe(true);
    
    // テキストの変更を無視しない
    const resultWithText = compareLayouts(baseline, current, { ignoreText: false });
    expect(resultWithText.identical).toBe(false);
  });

  test('類似度スコアが適切に計算される', () => {
    // 完全に同じレイアウト
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const result1 = compareLayouts(layout1, layout1);
    expect(result1.similarity).toBe(100);
    
    // 50%の要素が変更
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const layout3 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'container', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const result2 = compareLayouts(layout2, layout3);
    expect(result2.similarity).toBeGreaterThan(40);
    expect(result2.similarity).toBeLessThan(60);
  });

  test('空のレイアウトの比較が正しく処理される', () => {
    const emptyLayout1 = createMockLayout([]);
    const emptyLayout2 = createMockLayout([]);
    
    const result = compareLayouts(emptyLayout1, emptyLayout2);
    expect(result.identical).toBe(true);
    expect(result.similarity).toBe(100);
    expect(result.differences).toHaveLength(0);
  });

  test('深くネストされた要素の変更を検出する', () => {
    const baseline = createMockLayout([
      { 
        type: 'container',
        bounds: { x: 0, y: 0, width: 1280, height: 600 },
        children: [
          {
            id: 'child-1',
            type: 'section',
            bounds: { x: 10, y: 10, width: 1260, height: 580 },
            elements: [],
            children: [],
            depth: 1,
            label: 'Child Section',
            importance: 60
          }
        ]
      }
    ]);
    
    const current = createMockLayout([
      { 
        type: 'container',
        bounds: { x: 0, y: 0, width: 1280, height: 600 },
        children: [
          {
            id: 'child-1',
            type: 'section',
            bounds: { x: 10, y: 20, width: 1260, height: 570 }, // 位置とサイズが変更
            elements: [],
            children: [],
            depth: 1,
            label: 'Child Section',
            importance: 60
          }
        ]
      }
    ]);
    
    const result = compareLayouts(baseline, current);
    expect(result.identical).toBe(false);
    // 子要素の変更も検出されるべき
    expect(result.differences.length).toBeGreaterThan(0);
  });

  test('パフォーマンス: 大量の要素でも高速に比較される', () => {
    // 1000個の要素を持つレイアウト
    const manyElements1 = Array.from({ length: 1000 }, (_, i) => ({
      type: 'content' as const,
      bounds: { x: 0, y: i * 10, width: 100, height: 10 },
      label: `Element ${i}`
    }));
    
    const manyElements2 = Array.from({ length: 1000 }, (_, i) => ({
      type: 'content' as const,
      bounds: { x: 0, y: i * 10 + 1, width: 100, height: 10 }, // わずかに移動
      label: `Element ${i}`
    }));
    
    const layout1 = createMockLayout(manyElements1);
    const layout2 = createMockLayout(manyElements2);
    
    const startTime = performance.now();
    const result = compareLayouts(layout1, layout2, { threshold: 0 }); // 閾値を0にして1pxの変更も検出
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // 100ms以内に完了
    expect(result.identical).toBe(false);
  });

  test('異なるビューポートサイズのレイアウトを比較する', () => {
    const layout1: LayoutAnalysisResult = {
      ...createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
      ]),
      viewport: { width: 1280, height: 720 }
    };
    
    const layout2: LayoutAnalysisResult = {
      ...createMockLayout([
        { type: 'navigation', bounds: { x: 0, y: 0, width: 768, height: 60 } }
      ]),
      viewport: { width: 768, height: 1024 }
    };
    
    const result = compareLayouts(layout1, layout2);
    expect(result.identical).toBe(false);
    expect(result.differences.length).toBeGreaterThan(0);
  });

  test('要素にIDがある場合の比較', () => {
    const baseline = createMockLayout([
      { id: 'nav-1', type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { id: 'section-1', type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const current = createMockLayout([
      { id: 'nav-1', type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 80 } }, // 高さ変更
      { id: 'section-2', type: 'section', bounds: { x: 0, y: 80, width: 1280, height: 480 } } // ID変更
    ]);
    
    const result = compareLayouts(baseline, current);
    expect(result.identical).toBe(false);
    expect(result.summary.modified).toBeGreaterThanOrEqual(1);
  });

  test('重要度が大きく異なる要素の比較', () => {
    const baseline = createMockLayout([
      { type: 'navigation', importance: 100, bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'content', importance: 30, bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const current = createMockLayout([
      { type: 'navigation', importance: 20, bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'content', importance: 90, bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const result = compareLayouts(baseline, current);
    expect(result.identical).toBe(false);
    expect(result.differences).toHaveLength(2);
    expect(result.differences[0].changes).toContainEqual(
      expect.objectContaining({ property: 'importance' })
    );
  });

  test('空の子要素配列を持つグループの比較', () => {
    const baseline = createMockLayout([
      { 
        type: 'container', 
        bounds: { x: 0, y: 0, width: 1280, height: 600 },
        children: []
      }
    ]);
    
    const current = createMockLayout([
      { 
        type: 'container', 
        bounds: { x: 0, y: 0, width: 1280, height: 600 },
        children: [
          {
            id: 'child-1',
            type: 'content',
            bounds: { x: 10, y: 10, width: 100, height: 100 },
            elements: [],
            children: [],
            depth: 1,
            label: 'New Child',
            importance: 50
          }
        ]
      }
    ]);
    
    const result = compareLayouts(baseline, current);
    expect(result.identical).toBe(false);
    expect(result.differences.some(d => d.type === 'added' && d.path.includes('child'))).toBe(true);
  });

  test('境界値テスト: 閾値ちょうどの変更', () => {
    const baseline = createMockLayout([
      { type: 'section', bounds: { x: 0, y: 0, width: 100, height: 100 } }
    ]);
    
    // 閾値2ピクセルちょうどの変更
    const current1 = createMockLayout([
      { type: 'section', bounds: { x: 2, y: 0, width: 100, height: 100 } }
    ]);
    
    // 閾値を超える変更
    const current2 = createMockLayout([
      { type: 'section', bounds: { x: 3, y: 0, width: 100, height: 100 } }
    ]);
    
    const result1 = compareLayouts(baseline, current1, { threshold: 2 });
    const result2 = compareLayouts(baseline, current2, { threshold: 2 });
    
    expect(result1.identical).toBe(true);
    expect(result2.identical).toBe(false);
  });

  test('循環参照を含む構造の比較', () => {
    // 循環参照をシミュレートするために、深いネスト構造を作成
    const createNestedGroups = (depth: number): SemanticGroup[] => {
      if (depth === 0) return [];
      return [{
        id: `group-${depth}`,
        type: 'container',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        elements: [],
        children: createNestedGroups(depth - 1),
        depth: depth,
        label: `Level ${depth}`,
        importance: 50
      }];
    };
    
    const baseline = createMockLayout(createNestedGroups(5));
    const current = createMockLayout(createNestedGroups(5));
    
    const result = compareLayouts(baseline, current);
    expect(result.identical).toBe(true);
    expect(result.similarity).toBe(100);
  });

  test('テキスト比較モード: exact', () => {
    const baseline = createMockLayout([]);
    const current = createMockLayout([]);
    
    // LayoutElementを直接追加
    baseline.elements = [{
      tagName: 'DIV',
      className: 'content',
      id: '',
      rect: { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 },
      text: 'Hello World',
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
    
    current.elements = [{
      tagName: 'DIV',
      className: 'content',
      id: '',
      rect: { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 },
      text: 'Hello  World', // 余分な空白
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
    
    // exactモードでは違いとして検出される
    const result1 = compareLayouts(baseline, current, { textCompareMode: 'exact' });
    expect(result1.identical).toBe(false);
  });

  test('テキスト比較モード: normalized', () => {
    const baseline = createMockLayout([]);
    const current = createMockLayout([]);
    
    // LayoutElementを直接追加
    baseline.elements = [{
      tagName: 'DIV',
      className: 'content',
      id: '',
      rect: { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 },
      text: 'Hello   World',
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
    
    current.elements = [{
      tagName: 'DIV',
      className: 'content',
      id: '',
      rect: { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 },
      text: 'Hello World', // 正規化後は同じ
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
    
    // normalizedモードでは同じとして扱われる
    const result = compareLayouts(baseline, current, { 
      textCompareMode: 'normalized',
      textNormalizeOptions: { removeExtraSpaces: true }
    });
    expect(result.identical).toBe(true);
  });

  test('テキスト比較モード: similarity', () => {
    const baseline = createMockLayout([]);
    const current = createMockLayout([]);
    
    // LayoutElementを直接追加
    baseline.elements = [{
      tagName: 'DIV',
      className: 'content',
      id: '',
      rect: { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 },
      text: 'Hello World',
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
    
    current.elements = [{
      tagName: 'DIV',
      className: 'content',
      id: '',
      rect: { x: 0, y: 0, width: 100, height: 100, top: 0, right: 100, bottom: 100, left: 0 },
      text: 'Hello Worlds', // 1文字追加（類似度高い）
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
    
    // 類似度が高いので同じとして扱われる
    const result = compareLayouts(baseline, current, { 
      textCompareMode: 'similarity',
      textSimilarityThreshold: 0.8
    });
    expect(result.identical).toBe(true);
    
    // 閾値を上げると違いとして検出される
    const result2 = compareLayouts(baseline, current, { 
      textCompareMode: 'similarity',
      textSimilarityThreshold: 0.95
    });
    expect(result2.identical).toBe(false);
  });
});