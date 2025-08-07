import { describe, it, expect } from 'vitest';
import {
  detectFlakiness,
  generateFlakinessReport,
} from '../../src/layout/flakiness-detector';
import type { VisualTreeAnalysis, VisualNode } from '../../src/types';

describe('flakiness-detector', () => {
  describe('detectFlakiness', () => {
    it('should detect no flakiness for identical samples', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
        ]),
      ];

      const result = detectFlakiness(samples);
      
      expect(result.flakyElements).toHaveLength(0);
      expect(result.overallScore).toBe(0);
      expect(result.stableCount).toBe(2);
      expect(result.unstableCount).toBe(0);
    });

    it('should detect position flakiness', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 12, y: 10, width: 80, height: 20 }), // x changed
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 11, y: 10, width: 80, height: 20 }), // x changed
        ]),
      ];

      const result = detectFlakiness(samples);
      
      expect(result.flakyElements).toHaveLength(1);
      expect(result.flakyElements[0].flakinessType).toBe('position');
      expect(result.unstableCount).toBe(1);
    });

    it('should detect size flakiness', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 102, height: 100 }), // width changed
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 101, height: 100 }), // width changed
        ]),
      ];

      const result = detectFlakiness(samples);
      
      expect(result.flakyElements).toHaveLength(1);
      expect(result.flakyElements[0].flakinessType).toBe('size');
    });

    it('should detect content flakiness for text changes', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Hello'),
        ]),
        createSample([
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'World'),
        ]),
        createSample([
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Test'),
        ]),
      ];

      const result = detectFlakiness(samples);
      
      expect(result.flakyElements).toHaveLength(1);
      expect(result.flakyElements[0].flakinessType).toBe('content');
      const textVariation = result.flakyElements[0].variations.find(v => v.property === 'text');
      expect(textVariation).toBeDefined();
      const values = textVariation?.values.map(v => v.value);
      expect(values).toContain('Hello');
      expect(values).toContain('World');
      expect(values).toContain('Test');
    });

    it('should detect style flakiness for className changes', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'active', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'inactive', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'hover', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
      ];

      const result = detectFlakiness(samples);
      
      expect(result.flakyElements).toHaveLength(1);
      expect(result.flakyElements[0].flakinessType).toBe('style');
      const classVariation = result.flakyElements[0].variations.find(v => v.property === 'className');
      expect(classVariation).toBeDefined();
      const values = classVariation?.values.map(v => v.value);
      expect(values).toContain('active');
      expect(values).toContain('inactive');
      expect(values).toContain('hover');
    });

    it('should handle elements that appear and disappear', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          // p element missing
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }),
        ]),
      ];

      const result = detectFlakiness(samples);
      
      expect(result.flakyElements.length).toBeGreaterThan(0);
      const existenceFlaky = result.categorizedFlakiness.existence;
      expect(existenceFlaky.length).toBeGreaterThan(0);
    });
  });

  // TODO: Add tests for internal helper functions if they are exported

  describe('generateFlakinessReport', () => {
    it('should generate a comprehensive report', () => {
      const analysis = {
        overallScore: 40.0,
        flakyElements: [
          {
            path: '/div/container',
            elementId: 'div.container',
            identifier: {
              tagName: 'div',
              className: 'container',
            },
            flakinessType: 'mixed' as const,
            score: 80,
            variations: [
              {
                property: 'x',
                values: [
                  { value: 10, count: 2, percentage: 40 },
                  { value: 12, count: 2, percentage: 40 },
                  { value: 11, count: 1, percentage: 20 },
                ],
                variance: 0.8,
              },
              {
                property: 'width',
                values: [
                  { value: 100, count: 2, percentage: 40 },
                  { value: 102, count: 2, percentage: 40 },
                  { value: 101, count: 1, percentage: 20 },
                ],
                variance: 0.8,
              },
            ],
            occurrenceCount: 9,
            occurrenceRate: 0.9,
            changeFrequency: 0.8,
            totalComparisons: 10,
          },
        ],
        stableCount: 6,
        unstableCount: 3,
        sampleCount: 5,
        categorizedFlakiness: {
          position: [],
          size: [],
          content: [],
          existence: [],
          style: [],
        },
      };

      const report = generateFlakinessReport(analysis);
      
      expect(report).toContain('フレーキーネス分析レポート');
      expect(report).toContain('40.0%');
      expect(report).toContain('サンプル数: 5');
      expect(report).toContain('安定要素: 6');
      expect(report).toContain('不安定要素: 3');
      expect(report).toContain('div.container');
    });

    it('should handle empty analysis', () => {
      const analysis = {
        overallScore: 0,
        flakyElements: [],
        stableCount: 5,
        unstableCount: 0,
        sampleCount: 3,
        categorizedFlakiness: {
          position: [],
          size: [],
          content: [],
          existence: [],
          style: [],
        },
      };

      const report = generateFlakinessReport(analysis);
      
      expect(report).toContain('フレーキーネス分析レポート');
      expect(report).toContain('0.0%');
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