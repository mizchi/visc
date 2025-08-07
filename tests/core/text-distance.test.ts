import { describe, it, expect } from 'vitest';
import {
  levenshteinDistance,
  normalizedLevenshteinDistance,
  hammingDistance,
  jaroSimilarity,
  jaroWinklerSimilarity,
  diceCoefficient,
  longestCommonSubsequence,
  longestCommonSubstring,
  tokenSimilarity,
  fuzzyStringMatch,
  areStringsSimilar,
} from '../../src/core/text-distance';

describe('Text Distance Functions', () => {
  describe('levenshteinDistance', () => {
    it('should calculate edit distance', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('should handle single character differences', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
      expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
      expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
    });
  });

  describe('normalizedLevenshteinDistance', () => {
    it('should return normalized distance between 0 and 1', () => {
      expect(normalizedLevenshteinDistance('hello', 'hello')).toBe(0);
      expect(normalizedLevenshteinDistance('', '')).toBe(0);
      expect(normalizedLevenshteinDistance('abc', 'xyz')).toBe(1);
      expect(normalizedLevenshteinDistance('kitten', 'sitting')).toBeCloseTo(3/7, 5);
    });
  });

  describe('hammingDistance', () => {
    it('should calculate Hamming distance for equal length strings', () => {
      expect(hammingDistance('karolin', 'kathrin')).toBe(3);
      expect(hammingDistance('1011101', '1001001')).toBe(2);
      expect(hammingDistance('hello', 'hello')).toBe(0);
    });

    it('should throw error for different length strings', () => {
      expect(() => hammingDistance('short', 'longer')).toThrow();
    });
  });

  describe('jaroSimilarity', () => {
    it('should calculate Jaro similarity', () => {
      expect(jaroSimilarity('', '')).toBe(1);
      expect(jaroSimilarity('hello', 'hello')).toBe(1);
      expect(jaroSimilarity('martha', 'marhta')).toBeCloseTo(0.944, 3);
      expect(jaroSimilarity('dixon', 'dicksonx')).toBeCloseTo(0.767, 3);
      expect(jaroSimilarity('jellyfish', 'smellyfish')).toBeCloseTo(0.896, 3);
    });
  });

  describe('jaroWinklerSimilarity', () => {
    it('should give bonus for common prefixes', () => {
      expect(jaroWinklerSimilarity('martha', 'marhta')).toBeCloseTo(0.961, 3);
      expect(jaroWinklerSimilarity('prefix', 'prefixa')).toBeGreaterThan(
        jaroSimilarity('prefix', 'prefixa')
      );
    });

    it('should handle identical strings', () => {
      expect(jaroWinklerSimilarity('test', 'test')).toBe(1);
    });
  });

  describe('diceCoefficient', () => {
    it('should calculate Dice coefficient', () => {
      expect(diceCoefficient('hello', 'hello')).toBe(1);
      expect(diceCoefficient('night', 'nacht')).toBeCloseTo(0.25, 2);
      expect(diceCoefficient('abc', 'xyz')).toBe(0);
    });

    it('should handle short strings', () => {
      expect(diceCoefficient('a', 'b')).toBe(0);
      expect(diceCoefficient('ab', 'ab')).toBe(1);
    });
  });

  describe('longestCommonSubsequence', () => {
    it('should find LCS length', () => {
      expect(longestCommonSubsequence('ABCDGH', 'AEDFHR')).toBe(3); // ADH
      expect(longestCommonSubsequence('AGGTAB', 'GXTXAYB')).toBe(4); // GTAB
      expect(longestCommonSubsequence('hello', 'hello')).toBe(5);
      expect(longestCommonSubsequence('', 'abc')).toBe(0);
    });
  });

  describe('longestCommonSubstring', () => {
    it('should find longest common substring', () => {
      expect(longestCommonSubstring('GeeksforGeeks', 'GeeksQuiz')).toBe(5); // "Geeks"
      expect(longestCommonSubstring('abcdxyz', 'xyzabcd')).toBe(4); // "abcd"
      expect(longestCommonSubstring('abc', 'def')).toBe(0);
      expect(longestCommonSubstring('hello', 'hello')).toBe(5);
    });
  });

  describe('tokenSimilarity', () => {
    it('should calculate token-based similarity', () => {
      expect(tokenSimilarity('hello world', 'hello world')).toBe(1);
      expect(tokenSimilarity('hello world', 'world hello')).toBe(1); // Order doesn't matter
      expect(tokenSimilarity('the quick brown fox', 'the lazy brown dog')).toBeCloseTo(1/3, 5); // 2/6 unique tokens
    });

    it('should handle empty strings', () => {
      expect(tokenSimilarity('', '')).toBe(1);
      expect(tokenSimilarity('hello', '')).toBe(0);
    });

    it('should work with custom separators', () => {
      expect(tokenSimilarity('a,b,c', 'b,c,d', ',')).toBe(0.5); // 2/4 tokens match
    });
  });

  describe('fuzzyStringMatch', () => {
    it('should combine multiple metrics', () => {
      expect(fuzzyStringMatch('hello', 'hello')).toBe(1);
      expect(fuzzyStringMatch('hello', 'helo')).toBeGreaterThan(0.65);
      expect(fuzzyStringMatch('completely', 'different')).toBeLessThan(0.3);
    });

    it('should respect custom weights', () => {
      const weights = { levenshtein: 1, jaro: 0, dice: 0, token: 0 };
      expect(fuzzyStringMatch('hello', 'hello', weights)).toBe(1);
      expect(fuzzyStringMatch('hello', 'helo', weights)).toBeCloseTo(0.8, 2);
    });
  });

  describe('areStringsSimilar', () => {
    it('should check similarity with threshold', () => {
      expect(areStringsSimilar('hello', 'hello', 0.8)).toBe(true);
      expect(areStringsSimilar('hello', 'helo', 0.65)).toBe(true);
      expect(areStringsSimilar('hello', 'goodbye', 0.8)).toBe(false);
    });

    it('should work with different metrics', () => {
      expect(areStringsSimilar('hello', 'helo', 0.7, 'levenshtein')).toBe(true);
      expect(areStringsSimilar('prefix', 'prefixa', 0.9, 'jaro')).toBe(true);
      expect(areStringsSimilar('night', 'nacht', 0.2, 'dice')).toBe(true);
    });
  });
});