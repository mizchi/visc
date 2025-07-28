import { describe, it, expect } from 'vitest';
import { calculateLayoutSimilarity, generateSimilarityReport } from '../../src/core/layout-similarity.js';
import { LayoutSummary } from '../../src/core/layout-summarizer.js';

describe('layout-similarity', () => {
  const createMockLayout = (variant: 'default' | 'moved' | 'changed' | 'different' = 'default'): LayoutSummary => {
    const baseLayout: LayoutSummary = {
      nodes: [
        {
          id: 'node_0',
          type: 'h1',
          semanticType: 'heading',
          tagName: 'h1',
          className: 'title',
          text: 'Welcome',
          position: { x: 100, y: 50, width: 300, height: 50 },
          accessibility: { role: 'heading', label: 'Welcome', interactive: false, focusable: false, hidden: false },
          importance: 85,
          childCount: 0
        },
        {
          id: 'node_1',
          type: 'nav',
          semanticType: 'navigation',
          tagName: 'nav',
          className: 'main-nav',
          position: { x: 0, y: 100, width: 1280, height: 60 },
          accessibility: { role: 'navigation', interactive: false, focusable: false, hidden: false },
          importance: 70,
          childCount: 3
        },
        {
          id: 'node_2',
          type: 'button',
          semanticType: 'interactive',
          tagName: 'button',
          className: 'btn primary',
          text: 'Click Me',
          position: { x: 500, y: 300, width: 100, height: 40 },
          accessibility: { role: 'button', label: 'Click Me', interactive: true, focusable: true, hidden: false },
          importance: 65,
          childCount: 0
        }
      ],
      groups: [
        {
          id: 'group_0',
          type: 'heading',
          nodeIds: ['node_0'],
          bounds: { x: 100, y: 50, width: 300, height: 50 },
          semanticRole: 'heading'
        },
        {
          id: 'group_1',
          type: 'navigation',
          nodeIds: ['node_1'],
          bounds: { x: 0, y: 100, width: 1280, height: 60 },
          semanticRole: 'navigation'
        }
      ],
      statistics: {
        totalNodes: 3,
        bySemanticType: {
          heading: 1,
          navigation: 1,
          interactive: 1
        },
        byRole: {
          heading: 1,
          navigation: 1,
          button: 1
        },
        averageImportance: 73.33
      },
      viewport: { width: 1280, height: 720 }
    };

    if (variant === 'moved') {
      // ボタンを移動
      baseLayout.nodes[2].position = { x: 600, y: 350, width: 100, height: 40 };
    } else if (variant === 'changed') {
      // テキストとクラスを変更
      baseLayout.nodes[0].text = 'Hello World';
      baseLayout.nodes[0].accessibility.label = 'Hello World';
      baseLayout.nodes[2].className = 'btn secondary';
    } else if (variant === 'different') {
      // 完全に異なるレイアウト
      return {
        nodes: [
          {
            id: 'node_0',
            type: 'div',
            semanticType: 'structural',
            tagName: 'div',
            position: { x: 0, y: 0, width: 1280, height: 720 },
            accessibility: { interactive: false, focusable: false, hidden: false },
            importance: 30,
            childCount: 0
          },
          {
            id: 'node_1',
            type: 'img',
            semanticType: 'media',
            tagName: 'img',
            position: { x: 200, y: 200, width: 400, height: 300 },
            accessibility: { role: 'img', interactive: false, focusable: false, hidden: false },
            importance: 40,
            childCount: 0
          }
        ],
        groups: [
          {
            id: 'group_0',
            type: 'media',
            nodeIds: ['node_1'],
            bounds: { x: 200, y: 200, width: 400, height: 300 },
            semanticRole: 'media'
          }
        ],
        statistics: {
          totalNodes: 2,
          bySemanticType: {
            structural: 1,
            media: 1
          },
          byRole: {
            img: 1
          },
          averageImportance: 35
        },
        viewport: { width: 1280, height: 720 }
      };
    }

    return baseLayout;
  };

  describe('calculateLayoutSimilarity', () => {
    it('同一のレイアウトは100%の類似度を持つ', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout();
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.overallSimilarity).toBeCloseTo(1, 1);
      expect(result.structuralSimilarity).toBeCloseTo(1, 1);
      expect(result.semanticSimilarity).toBe(1);
      expect(result.details.matchedNodes).toBe(3);
      expect(result.details.addedNodes).toBe(0);
      expect(result.details.removedNodes).toBe(0);
    });

    it('要素が移動したレイアウトを検出できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout('moved');
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.overallSimilarity).toBeLessThan(1);
      expect(result.overallSimilarity).toBeGreaterThan(0.7);
      expect(result.details.movedNodes).toBeGreaterThan(0);
      
      // 移動したノードの詳細を確認
      const movedMatch = result.nodeMatches.find(m => m.matchType === 'moved');
      expect(movedMatch).toBeDefined();
      expect(movedMatch!.differences?.position).toBeDefined();
    });

    it('要素が変更されたレイアウトを検出できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout('changed');
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.overallSimilarity).toBeLessThan(1);
      expect(result.overallSimilarity).toBeGreaterThan(0.5);
      expect(result.details.changedNodes).toBeGreaterThan(0);
      
      // 変更されたノードの詳細を確認
      const changedMatches = result.nodeMatches.filter(m => m.matchType === 'changed');
      expect(changedMatches.length).toBeGreaterThan(0);
      
      const textChange = changedMatches.find(m => m.differences?.text);
      expect(textChange).toBeDefined();
      expect(textChange!.differences!.text!.before).toBe('Welcome');
      expect(textChange!.differences!.text!.after).toBe('Hello World');
    });

    it('完全に異なるレイアウトは低い類似度を持つ', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout('different');
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.overallSimilarity).toBeLessThan(0.3);
      expect(result.structuralSimilarity).toBeLessThan(0.5);
      expect(result.semanticSimilarity).toBeLessThan(0.3);
    });

    it('ノードの追加と削除を検出できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout();
      
      // layout2に新しいノードを追加
      layout2.nodes.push({
        id: 'node_3',
        type: 'p',
        semanticType: 'content',
        tagName: 'p',
        text: 'New paragraph',
        position: { x: 100, y: 400, width: 800, height: 60 },
        accessibility: { interactive: false, focusable: false, hidden: false },
        importance: 50,
        childCount: 0
      });
      layout2.statistics.totalNodes = 4;
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.details.addedNodes).toBe(1);
      expect(result.details.matchedNodes).toBe(3);
    });

    it('アクセシビリティの類似度を正しく計算できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout();
      
      // アクセシビリティ情報を変更
      layout2.nodes[2].accessibility = {
        role: 'button',
        label: 'Submit',
        interactive: true,
        focusable: true,
        hidden: false,
        state: { disabled: true }
      };
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.accessibilitySimilarity).toBeLessThan(1);
      expect(result.accessibilitySimilarity).toBeGreaterThan(0.5);
      
      // 変更の詳細を確認
      const buttonMatch = result.nodeMatches.find(m => m.node1.type === 'button');
      expect(buttonMatch!.differences?.accessibility).toBeDefined();
    });

    it('グループの類似度を考慮する', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout();
      
      // グループを変更
      layout2.groups = [
        {
          id: 'group_0',
          type: 'content',
          nodeIds: ['node_0', 'node_2'],
          bounds: { x: 100, y: 50, width: 500, height: 300 },
          semanticRole: 'content'
        }
      ];
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      
      expect(result.structuralSimilarity).toBeLessThan(1);
    });

    it('空のレイアウト同士の比較でエラーにならない', () => {
      const emptyLayout1: LayoutSummary = {
        nodes: [],
        groups: [],
        statistics: {
          totalNodes: 0,
          bySemanticType: {},
          byRole: {},
          averageImportance: 0
        },
        viewport: { width: 1280, height: 720 }
      };
      
      const emptyLayout2 = { ...emptyLayout1 };
      
      const result = calculateLayoutSimilarity(emptyLayout1, emptyLayout2);
      
      expect(result.overallSimilarity).toBe(1);
      expect(result.details.matchedNodes).toBe(0);
    });
  });

  describe('generateSimilarityReport', () => {
    it('類似度レポートを生成できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout('changed');
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      const report = generateSimilarityReport(result);
      
      expect(report).toContain('# レイアウト類似度レポート');
      expect(report).toContain('全体的な類似度:');
      expect(report).toContain('構造的類似度:');
      expect(report).toContain('セマンティック類似度:');
      expect(report).toContain('アクセシビリティ類似度:');
    });

    it('重要な変更を含むレポートを生成できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout('moved');
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      const report = generateSimilarityReport(result);
      
      expect(report).toContain('## 重要な変更');
      expect(report).toContain('位置変更:');
    });

    it('変更がない場合のレポートを生成できる', () => {
      const layout1 = createMockLayout();
      const layout2 = createMockLayout();
      
      const result = calculateLayoutSimilarity(layout1, layout2);
      const report = generateSimilarityReport(result);
      
      expect(report).toContain('完全一致: 3個');
      expect(report).not.toContain('## 重要な変更');
    });
  });
});