/**
 * Tests for CSS selector generator
 */

import { describe, it, expect } from 'vitest';
import {
  generateRootSelector,
  generateNodeSelector,
  isSelectorLikelyUnique,
  generateRobustSelector,
} from '../src/layout/selector-generator.js';
import type { VisualNode, VisualNodeGroup } from '../src/types.js';

// Helper to create mock VisualNode
function createMockNode(overrides: Partial<VisualNode> = {}): VisualNode {
  return {
    tagName: 'div',
    className: '',
    id: '',
    rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0, right: 100, bottom: 50 },
    text: '',
    role: null,
    ariaLabel: null,
    ariaAttributes: {},
    ...overrides,
  } as VisualNode;
}

// Helper to create mock VisualNodeGroup
function createMockGroup(overrides: Partial<VisualNodeGroup> = {}): VisualNodeGroup {
  return {
    type: 'content',
    label: 'Group',
    bounds: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0, right: 100, bottom: 50 },
    importance: 50,
    children: [],
    ...overrides,
  };
}

describe('Selector Generator', () => {
  describe('generateNodeSelector', () => {
    it('should generate ID selector when ID is present', () => {
      const node = createMockNode({ id: 'product-123' });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('#product-123');
    });

    it('should generate data-testid selector when available', () => {
      const node = createMockNode({
        ariaAttributes: { 'data-testid': 'product-card' }
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('[data-testid="product-card"]');
    });

    it('should generate aria-label selector', () => {
      const node = createMockNode({
        ariaLabel: '商品カード',
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('[aria-label="商品カード"]');
    });

    it('should generate BEM component selector', () => {
      const node = createMockNode({
        tagName: 'div',
        className: 'ProductLargeCell ProductLargeCell--featured',
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('div.ProductLargeCell.ProductLargeCell--featured');
    });

    it('should handle BEM element classes', () => {
      const node = createMockNode({
        tagName: 'img',
        className: 'ProductLargeCell__image ProductLargeCell__image--loading',
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('img.ProductLargeCell__image.ProductLargeCell__image--loading');
    });

    it('should generate semantic tag with role', () => {
      const node = createMockNode({
        tagName: 'nav',
        role: 'navigation',
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('nav[role="navigation"]');
    });

    it('should handle main element as unique', () => {
      const node = createMockNode({
        tagName: 'main',
        role: 'main',
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('main[role="main"]');
    });

    it('should add nth-of-type for non-unique elements', () => {
      const group = createMockGroup({
        children: [
          createMockNode({ tagName: 'li', className: 'item' }),
          createMockNode({ tagName: 'li', className: 'item' }),
          createMockNode({ tagName: 'li', className: 'item' }),
        ]
      });
      
      const selector = generateNodeSelector(group.children[1] as VisualNode, group);
      expect(selector).toContain('li.item');
      // Should add position hint for multiple similar elements
      expect(selector).toContain(':nth-of-type(2)');
    });

    it('should handle PascalCase component names', () => {
      const node = createMockNode({
        tagName: 'div',
        className: 'ProductCard ProductCard--sale',
      });
      const selector = generateNodeSelector(node);
      expect(selector).toBe('div.ProductCard.ProductCard--sale');
    });
  });

  describe('generateRootSelector', () => {
    it('should generate selector for group root element', () => {
      const group = createMockGroup({
        children: [
          createMockNode({
            tagName: 'article',
            id: 'product-456',
            className: 'ProductLargeCell',
          }),
          createMockNode({
            tagName: 'h3',
            className: 'ProductLargeCell__title',
          }),
        ]
      });
      
      const selector = generateRootSelector(group);
      expect(selector).toBe('#product-456');
    });

    it('should find root in nested groups', () => {
      const group = createMockGroup({
        children: [
          createMockGroup({
            children: [
              createMockNode({
                tagName: 'nav',
                ariaLabel: 'メインナビゲーション',
              })
            ]
          })
        ]
      });
      
      const selector = generateRootSelector(group);
      expect(selector).toBe('[aria-label="メインナビゲーション"]');
    });

    it('should return empty string if no root found', () => {
      const group = createMockGroup({
        children: []
      });
      
      const selector = generateRootSelector(group);
      expect(selector).toBe('');
    });
  });

  describe('isSelectorLikelyUnique', () => {
    it('should identify ID selectors as unique', () => {
      expect(isSelectorLikelyUnique('#product-123')).toBe(true);
    });

    it('should identify data-testid selectors as unique', () => {
      expect(isSelectorLikelyUnique('[data-testid="card"]')).toBe(true);
    });

    it('should identify aria-label selectors as likely unique', () => {
      expect(isSelectorLikelyUnique('[aria-label="商品情報"]')).toBe(true);
    });

    it('should identify semantic tags with role as unique', () => {
      expect(isSelectorLikelyUnique('main[role="main"]')).toBe(true);
      expect(isSelectorLikelyUnique('nav[role="navigation"]')).toBe(true);
    });

    it('should identify multiple classes as more specific', () => {
      expect(isSelectorLikelyUnique('.ProductCard.ProductCard--featured')).toBe(true);
    });

    it('should identify single class as not unique', () => {
      expect(isSelectorLikelyUnique('.card')).toBe(false);
    });

    it('should identify nth-of-type as specific', () => {
      expect(isSelectorLikelyUnique('li:nth-of-type(3)')).toBe(true);
    });
  });

  describe('generateRobustSelector', () => {
    it('should return primary selector if likely unique', () => {
      const node = createMockNode({ id: 'unique-element' });
      const selector = generateRobustSelector(node);
      expect(selector).toBe('#unique-element');
    });

    it('should add parent context for non-unique selectors', () => {
      const group = createMockGroup({
        children: [
          createMockNode({
            tagName: 'div',
            className: 'container',
            rect: { x: 0, y: 0, width: 500, height: 500, top: 0, left: 0, right: 500, bottom: 500 },
          }),
          createMockNode({
            tagName: 'span',
            className: 'text',
            rect: { x: 10, y: 10, width: 100, height: 30, top: 10, left: 10, right: 110, bottom: 40 },
          }),
        ]
      });
      
      const childNode = group.children[1] as VisualNode;
      const selector = generateRobustSelector(childNode, group);
      
      // Should try to make it more specific
      expect(selector).toContain('span');
      expect(selector).toContain('text');
    });
  });

  describe('Integration with VisualNodeGroup', () => {
    it('should generate rootSelector for product component group', () => {
      const productGroup = createMockGroup({
        type: 'content',
        label: 'Product Card',
        children: [
          createMockNode({
            tagName: 'article',
            className: 'ProductLargeCell ProductLargeCell--featured',
            id: 'product-789',
            ariaLabel: '商品: iPhone 15 Pro',
            role: 'article',
          }),
          createMockNode({
            tagName: 'img',
            className: 'ProductLargeCell__image',
          }),
          createMockNode({
            tagName: 'h3',
            className: 'ProductLargeCell__title',
            text: 'iPhone 15 Pro',
          }),
          createMockNode({
            tagName: 'span',
            className: 'ProductLargeCell__price',
            text: '¥159,800',
          }),
        ]
      });
      
      const selector = generateRootSelector(productGroup);
      expect(selector).toBe('#product-789');
      
      // Verify the selector would find the root element
      const rootNode = productGroup.children[0] as VisualNode;
      expect(rootNode.id).toBe('product-789');
    });

    it('should generate semantic selector for navigation group', () => {
      const navGroup = createMockGroup({
        type: 'navigation',
        label: 'Main Navigation',
        children: [
          createMockNode({
            tagName: 'nav',
            className: 'main-nav',
            role: 'navigation',
            ariaLabel: 'メインナビゲーション',
          }),
          createMockNode({
            tagName: 'ul',
            className: 'nav-list',
          }),
        ]
      });
      
      const selector = generateRootSelector(navGroup);
      expect(selector).toBe('[aria-label="メインナビゲーション"]');
    });
  });
});