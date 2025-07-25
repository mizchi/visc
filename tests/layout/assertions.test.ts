import { describe, test, expect } from 'vitest';
import {
  assertLayoutsIdentical,
  assertLayoutsSimilar,
  assertNoLayoutChanges,
  LayoutAssertionError,
  createLayoutMatchers
} from '../../src/layout/assertions.js';
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

describe('レイアウトアサーション', () => {
  test('同一のレイアウトでassertLayoutsIdenticalがパスする', () => {
    const layout = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    expect(() => {
      assertLayoutsIdentical(layout, layout);
    }).not.toThrow();
  });

  test('異なるレイアウトでassertLayoutsIdenticalがエラーを投げる', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 10, width: 1280, height: 60 } }
    ]);
    
    expect(() => {
      assertLayoutsIdentical(layout1, layout2);
    }).toThrow(LayoutAssertionError);
  });

  test('LayoutAssertionErrorが詳細情報を含む', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    try {
      assertLayoutsIdentical(layout1, layout2);
    } catch (error) {
      expect(error).toBeInstanceOf(LayoutAssertionError);
      const layoutError = error as LayoutAssertionError;
      expect(layoutError.comparisonResult.summary.added).toBe(1);
      
      const details = layoutError.getDifferenceDetails();
      expect(details).toContain('added');
      expect(details).toContain('Similarity:');
    }
  });

  test('assertLayoutsSimilarが類似度閾値で正しく動作する', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 5, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 65, width: 1280, height: 500 } }
    ]);
    
    // 低い閾値ではパス
    expect(() => {
      assertLayoutsSimilar(layout1, layout2, 40);
    }).not.toThrow();
    
    // 100%閾値ではエラー
    expect(() => {
      assertLayoutsSimilar(layout1, layout2, 100);
    }).toThrow(LayoutAssertionError);
  });

  test('assertNoLayoutChangesが特定の変更タイプを検出する', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    // 追加を禁止
    expect(() => {
      assertNoLayoutChanges(layout1, layout2, ['added']);
    }).toThrow(LayoutAssertionError);
    
    // 削除を禁止（この場合は追加のみなのでパス）
    expect(() => {
      assertNoLayoutChanges(layout1, layout2, ['removed']);
    }).not.toThrow();
  });

  test('複数の変更タイプを同時に検証できる', () => {
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'sidebar', bounds: { x: 0, y: 60, width: 200, height: 500 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 10, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    expect(() => {
      assertNoLayoutChanges(layout1, layout2, ['added', 'removed', 'moved']);
    }).toThrow(LayoutAssertionError);
  });
});

describe('カスタムマッチャー', () => {
  test('toHaveIdenticalLayoutマッチャーが動作する', () => {
    const matchers = createLayoutMatchers();
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const result = matchers.toHaveIdenticalLayout(layout2, layout1);
    expect(result.pass).toBe(true);
  });

  test('toHaveSimilarLayoutマッチャーが動作する', () => {
    const matchers = createLayoutMatchers();
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 5, width: 1280, height: 60 } }
    ]);
    
    const result = matchers.toHaveSimilarLayout(layout2, layout1, 40);
    expect(result.pass).toBe(true);
    
    const result2 = matchers.toHaveSimilarLayout(layout2, layout1, 100);
    expect(result2.pass).toBe(false);
  });

  test('マッチャーのエラーメッセージが詳細を含む', () => {
    const matchers = createLayoutMatchers();
    const layout1 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } }
    ]);
    
    const layout2 = createMockLayout([
      { type: 'navigation', bounds: { x: 0, y: 0, width: 1280, height: 60 } },
      { type: 'section', bounds: { x: 0, y: 60, width: 1280, height: 500 } }
    ]);
    
    const result = matchers.toHaveIdenticalLayout(layout2, layout1);
    expect(result.pass).toBe(false);
    
    const message = result.message();
    expect(message).toContain('Layout Comparison Failed');
    expect(message).toContain('ADDED');
    expect(message).toContain('Similarity:');
  });
});