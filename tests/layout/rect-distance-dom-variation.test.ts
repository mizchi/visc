import { describe, test, expect } from 'vitest';
import {
  calculateLayoutSimilarity,
  generateLayoutFingerprint,
  isSameLayoutStructure,
  type SemanticGroup
} from '../../src/layout/rect-distance.js';
import {
  calculateVisualSimilarity,
  isVisuallyEqualLayout
} from '../../src/layout/rect-distance-visual.js';

describe('rect-distance DOM variation tolerance', () => {
  describe('異なるDOM構造で同じ視覚的レイアウト', () => {
    test('フラットなDOMと入れ子のDOMが同じレイアウトとして識別される', () => {
      // フラットな構造（すべての要素が同じ階層）
      const flatLayout: SemanticGroup[] = [
        {
          id: 'header',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        },
        {
          id: 'nav-item-1',
          type: 'interactive',
          bounds: { x: 100, y: 30, width: 100, height: 40 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'Home',
          importance: 60
        },
        {
          id: 'nav-item-2',
          type: 'interactive',
          bounds: { x: 220, y: 30, width: 100, height: 40 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'About',
          importance: 60
        },
        {
          id: 'main-content',
          type: 'content',
          bounds: { x: 0, y: 100, width: 1920, height: 800 },
          elements: [{}, {}, {}, {}],
          children: [],
          depth: 0,
          label: 'Main',
          importance: 90
        }
      ];

      // 入れ子構造（ナビゲーションアイテムがヘッダーの子要素）
      const nestedLayout: SemanticGroup[] = [
        {
          id: 'header-nested',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [{}],
          children: [
            {
              id: 'nav-group',
              type: 'group',
              bounds: { x: 100, y: 30, width: 220, height: 40 },
              elements: [],
              children: [],
              depth: 1,
              label: 'Nav Group',
              importance: 65
            }
          ],
          depth: 0,
          label: 'Header Container',
          importance: 80
        },
        {
          id: 'nav-link-1',
          type: 'interactive',
          bounds: { x: 100, y: 30, width: 100, height: 40 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'Home Link',
          importance: 60
        },
        {
          id: 'nav-link-2',
          type: 'interactive',
          bounds: { x: 220, y: 30, width: 100, height: 40 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'About Link',
          importance: 60
        },
        {
          id: 'main-area',
          type: 'content',
          bounds: { x: 0, y: 100, width: 1920, height: 800 },
          elements: [{}, {}, {}, {}],
          children: [],
          depth: 0,
          label: 'Main Area',
          importance: 90
        }
      ];

      const similarity = calculateVisualSimilarity(flatLayout, nestedLayout);
      
      // 視覚的に同じ位置にあるため、高い類似度を示すはず
      expect(similarity.similarity).toBeGreaterThan(0.75);
      
      // 主要な要素（navigation, interactive, content）がマッチするはず
      expect(similarity.matchedGroups.length).toBeGreaterThanOrEqual(3);
      
      // 視覚的に同じレイアウトと判定されるはず
      expect(isVisuallyEqualLayout(flatLayout, nestedLayout, 0.7)).toBe(true);
    });

    test('異なるグループ化でも同じ視覚的配置なら高い類似度', () => {
      // カード要素が個別にグループ化されている
      const individualCards: SemanticGroup[] = [
        {
          id: 'card-1',
          type: 'content',
          bounds: { x: 100, y: 200, width: 400, height: 300 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Card 1',
          importance: 70
        },
        {
          id: 'card-2',
          type: 'content',
          bounds: { x: 600, y: 200, width: 400, height: 300 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Card 2',
          importance: 70
        },
        {
          id: 'card-3',
          type: 'content',
          bounds: { x: 1100, y: 200, width: 400, height: 300 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Card 3',
          importance: 70
        }
      ];

      // カード要素が1つのコンテナにグループ化されている
      const groupedCards: SemanticGroup[] = [
        {
          id: 'card-container',
          type: 'container',
          bounds: { x: 100, y: 200, width: 1400, height: 300 },
          elements: [],
          children: [
            {
              id: 'card-a',
              type: 'content',
              bounds: { x: 100, y: 200, width: 400, height: 300 },
              elements: [{}, {}, {}],
              children: [],
              depth: 1,
              label: 'Card A',
              importance: 70
            },
            {
              id: 'card-b',
              type: 'content',
              bounds: { x: 600, y: 200, width: 400, height: 300 },
              elements: [{}, {}, {}],
              children: [],
              depth: 1,
              label: 'Card B',
              importance: 70
            },
            {
              id: 'card-c',
              type: 'content',
              bounds: { x: 1100, y: 200, width: 400, height: 300 },
              elements: [{}, {}, {}],
              children: [],
              depth: 1,
              label: 'Card C',
              importance: 70
            }
          ],
          depth: 0,
          label: 'Cards Container',
          importance: 75
        }
      ];

      const similarity = calculateVisualSimilarity(individualCards, groupedCards);
      
      // カードの位置が同じなので、類似度は高いはず
      expect(similarity.similarity).toBeGreaterThan(0.6);
      
      // 各カードがマッチするはず
      const contentMatches = similarity.matchedGroups.filter(m => 
        m.group1.type === 'content' && m.group2.type === 'content'
      );
      expect(contentMatches.length).toBe(3);
    });

    test('Flexboxとグリッドで実装された同じレイアウト', () => {
      // Flexboxスタイルのレイアウト（水平に並んだアイテム）
      const flexLayout: SemanticGroup[] = [
        {
          id: 'flex-container',
          type: 'container',
          bounds: { x: 0, y: 100, width: 1920, height: 400 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Flex Container',
          importance: 50
        },
        {
          id: 'flex-item-1',
          type: 'content',
          bounds: { x: 160, y: 150, width: 480, height: 300 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Item 1',
          importance: 60
        },
        {
          id: 'flex-item-2',
          type: 'content',
          bounds: { x: 720, y: 150, width: 480, height: 300 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Item 2',
          importance: 60
        },
        {
          id: 'flex-item-3',
          type: 'content',
          bounds: { x: 1280, y: 150, width: 480, height: 300 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Item 3',
          importance: 60
        }
      ];

      // グリッドスタイルのレイアウト（同じ視覚的配置）
      const gridLayout: SemanticGroup[] = [
        {
          id: 'grid-container',
          type: 'container',
          bounds: { x: 0, y: 100, width: 1920, height: 400 },
          elements: [],
          children: [
            {
              id: 'grid-item-1',
              type: 'content',
              bounds: { x: 160, y: 150, width: 480, height: 300 },
              elements: [{}, {}],
              children: [],
              depth: 1,
              label: 'Grid Item 1',
              importance: 60
            },
            {
              id: 'grid-item-2',
              type: 'content',
              bounds: { x: 720, y: 150, width: 480, height: 300 },
              elements: [{}, {}],
              children: [],
              depth: 1,
              label: 'Grid Item 2',
              importance: 60
            },
            {
              id: 'grid-item-3',
              type: 'content',
              bounds: { x: 1280, y: 150, width: 480, height: 300 },
              elements: [{}, {}],
              children: [],
              depth: 1,
              label: 'Grid Item 3',
              importance: 60
            }
          ],
          depth: 0,
          label: 'Grid Container',
          importance: 50
        }
      ];

      const similarity = calculateVisualSimilarity(flexLayout, gridLayout);
      
      // 視覚的に同じ配置なので高い類似度
      expect(similarity.similarity).toBeGreaterThan(0.7);
      
      // 同じ構造として識別される
      expect(isVisuallyEqualLayout(flexLayout, gridLayout, 0.7)).toBe(true);
    });

    test('シャドウDOMと通常DOMの同じレイアウト', () => {
      // 通常のDOM構造
      const regularDOM: SemanticGroup[] = [
        {
          id: 'widget',
          type: 'container',
          bounds: { x: 500, y: 200, width: 920, height: 400 },
          elements: [],
          children: [
            {
              id: 'widget-header',
              type: 'navigation',
              bounds: { x: 500, y: 200, width: 920, height: 60 },
              elements: [{}],
              children: [],
              depth: 1,
              label: 'Widget Header',
              importance: 70
            },
            {
              id: 'widget-body',
              type: 'content',
              bounds: { x: 500, y: 260, width: 920, height: 340 },
              elements: [{}, {}, {}],
              children: [],
              depth: 1,
              label: 'Widget Body',
              importance: 80
            }
          ],
          depth: 0,
          label: 'Widget Container',
          importance: 75
        }
      ];

      // シャドウDOM的な構造（フラット化されている）
      const shadowDOM: SemanticGroup[] = [
        {
          id: 'shadow-root',
          type: 'container',
          bounds: { x: 500, y: 200, width: 920, height: 400 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'Shadow Root',
          importance: 75
        },
        {
          id: 'shadow-header',
          type: 'navigation',
          bounds: { x: 500, y: 200, width: 920, height: 60 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'Shadow Header',
          importance: 70
        },
        {
          id: 'shadow-content',
          type: 'content',
          bounds: { x: 500, y: 260, width: 920, height: 340 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Shadow Content',
          importance: 80
        }
      ];

      const similarity = calculateVisualSimilarity(regularDOM, shadowDOM);
      
      // 視覚的に同じ位置とサイズなので高い類似度
      expect(similarity.similarity).toBeGreaterThan(0.75);
      
      // コンテナ、ナビゲーション、コンテントがそれぞれマッチ
      expect(similarity.matchedGroups).toHaveLength(3);
    });

    test('レスポンシブデザインの異なるブレークポイント実装', () => {
      // メディアクエリによる実装
      const mediaQueryLayout: SemanticGroup[] = [
        {
          id: 'responsive-container',
          type: 'container',
          bounds: { x: 0, y: 0, width: 768, height: 1024 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Responsive Container',
          importance: 50
        },
        {
          id: 'mobile-nav',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 768, height: 60 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Mobile Nav',
          importance: 80
        },
        {
          id: 'mobile-content',
          type: 'content',
          bounds: { x: 20, y: 80, width: 728, height: 900 },
          elements: [{}, {}, {}, {}],
          children: [],
          depth: 0,
          label: 'Mobile Content',
          importance: 90
        }
      ];

      // JSによる動的実装
      const jsLayout: SemanticGroup[] = [
        {
          id: 'dynamic-wrapper',
          type: 'container',
          bounds: { x: 0, y: 0, width: 768, height: 1024 },
          elements: [],
          children: [
            {
              id: 'dynamic-header',
              type: 'navigation',
              bounds: { x: 0, y: 0, width: 768, height: 60 },
              elements: [{}, {}],
              children: [],
              depth: 1,
              label: 'Dynamic Header',
              importance: 80
            }
          ],
          depth: 0,
          label: 'Dynamic Wrapper',
          importance: 50
        },
        {
          id: 'dynamic-main',
          type: 'content',
          bounds: { x: 20, y: 80, width: 728, height: 900 },
          elements: [{}, {}, {}, {}],
          children: [],
          depth: 0,
          label: 'Dynamic Main',
          importance: 90
        }
      ];

      const similarity = calculateVisualSimilarity(mediaQueryLayout, jsLayout, {
        viewport: { width: 768, height: 1024 }
      });
      
      // モバイルビューでも同じレイアウト
      expect(similarity.similarity).toBeGreaterThan(0.8);
      
      // ナビゲーションとコンテンツがマッチ
      const navMatch = similarity.matchedGroups.find(m => 
        m.group1.type === 'navigation' && m.group2.type === 'navigation'
      );
      const contentMatch = similarity.matchedGroups.find(m => 
        m.group1.type === 'content' && m.group2.type === 'content'
      );
      
      expect(navMatch).toBeDefined();
      expect(contentMatch).toBeDefined();
    });
  });

  describe('フィンガープリントの安定性', () => {
    test('DOM構造が異なっても同じ視覚的配置なら似たフィンガープリント', () => {
      const layout1: SemanticGroup[] = [
        {
          id: 'header',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: Array(5).fill({}),
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        }
      ];

      const layout2: SemanticGroup[] = [
        {
          id: 'nav-bar',
          type: 'navigation',
          bounds: { x: 10, y: 5, width: 1900, height: 90 },
          elements: Array(5).fill({}),
          children: [],
          depth: 0,
          label: 'Navigation Bar',
          importance: 75
        }
      ];

      const fp1 = generateLayoutFingerprint(layout1);
      const fp2 = generateLayoutFingerprint(layout2);
      
      // 視覚的な類似度で確認
      const similarity = calculateVisualSimilarity(layout1, layout2);
      expect(similarity.similarity).toBeGreaterThan(0.9);
    });

    test('要素数が異なっても配置が同じなら構造として同一', () => {
      const sparse: SemanticGroup[] = [
        {
          id: 'content-1',
          type: 'content',
          bounds: { x: 0, y: 100, width: 960, height: 800 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Content Left',
          importance: 85
        },
        {
          id: 'sidebar-1',
          type: 'section',
          bounds: { x: 960, y: 100, width: 320, height: 800 },
          elements: [{}],
          children: [],
          depth: 0,
          label: 'Sidebar',
          importance: 60
        }
      ];

      const dense: SemanticGroup[] = [
        {
          id: 'main-content',
          type: 'content',
          bounds: { x: 0, y: 100, width: 960, height: 800 },
          elements: [{}, {}, {}, {}, {}], // より多くの要素
          children: [],
          depth: 0,
          label: 'Main Content Area',
          importance: 85
        },
        {
          id: 'aside',
          type: 'section',
          bounds: { x: 960, y: 100, width: 320, height: 800 },
          elements: [{}, {}, {}], // より多くの要素
          children: [],
          depth: 0,
          label: 'Aside Section',
          importance: 60
        }
      ];

      // 要素数は異なるが、配置は同じ
      expect(isVisuallyEqualLayout(sparse, dense, 0.7)).toBe(true);
    });
  });
});