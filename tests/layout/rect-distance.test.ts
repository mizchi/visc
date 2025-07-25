import { describe, test, expect } from 'vitest';
import {
  extractRectFeatures,
  calculateRectDistance,
  calculateGroupSimilarity,
  calculateLayoutSimilarity,
  generateLayoutFingerprint,
  isSameLayoutStructure,
  type SemanticGroup
} from '../../src/layout/rect-distance.js';

describe('rect-distance', () => {
  const viewport = { width: 1920, height: 1080 };

  describe('extractRectFeatures', () => {
    test('矩形の特徴を正しく抽出する', () => {
      const rect = { x: 100, y: 200, width: 300, height: 400 };
      const features = extractRectFeatures(rect, viewport);

      expect(features.normalizedX).toBeCloseTo(100 / 1920);
      expect(features.normalizedY).toBeCloseTo(200 / 1080);
      expect(features.normalizedWidth).toBeCloseTo(300 / 1920);
      expect(features.normalizedHeight).toBeCloseTo(400 / 1080);
      expect(features.aspectRatio).toBeCloseTo(0.75);
      expect(features.centerX).toBeCloseTo(250 / 1920);
      expect(features.centerY).toBeCloseTo(400 / 1080);
    });
  });

  describe('calculateRectDistance', () => {
    test('同じ矩形の距離は0', () => {
      const rect = { x: 100, y: 100, width: 200, height: 200 };
      const distance = calculateRectDistance(rect, rect, { viewport });
      
      expect(distance).toBe(0);
    });

    test('位置が異なる矩形の距離を計算', () => {
      const rect1 = { x: 100, y: 100, width: 200, height: 200 };
      const rect2 = { x: 300, y: 300, width: 200, height: 200 };
      const distance = calculateRectDistance(rect1, rect2, { viewport });
      
      expect(distance).toBeGreaterThan(0);
    });

    test('サイズが異なる矩形の距離を計算', () => {
      const rect1 = { x: 100, y: 100, width: 200, height: 200 };
      const rect2 = { x: 100, y: 100, width: 400, height: 400 };
      const distance = calculateRectDistance(rect1, rect2, { viewport });
      
      expect(distance).toBeGreaterThan(0);
    });

    test('カスタム重みで距離を計算', () => {
      const rect1 = { x: 100, y: 100, width: 200, height: 200 };
      const rect2 = { x: 300, y: 100, width: 200, height: 200 };
      
      const distance1 = calculateRectDistance(rect1, rect2, { 
        viewport, 
        positionWeight: 1, 
        sizeWeight: 0, 
        aspectRatioWeight: 0 
      });
      
      const distance2 = calculateRectDistance(rect1, rect2, { 
        viewport, 
        positionWeight: 0, 
        sizeWeight: 1, 
        aspectRatioWeight: 0 
      });
      
      expect(distance1).toBeGreaterThan(distance2);
    });
  });

  describe('calculateGroupSimilarity', () => {
    test('同じグループの類似度は1に近い', () => {
      const group: SemanticGroup = {
        id: 'group-1',
        type: 'navigation',
        bounds: { x: 0, y: 0, width: 1920, height: 100 },
        elements: [{}, {}, {}],
        children: [],
        depth: 0,
        label: 'Header Navigation',
        importance: 80
      };

      const similarity = calculateGroupSimilarity(group, group);
      expect(similarity).toBeGreaterThanOrEqual(0.8);
    });

    test('異なるタイプのグループの類似度は0', () => {
      const group1: SemanticGroup = {
        id: 'group-1',
        type: 'navigation',
        bounds: { x: 0, y: 0, width: 1920, height: 100 },
        elements: [],
        children: [],
        depth: 0,
        label: 'Navigation',
        importance: 80
      };

      const group2: SemanticGroup = {
        id: 'group-2',
        type: 'content',
        bounds: { x: 0, y: 0, width: 1920, height: 100 },
        elements: [],
        children: [],
        depth: 0,
        label: 'Content',
        importance: 80
      };

      const similarity = calculateGroupSimilarity(group1, group2);
      expect(similarity).toBe(0);
    });

    test('位置とサイズが似ているグループの類似度は高い', () => {
      const group1: SemanticGroup = {
        id: 'group-1',
        type: 'navigation',
        bounds: { x: 0, y: 0, width: 1920, height: 100 },
        elements: [{}, {}, {}],
        children: [],
        depth: 0,
        label: 'Nav 1',
        importance: 80
      };

      const group2: SemanticGroup = {
        id: 'group-2',
        type: 'navigation',
        bounds: { x: 10, y: 10, width: 1900, height: 90 },
        elements: [{}, {}, {}],
        children: [],
        depth: 0,
        label: 'Nav 2',
        importance: 75
      };

      const similarity = calculateGroupSimilarity(group1, group2);
      expect(similarity).toBeGreaterThan(0.7);
    });
  });

  describe('calculateLayoutSimilarity', () => {
    test('同じレイアウトの類似度は高い', () => {
      const groups: SemanticGroup[] = [
        {
          id: 'group-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        },
        {
          id: 'group-2',
          type: 'content',
          bounds: { x: 0, y: 100, width: 1920, height: 800 },
          elements: [{}, {}, {}, {}, {}],
          children: [],
          depth: 0,
          label: 'Main Content',
          importance: 90
        }
      ];

      const result = calculateLayoutSimilarity(groups, groups);
      expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      expect(result.matchedGroups).toHaveLength(2);
    });

    test('異なるレイアウトの類似度は低い', () => {
      const groups1: SemanticGroup[] = [
        {
          id: 'group-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        }
      ];

      const groups2: SemanticGroup[] = [
        {
          id: 'group-2',
          type: 'content',
          bounds: { x: 0, y: 500, width: 960, height: 400 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Content',
          importance: 60
        }
      ];

      const result = calculateLayoutSimilarity(groups1, groups2);
      expect(result.similarity).toBeLessThan(0.5);
      expect(result.matchedGroups).toHaveLength(0);
    });

    test('部分的に一致するレイアウトの類似度は中程度', () => {
      const groups1: SemanticGroup[] = [
        {
          id: 'group-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        },
        {
          id: 'group-2',
          type: 'content',
          bounds: { x: 0, y: 100, width: 1920, height: 800 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Content',
          importance: 90
        }
      ];

      const groups2: SemanticGroup[] = [
        {
          id: 'group-3',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 120 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 75
        },
        {
          id: 'group-4',
          type: 'section',
          bounds: { x: 0, y: 900, width: 1920, height: 100 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Footer',
          importance: 50
        }
      ];

      const result = calculateLayoutSimilarity(groups1, groups2);
      expect(result.similarity).toBeGreaterThan(0.3);
      expect(result.similarity).toBeLessThan(0.7);
      expect(result.matchedGroups).toHaveLength(1);
    });
  });

  describe('generateLayoutFingerprint', () => {
    test('レイアウトのフィンガープリントを生成', () => {
      const groups: SemanticGroup[] = [
        {
          id: 'group-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [{}, {}, {}],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        },
        {
          id: 'group-2',
          type: 'content',
          bounds: { x: 0, y: 100, width: 1920, height: 800 },
          elements: [{}, {}, {}, {}, {}],
          children: [],
          depth: 0,
          label: 'Content',
          importance: 90
        }
      ];

      const fingerprint = generateLayoutFingerprint(groups);
      expect(fingerprint).toContain('navigation:0,0,19,1:3');
      expect(fingerprint).toContain('content:0,1,19,8:5');
    });

    test('同じ構造のレイアウトは同じフィンガープリント', () => {
      const groups1: SemanticGroup[] = [
        {
          id: 'g1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Nav',
          importance: 80
        }
      ];

      const groups2: SemanticGroup[] = [
        {
          id: 'g2',
          type: 'navigation',
          bounds: { x: 5, y: 5, width: 1910, height: 105 },
          elements: [{}, {}],
          children: [],
          depth: 0,
          label: 'Navigation',
          importance: 75
        }
      ];

      const fp1 = generateLayoutFingerprint(groups1);
      const fp2 = generateLayoutFingerprint(groups2);
      
      expect(fp1).toBe(fp2);
    });
  });

  describe('isSameLayoutStructure', () => {
    test('同じ構造のレイアウトを識別', () => {
      const groups1: SemanticGroup[] = [
        {
          id: 'group-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        }
      ];

      const groups2: SemanticGroup[] = [
        {
          id: 'group-2',
          type: 'navigation',
          bounds: { x: 10, y: 10, width: 1900, height: 90 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Header Nav',
          importance: 75
        }
      ];

      expect(isSameLayoutStructure(groups1, groups2, 0.7)).toBe(true);
    });

    test('異なる構造のレイアウトを識別', () => {
      const groups1: SemanticGroup[] = [
        {
          id: 'group-1',
          type: 'navigation',
          bounds: { x: 0, y: 0, width: 1920, height: 100 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Header',
          importance: 80
        }
      ];

      const groups2: SemanticGroup[] = [
        {
          id: 'group-2',
          type: 'content',
          bounds: { x: 500, y: 500, width: 500, height: 500 },
          elements: [],
          children: [],
          depth: 0,
          label: 'Content',
          importance: 50
        }
      ];

      expect(isSameLayoutStructure(groups1, groups2)).toBe(false);
    });
  });
});