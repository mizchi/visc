/**
 * Tests for viewport modes in SVG rendering
 */

import { describe, it, expect } from 'vitest';
import { renderMovementToSvg } from '../src/renderer/movement-renderer.js';
import type { GroupCorrespondence } from '../src/layout/accessibility-matcher.js';
import type { VisualNodeGroup } from '../src/types.js';

function createMockGroup(x: number, y: number, width: number, height: number, label: string): VisualNodeGroup {
  return {
    type: 'content',
    label,
    bounds: { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height },
    importance: 50,
    children: [],
  };
}

function createMockCorrespondence(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number,
  label: string
): GroupCorrespondence {
  return {
    group1: createMockGroup(x1, y1, w1, h1, label),
    group2: createMockGroup(x2, y2, w2, h2, label),
    match: {
      confidence: 0.95,
      matchReason: ['test'],
      positionShift: { x: x2 - x1, y: y2 - y1 },
      isShifted: true,
    },
    positionShift: { x: x2 - x1, y: y2 - y1 },
    sizeChange: { width: w2 - w1, height: h2 - h1 },
    selector: `.${label}`,
  };
}

describe('Viewport Modes in SVG Rendering', () => {
  const viewport = { 
    width: 1024, 
    height: 768,
    scrollX: 500,
    scrollY: 1000,
  };

  describe('renderMovementToSvg viewport modes', () => {
    it('should render with viewportOnly mode (default)', () => {
      const correspondences = [
        createMockCorrespondence(0, 0, 100, 50, 1200, 900, 100, 50, 'element1'),
      ];
      
      const svg = renderMovementToSvg(correspondences, viewport, {
        viewportMode: 'viewportOnly'
      });
      
      // Should use viewport dimensions
      expect(svg).toContain('width="1024"');
      expect(svg).toContain('height="768"');
    });

    it('should render with full mode', () => {
      const correspondences = [
        // Element beyond viewport
        createMockCorrespondence(0, 0, 100, 50, 1200, 900, 100, 50, 'element1'),
      ];
      
      const svg = renderMovementToSvg(correspondences, viewport, {
        viewportMode: 'full'
      });
      
      // Should expand to contain all elements plus padding
      expect(svg).toContain('width="1350"'); // 1200 + 100 + 50 padding
      expect(svg).toContain('height="1000"'); // 900 + 50 + 50 padding
    });

    it('should render with fullScroll mode', () => {
      const correspondences = [
        createMockCorrespondence(0, 0, 100, 50, 1200, 900, 100, 50, 'element1'),
        createMockCorrespondence(100, 100, 200, 100, 1800, 2000, 200, 100, 'element2'),
      ];
      
      const svg = renderMovementToSvg(correspondences, viewport, {
        viewportMode: 'fullScroll'
      });
      
      // Should include scroll dimensions
      expect(svg).toContain('width="2050"'); // max(1024+500, 1800+200) + 50
      expect(svg).toContain('height="2150"'); // max(768+1000, 2000+100) + 50
    });

    it('should handle empty correspondences', () => {
      const svg = renderMovementToSvg([], viewport, {
        viewportMode: 'full'
      });
      
      // Should fall back to viewport dimensions
      expect(svg).toContain('width="1024"');
      expect(svg).toContain('height="768"');
    });

    it('should handle viewport without scroll values', () => {
      const simpleViewport = { width: 800, height: 600 };
      const correspondences = [
        createMockCorrespondence(0, 0, 100, 50, 900, 700, 100, 50, 'element1'),
      ];
      
      const svg = renderMovementToSvg(correspondences, simpleViewport, {
        viewportMode: 'fullScroll'
      });
      
      // Should work without scroll values
      expect(svg).toContain('width="1050"'); // 900 + 100 + 50
      expect(svg).toContain('height="800"'); // 700 + 50 + 50
    });

    it('should preserve movement rendering across all modes', () => {
      const correspondences = [
        createMockCorrespondence(100, 100, 200, 150, 300, 200, 200, 150, 'movingElement'),
      ];
      
      const modes: Array<'viewportOnly' | 'full' | 'fullScroll'> = ['viewportOnly', 'full', 'fullScroll'];
      
      modes.forEach(mode => {
        const svg = renderMovementToSvg(correspondences, viewport, {
          viewportMode: mode,
          showLabels: true,
          showDistances: true,
        });
        
        // Movement lines and arrows should be present in all modes
        expect(svg).toContain('movement-line');
        expect(svg).toContain('movement-vector');
        expect(svg).toContain('arrowhead');
        
        // Original and new positions should be rendered
        expect(svg).toContain('x="100"'); // Original position
        expect(svg).toContain('x="300"'); // New position
      });
    });

    it('should render legend correctly in all modes', () => {
      const correspondences = [
        createMockCorrespondence(0, 0, 100, 50, 200, 100, 100, 50, 'element1'),
      ];
      
      const modes: Array<'viewportOnly' | 'full' | 'fullScroll'> = ['viewportOnly', 'full', 'fullScroll'];
      
      modes.forEach(mode => {
        const svg = renderMovementToSvg(correspondences, viewport, {
          viewportMode: mode,
          colorScheme: 'severity',
        });
        
        // Legend should be present
        expect(svg).toContain('Movement Legend');
        expect(svg).toContain('Minor');
        expect(svg).toContain('Moderate');
        expect(svg).toContain('Major');
      });
    });
  });
});