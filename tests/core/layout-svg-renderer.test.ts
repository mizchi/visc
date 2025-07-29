import { describe, it, expect } from 'vitest';
import { renderLayoutToSVG, renderInteractiveSVG } from '../../src/domain/layout-svg-renderer.js';
import type { LayoutSummary } from '../../src/pure/types/index.js';

describe('layout-svg-renderer', () => {
  const createMockSummary = (): LayoutSummary => ({
    nodes: [
      {
        id: 'node_0',
        type: 'h1',
        semanticType: 'heading',
        tagName: 'h1',
        className: 'title main-title',
        text: 'Welcome to Our Website',
        bounds: { x: 100, y: 50, width: 400, height: 50 },
        accessibility: { 
          role: 'heading', 
          label: 'Main heading',
          interactive: false,
          focusable: false,
          hidden: false
        },
        importance: 90,
        childCount: 0
      },
      {
        id: 'node_1',
        type: 'nav',
        semanticType: 'navigation',
        tagName: 'nav',
        className: 'navbar',
        bounds: { x: 0, y: 100, width: 800, height: 60 },
        accessibility: {
          role: 'navigation',
          interactive: false,
          focusable: false,
          hidden: false
        },
        importance: 70,
        childCount: 5
      },
      {
        id: 'node_2',
        type: 'button',
        semanticType: 'interactive',
        tagName: 'button',
        className: 'btn btn-primary',
        text: 'Get Started',
        bounds: { x: 350, y: 300, width: 120, height: 40 },
        accessibility: {
          role: 'button',
          label: 'Get Started',
          interactive: true,
          focusable: true,
          hidden: false
        },
        importance: 75,
        childCount: 0
      }
    ],
    groups: [
      {
        id: 'group_0',
        type: 'navigation',
        nodeIds: ['node_1'],
        bounds: { x: 0, y: 100, width: 800, height: 60 },
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
      averageImportance: 78.33
    },
    viewport: { width: 800, height: 600 }
  });

  describe('renderLayoutToSVG', () => {
    it('基本的なSVGを生成できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary);
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('width="840"'); // 800 + padding*2
      expect(svg).toContain('height="640"'); // 600 + padding*2
    });

    it('ノードを描画できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary);
      
      // ノードの矩形が含まれる
      expect(svg).toContain('class="node"');
      expect(svg).toContain('data-id="node_0"');
      expect(svg).toContain('data-id="node_1"');
      expect(svg).toContain('data-id="node_2"');
      
      // 位置とサイズが正しい
      expect(svg).toContain('x="100"'); // transformで位置調整される
      expect(svg).toContain('y="50"'); // transformで位置調整される
      expect(svg).toContain('width="400"');
      expect(svg).toContain('height="50"');
    });

    it('ラベルを表示できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, { showLabels: true });
      
      expect(svg).toContain('Welcome to Our Website');
      expect(svg).toContain('Get Started');
    });

    it('重要度を表示できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, { showImportance: true });
      
      expect(svg).toContain('>90%<'); // 重要度90%
      expect(svg).toContain('>70%<'); // 重要度70%
      expect(svg).toContain('>75%<'); // 重要度75%
    });

    it('グループを描画できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, { showGroups: true });
      
      expect(svg).toContain('class="group"');
      expect(svg).toContain('class="group"');
      expect(svg).toContain('navigation'); // グループラベル
    });

    it('セマンティックカラースキームを適用できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, { colorScheme: 'semantic' });
      
      // 各セマンティックタイプの色が含まれる
      expect(svg).toContain('#2E86AB'); // heading
      expect(svg).toContain('#A23B72'); // navigation
      expect(svg).toContain('#C73E1D'); // interactive
    });

    it('重要度カラースキームを適用できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, { colorScheme: 'importance' });
      
      // HSL色が含まれる
      expect(svg).toContain('hsl(');
    });

    it('モノクロームカラースキームを適用できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, { colorScheme: 'monochrome' });
      
      expect(svg).toContain('#666666');
    });

    it('統計情報を表示できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary);
      
      expect(svg).toContain('Statistics');
      expect(svg).toContain('Total Nodes: 3');
      expect(svg).toContain('Average Importance: 78.3');
      expect(svg).toContain('heading: 1');
      expect(svg).toContain('navigation: 1');
      expect(svg).toContain('interactive: 1');
    });

    it('ツールチップを含む', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary);
      
      // ツールチップを含むノードがあるか確認
      expect(svg).toContain('data-id="node_0"');
      expect(svg).toContain('data-type="heading"');
      expect(svg).toContain('data-importance="90"');
    });

    it('XMLエスケープが正しく動作する', () => {
      const summary = createMockSummary();
      summary.nodes[0].text = 'Title with <special> & "characters"';
      
      const svg = renderLayoutToSVG(summary);
      
      expect(svg).toContain('Title with &lt;special&gt; &amp; &quot;characters&quot;');
    });

    it('小さい要素ではラベルを表示しない', () => {
      const summary = createMockSummary();
      summary.nodes.push({
        id: 'node_3',
        type: 'span',
        semanticType: 'structural',
        tagName: 'span',
        text: 'Tiny',
        bounds: { x: 10, y: 10, width: 20, height: 15 }, // 小さすぎる
        accessibility: { interactive: false, focusable: false, hidden: false },
        importance: 10,
        childCount: 0
      });
      
      const svg = renderLayoutToSVG(summary, { showLabels: true });
      
      // 小さい要素のテキストは含まれない
      expect(svg).not.toContain('>Tiny<');
    });

    it('カスタムオプションを適用できる', () => {
      const summary = createMockSummary();
      const svg = renderLayoutToSVG(summary, {
        width: 1200,
        height: 800,
        fontSize: 16,
        strokeWidth: 2,
        padding: 30
      });
      
      expect(svg).toContain('width="1260"'); // 1200 + 30*2
      expect(svg).toContain('height="860"'); // 800 + 30*2
      expect(svg).toContain('font-size: 16px');
      expect(svg).toContain('stroke-width="2"');
    });
  });

  describe('renderInteractiveSVG', () => {
    it('インタラクティブなSVGを生成できる', () => {
      const summary = createMockSummary();
      const svg = renderInteractiveSVG(summary);
      
      expect(svg).toContain('cursor: pointer');
      expect(svg).toContain('.node:hover');
      expect(svg).toContain('<script>');
      expect(svg).toContain('addEventListener');
    });

    it('選択状態のスタイルを含む', () => {
      const summary = createMockSummary();
      const svg = renderInteractiveSVG(summary);
      
      expect(svg).toContain('.selected');
      expect(svg).toContain('stroke: #FF0000');
    });
  });

  describe('edge cases', () => {
    it('空のレイアウトでもエラーにならない', () => {
      const emptySummary: LayoutSummary = {
        nodes: [],
        groups: [],
        statistics: {
          totalNodes: 0,
          bySemanticType: {},
          byRole: {},
          averageImportance: 0
        },
        viewport: { width: 800, height: 600 }
      };
      
      const svg = renderLayoutToSVG(emptySummary);
      
      expect(svg).toContain('<svg');
      expect(svg).toContain('Total Nodes: 0');
    });

    it('アクセシビリティ情報がない場合でも動作する', () => {
      const summary = createMockSummary();
      summary.nodes[0].accessibility = {
        interactive: false,
        focusable: false,
        hidden: false
      };
      
      const svg = renderLayoutToSVG(summary);
      
      expect(svg).toContain('data-id="node_0"');
    });
  });
});