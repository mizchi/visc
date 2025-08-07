/**
 * Tests for VRT improvement requirements
 * Based on real-world needs for debugging CSS issues
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { VisualNode, VisualNodeGroup, VisualTreeAnalysis } from '../src/types.js';
import { 
  analyzeElementDiff,
  analyzeGroupDiffs,
  type ElementDiff
} from '../src/analysis/element-diff-analyzer.js';

// Mock data for product components
function createProductNode(overrides: Partial<VisualNode> = {}): VisualNode {
  return {
    tagName: 'div',
    className: 'ProductLargeCell ProductLargeCell--featured',
    id: 'product-123',
    rect: { x: 100, y: 200, width: 300, height: 400, top: 200, left: 100, right: 400, bottom: 600 },
    text: '最近チェックした商品',
    role: 'article',
    ariaLabel: '商品情報',
    ariaAttributes: { 'aria-labelledby': 'product-title-123' },
    computedStyle: {
      display: 'flex',
      position: 'relative',
      flexDirection: 'column',
      width: '300px',
      height: '400px',
      padding: '16px',
      margin: '8px',
      backgroundColor: '#ffffff',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderRadius: '8px',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      gap: '12px',
      fontSize: '14px',
      lineHeight: '1.5',
      color: '#333333',
    },
    ...overrides,
  } as VisualNode;
}

describe('VRT Improvement Requirements', () => {
  describe('1. CSS計算値の詳細な差分記録', () => {
    it('should record detailed changes in computed CSS values for layout-affecting properties', () => {
      const previousNode = createProductNode({
        computedStyle: {
          display: 'flex',
          position: 'relative',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          width: '300px',
          height: '400px',
          gap: '12px',
        }
      });

      const currentNode = createProductNode({
        computedStyle: {
          display: 'block',  // Changed from flex
          position: 'absolute',  // Changed from relative
          flexDirection: 'row',  // Changed but irrelevant when display:block
          justifyContent: 'center',  // Changed
          alignItems: 'center',  // Changed
          width: '280px',  // Changed
          height: '420px',  // Changed
          gap: '16px',  // Changed
        }
      });

      const diff = analyzeElementDiff(previousNode, currentNode);

      expect(diff).toBeTruthy();
      expect(diff?.styleChanges).toBeDefined();
      
      // Should detect critical layout changes
      const displayChange = diff?.styleChanges?.find(c => c.property === 'display');
      expect(displayChange).toEqual({
        property: 'display',
        previousValue: 'flex',
        currentValue: 'block'
      });

      const positionChange = diff?.styleChanges?.find(c => c.property === 'position');
      expect(positionChange).toEqual({
        property: 'position',
        previousValue: 'relative',
        currentValue: 'absolute'
      });

      // Should mark as high severity for critical layout changes
      expect(diff?.severity).toBe('high');
      expect(diff?.changeType).toContain('style');
    });

    it('should track all flexbox-related properties when display changes', () => {
      const previousNode = createProductNode({
        computedStyle: {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }
      });

      const currentNode = createProductNode({
        computedStyle: {
          display: 'grid',  // Changed to grid
          gridTemplateColumns: '1fr 1fr',
          gridGap: '20px',
        }
      });

      const diff = analyzeElementDiff(previousNode, currentNode);

      const displayChange = diff?.styleChanges?.find(c => c.property === 'display');
      expect(displayChange?.previousValue).toBe('flex');
      expect(displayChange?.currentValue).toBe('grid');

      // Should detect that flex properties are no longer relevant
      expect(diff?.severity).toBe('high');
    });
  });

  describe('2. コンポーネント単位の分析', () => {
    it('should detect BEM component names and track changes within components', () => {
      const previousNode = createProductNode({
        className: 'ProductLargeCell ProductLargeCell--featured',
        text: '商品A',
      });

      const currentNode = createProductNode({
        className: 'ProductLargeCell ProductLargeCell--featured ProductLargeCell--disabled',
        text: '商品A（在庫なし）',
      });

      const diff = analyzeElementDiff(previousNode, currentNode);

      // Should identify component name from BEM classes
      expect(diff?.semanticInfo?.componentName).toBe('ProductLargeCell');
      
      // Should detect modifier changes
      expect(diff?.classChanges?.added).toContain('ProductLargeCell--disabled');
      
      // Should track text changes within component
      expect(diff?.semanticInfo?.previousText).toBe('商品A');
      expect(diff?.semanticInfo?.currentText).toBe('商品A（在庫なし）');
    });

    it('should group multiple element changes within the same component', () => {
      const previousGroup: VisualNodeGroup = {
        type: 'content',
        label: 'Product Card',
        bounds: { x: 0, y: 0, width: 300, height: 500, top: 0, left: 0, right: 300, bottom: 500 },
        importance: 80,
        children: [
          createProductNode({
            className: 'ProductLargeCell__image',
            tagName: 'img',
            rect: { x: 0, y: 0, width: 300, height: 200, top: 0, left: 0, right: 300, bottom: 200 },
          }),
          createProductNode({
            className: 'ProductLargeCell__title',
            tagName: 'h3',
            text: '商品タイトル',
            rect: { x: 0, y: 200, width: 300, height: 50, top: 200, left: 0, right: 300, bottom: 250 },
          }),
          createProductNode({
            className: 'ProductLargeCell__price',
            tagName: 'span',
            text: '¥1,000',
            rect: { x: 0, y: 250, width: 300, height: 30, top: 250, left: 0, right: 300, bottom: 280 },
          }),
        ],
      };

      const currentGroup: VisualNodeGroup = {
        ...previousGroup,
        children: [
          createProductNode({
            className: 'ProductLargeCell__image ProductLargeCell__image--loading',
            tagName: 'img',
            rect: { x: 0, y: 0, width: 280, height: 180, top: 0, left: 0, right: 280, bottom: 180 },
          }),
          createProductNode({
            className: 'ProductLargeCell__title',
            tagName: 'h3',
            text: '商品タイトル',
            rect: { x: 0, y: 180, width: 280, height: 50, top: 180, left: 0, right: 280, bottom: 230 },
          }),
          createProductNode({
            className: 'ProductLargeCell__price ProductLargeCell__price--sale',
            tagName: 'span',
            text: '¥800',
            rect: { x: 0, y: 230, width: 280, height: 30, top: 230, left: 0, right: 280, bottom: 260 },
          }),
        ],
      };

      const diffs = analyzeGroupDiffs(previousGroup, currentGroup);

      // Should detect changes in multiple elements of the same component
      const imageDiff = diffs.find(d => d.selector?.includes('ProductLargeCell__image'));
      expect(imageDiff?.classChanges?.added).toContain('ProductLargeCell__image--loading');
      expect(imageDiff?.sizeChange).toBeDefined();

      const priceDiff = diffs.find(d => d.selector?.includes('ProductLargeCell__price'));
      expect(priceDiff?.classChanges?.added).toContain('ProductLargeCell__price--sale');
      expect(priceDiff?.semanticInfo?.previousText).toBe('¥1,000');
      expect(priceDiff?.semanticInfo?.currentText).toBe('¥800');

      // All diffs should be identified as part of ProductLargeCell component
      diffs.forEach(diff => {
        if (diff.className?.includes('ProductLargeCell')) {
          expect(diff.semanticInfo?.componentName).toContain('ProductLargeCell');
        }
      });
    });
  });

  describe('3. 具体的なエラー原因の提示', () => {
    it('should provide hints about affected mixins or SCSS files', () => {
      const previousNode = createProductNode({
        className: 'ProductLargeCell card-mixin flex-layout-mixin',
        computedStyle: {
          display: 'flex',
          padding: '16px',  // From card-mixin
          borderRadius: '8px',  // From card-mixin
          flexDirection: 'column',  // From flex-layout-mixin
          gap: '12px',  // From flex-layout-mixin
        }
      });

      const currentNode = createProductNode({
        className: 'ProductLargeCell card-mixin flex-layout-mixin',
        computedStyle: {
          display: 'block',  // flex-layout-mixin not working
          padding: '16px',
          borderRadius: '8px',
          flexDirection: 'column',  // Ignored when display:block
          gap: '0px',  // Lost the gap
        }
      });

      const diff = analyzeElementDiff(previousNode, currentNode);

      // Should identify that flex-layout-mixin might be affected
      expect(diff?.classChanges?.unchanged).toContain('flex-layout-mixin');
      expect(diff?.styleChanges?.find(c => c.property === 'display')).toBeDefined();
      expect(diff?.styleChanges?.find(c => c.property === 'gap')).toBeDefined();

      // High severity because layout mixin is broken
      expect(diff?.severity).toBe('high');
    });

    it('should detect when CSS cascade or specificity issues occur', () => {
      const previousNode = createProductNode({
        className: 'ProductLargeCell featured',
        computedStyle: {
          backgroundColor: '#ffeb3b',  // Featured style
          zIndex: '10',
        }
      });

      const currentNode = createProductNode({
        className: 'ProductLargeCell featured',  // Same classes
        computedStyle: {
          backgroundColor: '#ffffff',  // Lost featured color
          zIndex: 'auto',  // Lost z-index
        }
      });

      const diff = analyzeElementDiff(previousNode, currentNode);

      // Classes unchanged but styles lost = specificity/cascade issue
      expect(diff?.classChanges).toBeNull();  // No class changes
      expect(diff?.styleChanges?.find(c => c.property === 'backgroundColor')).toEqual({
        property: 'backgroundColor',
        previousValue: '#ffeb3b',
        currentValue: '#ffffff'
      });

      // This indicates a CSS specificity or cascade problem
      expect(diff?.severity).toBe('high');
    });
  });

  describe('4. デバッグ用クエリAPI', () => {
    it('should support querying diffs for specific selectors', () => {
      const diffs: ElementDiff[] = [
        {
          selector: '.ProductLargeCell__image',
          domPath: 'div.ProductLargeCell > img.ProductLargeCell__image',
          changeType: 'size',
          severity: 'medium',
          sizeChange: {
            previousWidth: 300,
            previousHeight: 200,
            currentWidth: 280,
            currentHeight: 180,
            deltaWidth: -20,
            deltaHeight: -20,
          }
        },
        {
          selector: '.ProductLargeCell__title',
          domPath: 'div.ProductLargeCell > h3.ProductLargeCell__title',
          changeType: 'position',
          severity: 'low',
          positionChange: {
            previousX: 0,
            previousY: 200,
            currentX: 0,
            currentY: 180,
            deltaX: 0,
            deltaY: -20,
          }
        }
      ];

      // Query API to find specific selector
      const queryDiffBySelector = (diffs: ElementDiff[], selector: string) => {
        return diffs.filter(d => d.selector?.includes(selector));
      };

      const imageDiffs = queryDiffBySelector(diffs, 'ProductLargeCell__image');
      expect(imageDiffs).toHaveLength(1);
      expect(imageDiffs[0].sizeChange?.deltaWidth).toBe(-20);

      // Query API to find missing styles
      const findMissingStyles = (diff: ElementDiff) => {
        return diff.styleChanges?.filter(change => 
          change.currentValue === 'none' || 
          change.currentValue === 'auto' ||
          change.currentValue === '0' ||
          change.currentValue === '0px'
        );
      };

      const diffWithMissingStyles: ElementDiff = {
        selector: '.card',
        domPath: 'div.card',
        changeType: 'style',
        severity: 'high',
        styleChanges: [
          { property: 'gap', previousValue: '12px', currentValue: '0px' },
          { property: 'zIndex', previousValue: '10', currentValue: 'auto' },
          { property: 'boxShadow', previousValue: '0 2px 4px rgba(0,0,0,0.1)', currentValue: 'none' },
        ]
      };

      const missingStyles = findMissingStyles(diffWithMissingStyles);
      expect(missingStyles).toHaveLength(3);
      expect(missingStyles?.map(s => s.property)).toContain('gap');
      expect(missingStyles?.map(s => s.property)).toContain('zIndex');
      expect(missingStyles?.map(s => s.property)).toContain('boxShadow');
    });

    it('should provide component hierarchy analysis', () => {
      const diff: ElementDiff = {
        selector: '.ProductLargeCell__price',
        domPath: 'main > section.products > div.ProductLargeCell > span.ProductLargeCell__price',
        changeType: 'combined',
        severity: 'medium',
        semanticInfo: {
          componentName: 'ProductLargeCell',
        }
      };

      // Extract component hierarchy from DOM path
      const getComponentHierarchy = (domPath: string): string[] => {
        return domPath.split(' > ').map(segment => {
          const match = segment.match(/\.([A-Z][A-Za-z0-9_-]+)/);
          return match ? match[1] : segment.split('.')[0];
        });
      };

      const hierarchy = getComponentHierarchy(diff.domPath);
      expect(hierarchy).toContain('ProductLargeCell');
      expect(hierarchy[hierarchy.length - 1]).toBe('ProductLargeCell__price');
    });
  });

  describe('5. 実用的なサマリー生成', () => {
    it('should generate actionable summary for CSS debugging', () => {
      const diff: ElementDiff = {
        selector: '.ProductLargeCell',
        domPath: 'div.ProductLargeCell',
        elementId: 'product-123',
        className: 'ProductLargeCell ProductLargeCell--featured',
        changeType: 'combined',
        severity: 'high',
        positionChange: {
          previousX: 100,
          previousY: 200,
          currentX: 100,
          currentY: 150,
          deltaX: 0,
          deltaY: -50,
        },
        sizeChange: {
          previousWidth: 300,
          previousHeight: 400,
          currentWidth: 280,
          currentHeight: 420,
          deltaWidth: -20,
          deltaHeight: 20,
        },
        styleChanges: [
          { property: 'display', previousValue: 'flex', currentValue: 'block' },
          { property: 'gap', previousValue: '12px', currentValue: '0px' },
        ],
        classChanges: {
          added: ['ProductLargeCell--disabled'],
          removed: [],
          unchanged: ['ProductLargeCell', 'ProductLargeCell--featured'],
        },
        semanticInfo: {
          componentName: 'ProductLargeCell',
          previousText: '最近チェックした商品',
          currentText: '最近チェックした商品',
        }
      };

      // Generate debugging hints
      const generateDebuggingHints = (diff: ElementDiff): string[] => {
        const hints: string[] = [];

        // Check for flexbox breaking
        const displayChange = diff.styleChanges?.find(c => c.property === 'display');
        if (displayChange?.previousValue === 'flex' && displayChange?.currentValue !== 'flex') {
          hints.push(`⚠️ Flexboxレイアウトが崩れています: display: ${displayChange.currentValue}`);
          hints.push(`  → flex関連のmixinやスタイルシートを確認してください`);
        }

        // Check for gap loss
        const gapChange = diff.styleChanges?.find(c => c.property === 'gap');
        if (gapChange && gapChange.currentValue === '0px') {
          hints.push(`⚠️ gap値が失われました: ${gapChange.previousValue} → 0px`);
        }

        // Check for size changes
        if (diff.sizeChange && Math.abs(diff.sizeChange.deltaWidth) > 10) {
          hints.push(`📏 幅が${diff.sizeChange.deltaWidth}px変化しました`);
        }

        // Check for new modifiers
        if (diff.classChanges?.added.length) {
          hints.push(`🏷️ 新しいモディファイアが追加: ${diff.classChanges.added.join(', ')}`);
        }

        return hints;
      };

      const hints = generateDebuggingHints(diff);
      expect(hints).toContain('⚠️ Flexboxレイアウトが崩れています: display: block');
      expect(hints.some(h => h.includes('flex関連のmixinやスタイルシート'))).toBe(true);
      expect(hints.some(h => h.includes('gap値が失われました'))).toBe(true);
      expect(hints.some(h => h.includes('幅が-20px変化'))).toBe(true);
    });
  });
});