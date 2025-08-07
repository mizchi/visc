import { describe, it, expect } from 'vitest';
import {
  calibrateComparisonSettings,
} from '../../src/layout/calibrator';
import type { VisualTreeAnalysis, VisualNode } from '../../src/types';

describe('calibrator', () => {
  describe('calibrateComparisonSettings', () => {
    it('should generate settings for stable samples', () => {
      // Identical samples with no variation
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

      const result = calibrateComparisonSettings(samples);
      
      expect(result.settings.positionTolerance).toBe(0);
      expect(result.settings.sizeTolerance).toBe(0);
      expect(result.settings.similarityThreshold).toBeGreaterThanOrEqual(95);
      expect(result.confidence).toBe(100);
    });

    it('should handle small position variations', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 1, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 2, y: 1, width: 100, height: 100 }),
        ]),
      ];

      const result = calibrateComparisonSettings(samples);
      
      expect(result.settings.positionTolerance).toBeGreaterThan(0);
      expect(result.settings.positionTolerance).toBeLessThanOrEqual(5);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('should handle size variations', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 102, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 101, height: 101 }),
        ]),
      ];

      const result = calibrateComparisonSettings(samples);
      
      expect(result.settings.sizeTolerance).toBeGreaterThan(0);
      expect(result.settings.sizeTolerance).toBeLessThanOrEqual(5);
    });

    it('should handle text variations', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Loading...'),
        ]),
        createSample([
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Complete'),
        ]),
        createSample([
          createNode('p', 'text', { x: 10, y: 10, width: 80, height: 20 }, 'Processing'),
        ]),
      ];

      const result = calibrateComparisonSettings(samples);
      
      expect(result.settings.ignoreText).toBe(true);
      expect(result.confidence).toBeLessThan(100);
    });

    it('should handle dynamic elements that appear and disappear', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('div', 'popup', { x: 50, y: 50, width: 200, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          // popup missing
        ]),
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('div', 'popup', { x: 50, y: 50, width: 200, height: 100 }),
        ]),
      ];

      const result = calibrateComparisonSettings(samples);
      
      expect(result.settings.similarityThreshold).toBeLessThan(95);
      expect(result.confidence).toBeLessThan(100);
      expect(result.sampleStats).toBeDefined();
    });

    it('should respect strictness levels', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 5, y: 5, width: 105, height: 105 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 3, y: 3, width: 103, height: 103 }),
        ]),
      ];

      // Low strictness - more tolerant
      const lowResult = calibrateComparisonSettings(samples, { strictness: 'low' });
      expect(lowResult.settings.positionTolerance).toBeGreaterThan(5);
      expect(lowResult.settings.similarityThreshold).toBeLessThan(95);

      // High strictness - less tolerant
      const highResult = calibrateComparisonSettings(samples, { strictness: 'high' });
      expect(highResult.settings.positionTolerance).toBeLessThanOrEqual(5);
      expect(highResult.settings.similarityThreshold).toBeGreaterThanOrEqual(95);
    });

    it('should require at least 2 samples', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
        ]),
      ];

      expect(() => calibrateComparisonSettings(samples)).toThrow();
    });

    it('should provide detailed sample statistics', () => {
      const samples: VisualTreeAnalysis[] = [
        createSample([
          createNode('div', 'container', { x: 0, y: 0, width: 100, height: 100 }),
          createNode('p', 'text1', { x: 10, y: 10, width: 80, height: 20 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 1, y: 1, width: 101, height: 101 }),
          createNode('p', 'text1', { x: 11, y: 11, width: 81, height: 21 }),
        ]),
        createSample([
          createNode('div', 'container', { x: 2, y: 0, width: 102, height: 100 }),
          createNode('p', 'text1', { x: 12, y: 10, width: 82, height: 20 }),
        ]),
      ];

      const result = calibrateComparisonSettings(samples);
      
      expect(result.sampleStats).toBeDefined();
      expect(result.sampleStats.avgSimilarity).toBeGreaterThan(0);
      expect(result.sampleStats.avgSimilarity).toBeLessThanOrEqual(100);
      expect(result.sampleStats.minSimilarity).toBeLessThanOrEqual(result.sampleStats.avgSimilarity);
      expect(result.sampleStats.maxSimilarity).toBeGreaterThanOrEqual(result.sampleStats.avgSimilarity);
      expect(result.sampleStats.totalElements).toBe(2);
      expect(result.sampleStats.stableElements).toBeGreaterThanOrEqual(0);
      expect(result.sampleStats.dynamicElements).toBeGreaterThanOrEqual(0);
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