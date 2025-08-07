import { describe, it, expect } from 'vitest';
import {
  compareLayoutTrees,
} from '../../src/layout/comparator';
import {
  validateWithSettings,
  type ComparisonSettings,
} from '../../src/layout/calibrator';
import type { VisualTreeAnalysis, VisualNode } from '../../src/types';

describe('comparator', () => {
  describe('compareLayoutTrees', () => {
    it('should return 100% similarity for identical layouts', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
      ]);

      const result = compareLayoutTrees(layout1, layout2);
      
      expect(result.similarity).toBe(100);
      expect(result.differences).toHaveLength(0);
      expect(result.summary.totalChanged).toBe(0);
      expect(result.summary.totalAdded).toBe(0);
      expect(result.summary.totalRemoved).toBe(0);
    });

    it('should detect added elements', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
      ]);

      const result = compareLayoutTrees(layout1, layout2);
      
      expect(result.similarity).toBeLessThan(100);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('added');
      expect(result.summary.totalAdded).toBe(1);
    });

    it('should detect removed elements', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);

      const result = compareLayoutTrees(layout1, layout2);
      
      expect(result.similarity).toBeLessThan(100);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('removed');
      expect(result.summary.totalRemoved).toBe(1);
    });

    it('should detect modified elements with position changes', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 10, y: 10, width: 100, height: 100 }),
      ]);

      const result = compareLayoutTrees(layout1, layout2, { 
        threshold: 5  // Allow 5px difference
      });
      
      expect(result.similarity).toBeLessThan(100);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('modified');
      expect(result.differences[0].positionDiff).toBeGreaterThan(0);
    });

    it('should detect modified elements with size changes', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 110, height: 110 }),
      ]);

      const result = compareLayoutTrees(layout1, layout2, {
        threshold: 5  // Allow 5px difference
      });
      
      expect(result.similarity).toBeLessThan(100);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('modified');
      expect(result.differences[0].sizeDiff).toBeGreaterThan(0);
    });

    it('should detect text content changes', () => {
      const layout1 = createSample([
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
      ]);
      const layout2 = createSample([
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'World'),
      ]);

      const result = compareLayoutTrees(layout1, layout2);
      
      expect(result.similarity).toBeLessThan(100);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].type).toBe('modified');
      const diff = result.differences[0];
      const textChange = diff.type === 'text' || diff.type === 'modified' 
        ? { property: 'text', before: diff.oldValue?.text, after: diff.newValue?.text }
        : undefined;
      expect(textChange).toBeDefined();
      expect(textChange?.before).toBe('Hello');
      expect(textChange?.after).toBe('World');
    });

    it('should ignore text changes when ignoreText is true', () => {
      const layout1 = createSample([
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
      ]);
      const layout2 = createSample([
        createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'World'),
      ]);

      const result = compareLayoutTrees(layout1, layout2, { ignoreText: true });
      
      expect(result.similarity).toBe(100);
      expect(result.differences).toHaveLength(0);
    });

    it('should respect position threshold', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 3, y: 3, width: 100, height: 100 }),
      ]);

      // With strict threshold (2px), should detect difference
      const strictResult = compareLayoutTrees(layout1, layout2, { threshold: 2 });
      expect(strictResult.similarity).toBeLessThan(100);
      expect(strictResult.differences).toHaveLength(1);

      // With lenient threshold (5px), should be considered same
      const lenientResult = compareLayoutTrees(layout1, layout2, { threshold: 5 });
      expect(lenientResult.similarity).toBe(100);
      expect(lenientResult.differences).toHaveLength(0);
    });
  });

  describe('validateWithSettings', () => {
    it('should validate as same with default settings', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);

      const settings: ComparisonSettings = {
        positionTolerance: 5,
        sizeTolerance: 10,
        textSimilarityThreshold: 90,
        importanceThreshold: 0.5,
      };

      const result = validateWithSettings(layout2, layout1, settings);
      
      expect(result.passed).toBe(true);
      expect(result.reason).toBe('passed');
      expect(result.similarity).toBe(100);
    });

    it('should fail validation when similarity is below threshold', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        createNode('p', 'text1', { x: 10, y: 10, width: 80, height: 20 }),
        createNode('p', 'text2', { x: 10, y: 40, width: 80, height: 20 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        // Missing both text elements
      ]);

      const settings: ComparisonSettings = {
        positionTolerance: 5,
        sizeTolerance: 10,
        textSimilarityThreshold: 90,
        importanceThreshold: 0.5,
      };

      const result = validateWithSettings(layout2, layout1, settings);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('similarity_threshold');
      expect(result.similarity).toBeLessThan(90);
    });

    it('should fail validation when position changes exceed tolerance', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 10, y: 10, width: 100, height: 100 }),
      ]);

      const settings: ComparisonSettings = {
        positionTolerance: 5,
        sizeTolerance: 10,
        textSimilarityThreshold: 80,
        importanceThreshold: 0.5,
      };

      const result = validateWithSettings(layout2, layout1, settings);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('position_change');
      expect(result.maxPositionDiff).toBeGreaterThan(5);
    });

    it('should fail validation when size changes exceed tolerance', () => {
      const layout1 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
      ]);
      const layout2 = createSample([
        createNode('div', 'container', { x: 0, y: 0, width: 115, height: 115 }),
      ]);

      const settings: ComparisonSettings = {
        positionTolerance: 5,
        sizeTolerance: 10,  // 10% tolerance
        textSimilarityThreshold: 80,
        importanceThreshold: 0.5,
      };

      const result = validateWithSettings(layout2, layout1, settings);
      
      expect(result.passed).toBe(false);
      expect(result.reason).toBe('size_change');
      expect(result.maxSizeDiff).toBeGreaterThan(10);
    });
  });
});

// Helper functions
function createSample(elements: VisualNode[]): VisualTreeAnalysis {
  return {
    url: 'http://example.com',
    timestamp: new Date().toISOString(),
    viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
    elements,
    statistics: {
      totalElements: elements.length,
      visibleElements: elements.length,
      interactiveElements: 0,
      textElements: elements.filter(e => e.text).length,
      imageElements: 0,
      averageDepth: 1,
      maxDepth: 1,
    },
  };
}

function createNode(
  tagName: string,
  className: string,
  rect: { x: number; y: number; width: number; height: number },
  text?: string
): VisualNode {
  return {
    tagName,
    className,
    id: '',
    rect: {
      ...rect,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
      left: rect.x,
    },
    text,
  };
}