import { describe, it, expect } from 'vitest';
import { summarizeLayout } from '../../src/core/layout-summarizer.js';
import { ExtractedLayout } from '../../src/core/layout-extractor.js';

describe('layout-summarizer', () => {
  const createMockLayout = (): ExtractedLayout => ({
    elements: [
      {
        tagName: 'body',
        bounds: { x: 0, y: 0, width: 1280, height: 720 },
        isVisible: true,
        opacity: 1,
        accessibility: {},
        attributes: {},
        children: [
          {
            tagName: 'h1',
            id: 'title',
            className: 'heading primary',
            text: 'Welcome to Our Site',
            bounds: { x: 100, y: 50, width: 400, height: 50 },
            isVisible: true,
            opacity: 1,
            accessibility: { role: 'heading', ariaLabel: 'Main heading' },
            attributes: {}
          },
          {
            tagName: 'nav',
            className: 'navigation main-nav',
            bounds: { x: 0, y: 100, width: 1280, height: 60 },
            isVisible: true,
            opacity: 1,
            accessibility: { role: 'navigation' },
            attributes: {},
            children: [
              {
                tagName: 'a',
                text: 'Home',
                bounds: { x: 20, y: 120, width: 60, height: 20 },
                isVisible: true,
                opacity: 1,
                accessibility: { role: 'link', tabIndex: 0 },
                attributes: { href: '/' }
              },
              {
                tagName: 'a',
                text: 'About',
                bounds: { x: 100, y: 120, width: 60, height: 20 },
                isVisible: true,
                opacity: 1,
                accessibility: { role: 'link', tabIndex: 0 },
                attributes: { href: '/about' }
              }
            ]
          },
          {
            tagName: 'main',
            bounds: { x: 100, y: 200, width: 1080, height: 400 },
            isVisible: true,
            opacity: 1,
            accessibility: { role: 'main' },
            attributes: {},
            children: [
              {
                tagName: 'p',
                text: 'This is a paragraph with some content that explains things.',
                bounds: { x: 100, y: 220, width: 800, height: 60 },
                isVisible: true,
                opacity: 1,
                accessibility: {},
                attributes: {}
              },
              {
                tagName: 'button',
                id: 'cta',
                className: 'btn primary',
                text: 'Get Started',
                bounds: { x: 100, y: 300, width: 150, height: 50 },
                isVisible: true,
                opacity: 1,
                accessibility: { 
                  role: 'button', 
                  ariaLabel: 'Get started with our service',
                  tabIndex: 0 
                },
                attributes: {}
              }
            ]
          },
          {
            tagName: 'img',
            id: 'hero-image',
            bounds: { x: 500, y: 250, width: 300, height: 200 },
            isVisible: true,
            opacity: 1,
            accessibility: { role: 'img', ariaLabel: 'Hero image' },
            attributes: { src: '/hero.jpg', alt: 'Hero' }
          }
        ]
      }
    ],
    viewport: { width: 1280, height: 720 },
    documentInfo: {
      title: 'Test Page',
      url: 'http://example.com',
      lang: 'en'
    }
  });

  describe('summarizeLayout', () => {
    it('レイアウトを正しく要約できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      expect(summary).toBeDefined();
      expect(summary.nodes).toBeDefined();
      expect(summary.groups).toBeDefined();
      expect(summary.statistics).toBeDefined();
      expect(summary.viewport).toEqual({ width: 1280, height: 720 });
    });

    it('ノードを正しく抽出・変換できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      // body + h1 + nav + 2 links + main + p + button + img = 9 nodes
      expect(summary.nodes).toHaveLength(9);
      
      // h1ノードを確認
      const h1Node = summary.nodes.find(n => n.tagName === 'h1');
      expect(h1Node).toBeDefined();
      expect(h1Node!.semanticType).toBe('heading');
      expect(h1Node!.text).toBe('Welcome to Our Site');
      expect(h1Node!.accessibility.label).toBe('Main heading');
    });

    it('セマンティックタイプを正しく判定できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      const types = summary.nodes.map(n => ({ tag: n.tagName, type: n.semanticType }));
      
      expect(types).toContainEqual({ tag: 'h1', type: 'heading' });
      expect(types).toContainEqual({ tag: 'nav', type: 'navigation' });
      expect(types).toContainEqual({ tag: 'a', type: 'interactive' });
      expect(types).toContainEqual({ tag: 'button', type: 'interactive' });
      expect(types).toContainEqual({ tag: 'p', type: 'content' });
      expect(types).toContainEqual({ tag: 'img', type: 'media' });
      expect(types).toContainEqual({ tag: 'main', type: 'content' });
    });

    it('重要度を正しく計算できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      // 重要度でソートされているか確認
      for (let i = 1; i < summary.nodes.length; i++) {
        expect(summary.nodes[i - 1].importance).toBeGreaterThanOrEqual(summary.nodes[i].importance);
      }
      
      // h1が高い重要度を持つことを確認
      const h1Node = summary.nodes.find(n => n.tagName === 'h1');
      expect(h1Node!.importance).toBeGreaterThan(50);
    });

    it('アクセシビリティ情報を正しく要約できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      const buttonNode = summary.nodes.find(n => n.id === 'node_7'); // CTAボタン
      expect(buttonNode).toBeDefined();
      expect(buttonNode!.accessibility).toEqual({
        role: 'button',
        label: 'Get started with our service',
        interactive: true,
        focusable: true,
        hidden: false,
        state: undefined
      });
      
      const navNode = summary.nodes.find(n => n.tagName === 'nav');
      expect(navNode!.accessibility.role).toBe('navigation');
      expect(navNode!.accessibility.interactive).toBe(false);
    });

    it('グループを正しく生成できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      expect(summary.groups.length).toBeGreaterThan(0);
      
      // インタラクティブ要素のグループを確認（近接するリンク）
      const interactiveGroup = summary.groups.find(g => 
        g.type === 'interactive' && g.nodeIds.length > 1
      );
      expect(interactiveGroup).toBeDefined();
    });

    it('統計情報を正しく計算できる', () => {
      const layout = createMockLayout();
      const summary = summarizeLayout(layout);
      
      expect(summary.statistics.totalNodes).toBe(9);
      expect(summary.statistics.bySemanticType).toBeDefined();
      expect(summary.statistics.byRole).toBeDefined();
      expect(summary.statistics.averageImportance).toBeGreaterThan(0);
      
      // セマンティックタイプ別の統計
      expect(summary.statistics.bySemanticType['heading']).toBe(1);
      expect(summary.statistics.bySemanticType['navigation']).toBe(1);
      expect(summary.statistics.bySemanticType['interactive']).toBe(3); // 2 links + 1 button
      expect(summary.statistics.bySemanticType['content']).toBe(2); // main + p
      expect(summary.statistics.bySemanticType['media']).toBe(1);
      
      // ロール別の統計
      expect(summary.statistics.byRole['heading']).toBe(1);
      expect(summary.statistics.byRole['navigation']).toBe(1);
      expect(summary.statistics.byRole['link']).toBe(2);
      expect(summary.statistics.byRole['button']).toBe(1);
      expect(summary.statistics.byRole['main']).toBe(1);
      expect(summary.statistics.byRole['img']).toBe(1);
    });

    it('非表示要素の重要度が低くなる', () => {
      const layout = createMockLayout();
      // 非表示要素を追加
      layout.elements[0].children!.push({
        tagName: 'div',
        className: 'hidden',
        bounds: { x: 0, y: 0, width: 100, height: 100 },
        isVisible: false,
        opacity: 0,
        accessibility: {},
        attributes: {}
      });
      
      const summary = summarizeLayout(layout);
      const hiddenNode = summary.nodes.find(n => n.className === 'hidden');
      
      expect(hiddenNode).toBeDefined();
      expect(hiddenNode!.importance).toBeLessThan(10); // 非表示なので重要度が低い
    });

    it('空のレイアウトでもエラーにならない', () => {
      const emptyLayout: ExtractedLayout = {
        elements: [],
        viewport: { width: 1280, height: 720 },
        documentInfo: {
          title: 'Empty',
          url: 'http://example.com'
        }
      };
      
      const summary = summarizeLayout(emptyLayout);
      
      expect(summary.nodes).toHaveLength(0);
      expect(summary.groups).toHaveLength(0);
      expect(summary.statistics.totalNodes).toBe(0);
      expect(summary.statistics.averageImportance).toBe(0);
    });

    it('状態を持つ要素の状態情報を正しく抽出できる', () => {
      const layout = createMockLayout();
      // チェックボックスを追加
      layout.elements[0].children!.push({
        tagName: 'input',
        id: 'checkbox',
        bounds: { x: 100, y: 400, width: 20, height: 20 },
        isVisible: true,
        opacity: 1,
        accessibility: {
          role: 'checkbox',
          ariaChecked: true,
          ariaDisabled: false,
          tabIndex: 0
        },
        attributes: { type: 'checkbox' }
      });
      
      const summary = summarizeLayout(layout);
      const checkboxNode = summary.nodes.find(n => n.id === 'node_9');
      
      expect(checkboxNode).toBeDefined();
      expect(checkboxNode!.accessibility.state).toEqual({
        checked: true,
        disabled: false
      });
    });
  });
});