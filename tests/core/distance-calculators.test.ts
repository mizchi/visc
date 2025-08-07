import { describe, it, expect } from 'vitest';
import {
  euclideanDistance,
  manhattanDistance,
  chebyshevDistance,
  getRectCenter,
  rectDistance,
  minRectDistance,
  rectOverlapArea,
  rectIoU,
  normalizedPositionDifference,
  normalizedSizeDifference,
  aspectRatioDifference,
  relativePosition,
  rectContainsPoint,
  rectContainsRect,
  weightedLayoutDistance,
} from '../../src/core/distance-calculators';

describe('Distance Calculators', () => {
  describe('euclideanDistance', () => {
    it('should calculate distance between two points', () => {
      expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
      expect(euclideanDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
      expect(euclideanDistance({ x: -1, y: -1 }, { x: 1, y: 1 })).toBeCloseTo(2.828, 3);
    });
  });

  describe('manhattanDistance', () => {
    it('should calculate Manhattan distance', () => {
      expect(manhattanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(7);
      expect(manhattanDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
      expect(manhattanDistance({ x: -1, y: -1 }, { x: 1, y: 1 })).toBe(4);
    });
  });

  describe('chebyshevDistance', () => {
    it('should calculate Chebyshev distance', () => {
      expect(chebyshevDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(4);
      expect(chebyshevDistance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
      expect(chebyshevDistance({ x: -1, y: -1 }, { x: 1, y: 1 })).toBe(2);
    });
  });

  describe('getRectCenter', () => {
    it('should calculate rectangle center', () => {
      expect(getRectCenter({ x: 0, y: 0, width: 10, height: 10 })).toEqual({ x: 5, y: 5 });
      expect(getRectCenter({ x: 10, y: 20, width: 20, height: 30 })).toEqual({ x: 20, y: 35 });
    });
  });

  describe('rectDistance', () => {
    it('should calculate distance between rectangle centers', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 20, y: 0, width: 10, height: 10 };
      expect(rectDistance(rect1, rect2)).toBe(20);
    });
  });

  describe('minRectDistance', () => {
    it('should calculate minimum distance between rectangles', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 20, y: 0, width: 10, height: 10 };
      expect(minRectDistance(rect1, rect2)).toBe(10); // Gap between rectangles
    });

    it('should return 0 for overlapping rectangles', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 5, y: 5, width: 10, height: 10 };
      expect(minRectDistance(rect1, rect2)).toBe(0);
    });

    it('should calculate diagonal distance', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 20, y: 20, width: 10, height: 10 };
      expect(minRectDistance(rect1, rect2)).toBeCloseTo(14.142, 3); // sqrt(10^2 + 10^2)
    });
  });

  describe('rectOverlapArea', () => {
    it('should calculate overlap area', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 5, y: 5, width: 10, height: 10 };
      expect(rectOverlapArea(rect1, rect2)).toBe(25); // 5x5 overlap
    });

    it('should return 0 for non-overlapping rectangles', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 20, y: 20, width: 10, height: 10 };
      expect(rectOverlapArea(rect1, rect2)).toBe(0);
    });

    it('should handle complete overlap', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 0, y: 0, width: 10, height: 10 };
      expect(rectOverlapArea(rect1, rect2)).toBe(100);
    });
  });

  describe('rectIoU', () => {
    it('should calculate Intersection over Union', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 0, y: 0, width: 10, height: 10 };
      expect(rectIoU(rect1, rect2)).toBe(1); // Complete overlap
    });

    it('should return 0 for non-overlapping rectangles', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 20, y: 20, width: 10, height: 10 };
      expect(rectIoU(rect1, rect2)).toBe(0);
    });

    it('should calculate partial IoU', () => {
      const rect1 = { x: 0, y: 0, width: 10, height: 10 };
      const rect2 = { x: 5, y: 5, width: 10, height: 10 };
      // Intersection: 25, Union: 100 + 100 - 25 = 175
      expect(rectIoU(rect1, rect2)).toBeCloseTo(25 / 175, 5);
    });
  });

  describe('normalizedPositionDifference', () => {
    it('should normalize position difference', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 100, y: 100 };
      const bounds = { width: 100, height: 100 };
      expect(normalizedPositionDifference(p1, p2, bounds)).toBe(1);
    });

    it('should return 0 for same position', () => {
      const p1 = { x: 50, y: 50 };
      const p2 = { x: 50, y: 50 };
      const bounds = { width: 100, height: 100 };
      expect(normalizedPositionDifference(p1, p2, bounds)).toBe(0);
    });
  });

  describe('normalizedSizeDifference', () => {
    it('should calculate normalized size difference', () => {
      const size1 = { width: 100, height: 100 };
      const size2 = { width: 100, height: 100 };
      expect(normalizedSizeDifference(size1, size2)).toBe(0);
    });

    it('should handle different sizes', () => {
      const size1 = { width: 100, height: 100 };
      const size2 = { width: 200, height: 200 };
      expect(normalizedSizeDifference(size1, size2)).toBe(0.5);
    });

    it('should handle zero sizes', () => {
      const size1 = { width: 0, height: 0 };
      const size2 = { width: 0, height: 0 };
      expect(normalizedSizeDifference(size1, size2)).toBe(0);
    });
  });

  describe('aspectRatioDifference', () => {
    it('should calculate aspect ratio difference', () => {
      const size1 = { width: 100, height: 100 };
      const size2 = { width: 100, height: 100 };
      expect(aspectRatioDifference(size1, size2)).toBe(0); // Same ratio
    });

    it('should handle different aspect ratios', () => {
      const size1 = { width: 100, height: 100 }; // 1:1
      const size2 = { width: 200, height: 100 }; // 2:1
      expect(aspectRatioDifference(size1, size2)).toBe(0.5);
    });
  });

  describe('relativePosition', () => {
    it('should calculate relative position', () => {
      const child = { x: 50, y: 50 };
      const parent = { x: 10, y: 10 };
      expect(relativePosition(child, parent)).toEqual({ x: 40, y: 40 });
    });
  });

  describe('rectContainsPoint', () => {
    it('should check if rectangle contains point', () => {
      const rect = { x: 0, y: 0, width: 10, height: 10 };
      expect(rectContainsPoint(rect, { x: 5, y: 5 })).toBe(true);
      expect(rectContainsPoint(rect, { x: 15, y: 15 })).toBe(false);
      expect(rectContainsPoint(rect, { x: 0, y: 0 })).toBe(true); // Edge case
      expect(rectContainsPoint(rect, { x: 10, y: 10 })).toBe(true); // Edge case
    });
  });

  describe('rectContainsRect', () => {
    it('should check if one rectangle contains another', () => {
      const rect1 = { x: 0, y: 0, width: 100, height: 100 };
      const rect2 = { x: 10, y: 10, width: 50, height: 50 };
      expect(rectContainsRect(rect1, rect2)).toBe(true);
    });

    it('should return false for non-contained rectangles', () => {
      const rect1 = { x: 0, y: 0, width: 100, height: 100 };
      const rect2 = { x: 50, y: 50, width: 100, height: 100 };
      expect(rectContainsRect(rect1, rect2)).toBe(false);
    });

    it('should handle identical rectangles', () => {
      const rect = { x: 0, y: 0, width: 100, height: 100 };
      expect(rectContainsRect(rect, rect)).toBe(true);
    });
  });

  describe('weightedLayoutDistance', () => {
    it('should calculate weighted distance with default weights', () => {
      const layout1 = { x: 0, y: 0, width: 100, height: 100 };
      const layout2 = { x: 0, y: 0, width: 100, height: 100 };
      expect(weightedLayoutDistance(layout1, layout2)).toBe(0);
    });

    it('should apply custom weights', () => {
      const layout1 = { x: 0, y: 0, width: 100, height: 100 };
      const layout2 = { x: 100, y: 100, width: 200, height: 100 };
      const weights = { position: 0, size: 1, aspectRatio: 0 };
      const result = weightedLayoutDistance(layout1, layout2, weights);
      expect(result).toBeCloseTo(0.25, 2); // Only size difference matters (normalized)
    });
  });
});