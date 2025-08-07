import { describe, it, expect } from 'vitest';
import {
  jaccardSimilarity,
  jaccardDistance,
  setIntersection,
  setUnion,
  setDifference,
  symmetricDifference,
  isSubset,
  isSuperset,
  areDisjoint,
  diceSimilarity,
  overlapCoefficient,
  cosineSimilarity,
  objectToSet,
  objectSimilarity,
  weightedSetSimilarity,
  accessibilitySimilarity,
  setEditDistance,
  normalizedSetEditDistance,
} from '../../src/core/set-operations';

describe('Set Operations', () => {
  describe('jaccardSimilarity', () => {
    it('should calculate Jaccard similarity', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      expect(jaccardSimilarity(set1, set2)).toBeCloseTo(0.5, 5); // 2/4
    });

    it('should handle identical sets', () => {
      const set = new Set(['a', 'b', 'c']);
      expect(jaccardSimilarity(set, set)).toBe(1);
    });

    it('should handle empty sets', () => {
      expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
      expect(jaccardSimilarity(new Set([1]), new Set())).toBe(0);
    });

    it('should handle disjoint sets', () => {
      const set1 = new Set([1, 2]);
      const set2 = new Set([3, 4]);
      expect(jaccardSimilarity(set1, set2)).toBe(0);
    });
  });

  describe('jaccardDistance', () => {
    it('should calculate Jaccard distance', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      expect(jaccardDistance(set1, set2)).toBeCloseTo(0.5, 5);
    });
  });

  describe('setIntersection', () => {
    it('should find intersection of sets', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      const result = setIntersection(set1, set2);
      expect(Array.from(result)).toEqual([2, 3]);
    });

    it('should handle empty intersection', () => {
      const set1 = new Set([1, 2]);
      const set2 = new Set([3, 4]);
      expect(setIntersection(set1, set2).size).toBe(0);
    });
  });

  describe('setUnion', () => {
    it('should find union of sets', () => {
      const set1 = new Set([1, 2]);
      const set2 = new Set([2, 3]);
      const result = setUnion(set1, set2);
      expect(Array.from(result).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('setDifference', () => {
    it('should find set difference', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      const result = setDifference(set1, set2);
      expect(Array.from(result)).toEqual([1]);
    });
  });

  describe('symmetricDifference', () => {
    it('should find symmetric difference', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      const result = symmetricDifference(set1, set2);
      expect(Array.from(result).sort()).toEqual([1, 4]);
    });
  });

  describe('isSubset', () => {
    it('should check subset relationship', () => {
      expect(isSubset(new Set([1, 2]), new Set([1, 2, 3]))).toBe(true);
      expect(isSubset(new Set([1, 2, 4]), new Set([1, 2, 3]))).toBe(false);
      expect(isSubset(new Set(), new Set([1, 2]))).toBe(true); // Empty set is subset of any set
    });
  });

  describe('isSuperset', () => {
    it('should check superset relationship', () => {
      expect(isSuperset(new Set([1, 2, 3]), new Set([1, 2]))).toBe(true);
      expect(isSuperset(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
    });
  });

  describe('areDisjoint', () => {
    it('should check if sets are disjoint', () => {
      expect(areDisjoint(new Set([1, 2]), new Set([3, 4]))).toBe(true);
      expect(areDisjoint(new Set([1, 2]), new Set([2, 3]))).toBe(false);
      expect(areDisjoint(new Set(), new Set([1]))).toBe(true);
    });
  });

  describe('diceSimilarity', () => {
    it('should calculate Dice coefficient', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      expect(diceSimilarity(set1, set2)).toBeCloseTo(2/3, 5); // 2*2/(3+3)
    });

    it('should handle identical sets', () => {
      const set = new Set(['a', 'b']);
      expect(diceSimilarity(set, set)).toBe(1);
    });
  });

  describe('overlapCoefficient', () => {
    it('should calculate overlap coefficient', () => {
      const set1 = new Set([1, 2]);
      const set2 = new Set([1, 2, 3, 4]);
      expect(overlapCoefficient(set1, set2)).toBe(1); // 2/min(2,4) = 1
    });

    it('should handle empty sets', () => {
      expect(overlapCoefficient(new Set(), new Set([1]))).toBe(0);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      expect(cosineSimilarity(set1, set2)).toBeCloseTo(2/3, 5); // 2/sqrt(3*3)
    });
  });

  describe('objectToSet', () => {
    it('should convert object to set of key-value pairs', () => {
      const obj = { a: 1, b: 'hello', c: true };
      const result = objectToSet(obj);
      expect(result.has('a=1')).toBe(true);
      expect(result.has('b=hello')).toBe(true);
      expect(result.has('c=true')).toBe(true);
      expect(result.size).toBe(3);
    });
  });

  describe('objectSimilarity', () => {
    it('should calculate object similarity', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, c: 3 };
      expect(objectSimilarity(obj1, obj2, 'jaccard')).toBeCloseTo(1/3, 5);
      expect(objectSimilarity(obj1, obj2, 'dice')).toBeCloseTo(0.5, 5);
    });

    it('should handle identical objects', () => {
      const obj = { a: 1, b: 2 };
      expect(objectSimilarity(obj, obj)).toBe(1);
    });
  });

  describe('weightedSetSimilarity', () => {
    it('should calculate weighted similarity', () => {
      const map1 = new Map([['a', 1], ['b', 2]]);
      const map2 = new Map([['b', 2], ['c', 3]]);
      const similarity = weightedSetSimilarity(map1, map2);
      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThan(1);
    });

    it('should handle identical weighted sets', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(weightedSetSimilarity(map, map)).toBeCloseTo(1, 10);
    });

    it('should return 0 for disjoint weighted sets', () => {
      const map1 = new Map([['a', 1]]);
      const map2 = new Map([['b', 2]]);
      expect(weightedSetSimilarity(map1, map2)).toBe(0);
    });
  });

  describe('accessibilitySimilarity', () => {
    it('should compare accessibility attributes', () => {
      const attrs1 = {
        'role': 'button',
        'aria-label': 'Submit',
        'aria-disabled': 'false',
      };
      const attrs2 = {
        'role': 'button',
        'aria-label': 'Submit',
        'aria-pressed': 'true',
      };
      
      const result = accessibilitySimilarity(attrs1, attrs2);
      expect(result.similarity).toBeGreaterThan(0.5); // Most important attrs match
      expect(result.matchedAttributes.has('role')).toBe(true);
      expect(result.matchedAttributes.has('aria-label')).toBe(true);
      expect(result.uniqueToFirst.has('aria-disabled')).toBe(true);
      expect(result.uniqueToSecond.has('aria-pressed')).toBe(true);
    });

    it('should weight important attributes higher', () => {
      const attrs1 = { 'role': 'button', 'data-id': '123' };
      const attrs2 = { 'role': 'button', 'data-id': '456' };
      
      const result = accessibilitySimilarity(attrs1, attrs2);
      expect(result.similarity).toBeGreaterThan(0.5); // role is weighted higher
    });

    it('should handle empty attributes', () => {
      const result = accessibilitySimilarity({}, {});
      expect(result.similarity).toBe(0);
      expect(result.matchedAttributes.size).toBe(0);
    });
  });

  describe('setEditDistance', () => {
    it('should calculate set edit distance', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      expect(setEditDistance(set1, set2)).toBe(2); // Remove 1, add 4
    });

    it('should handle identical sets', () => {
      const set = new Set([1, 2, 3]);
      expect(setEditDistance(set, set)).toBe(0);
    });

    it('should handle disjoint sets', () => {
      const set1 = new Set([1, 2]);
      const set2 = new Set([3, 4]);
      expect(setEditDistance(set1, set2)).toBe(4); // Remove 2, add 2
    });
  });

  describe('normalizedSetEditDistance', () => {
    it('should normalize set edit distance', () => {
      const set1 = new Set([1, 2, 3]);
      const set2 = new Set([2, 3, 4]);
      expect(normalizedSetEditDistance(set1, set2)).toBeCloseTo(1/3, 5); // 2/(2*3)
    });

    it('should return 0 for identical sets', () => {
      const set = new Set([1, 2]);
      expect(normalizedSetEditDistance(set, set)).toBe(0);
    });

    it('should return 1 for completely disjoint sets', () => {
      const set1 = new Set([1]);
      const set2 = new Set([2]);
      expect(normalizedSetEditDistance(set1, set2)).toBe(1);
    });
  });
});