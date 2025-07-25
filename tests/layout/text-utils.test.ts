import { describe, test, expect } from 'vitest';
import { 
  normalizeText, 
  levenshteinDistance, 
  textSimilarity,
  normalizedTextSimilarity 
} from '../../src/layout/text-utils.js';

describe('テキスト正規化', () => {
  test('余分な空白を削除する', () => {
    const text = '  Hello   World  \n\n  Test  ';
    const normalized = normalizeText(text);
    expect(normalized).toBe('Hello World\nTest');
  });

  test('改行を統一する', () => {
    const text = 'Line1\r\nLine2\rLine3\nLine4';
    const normalized = normalizeText(text);
    expect(normalized).toBe('Line1\nLine2\nLine3\nLine4');
  });

  test('大文字小文字を統一する', () => {
    const text = 'Hello World';
    const normalized = normalizeText(text, { caseSensitive: false });
    expect(normalized).toBe('hello world');
  });

  test('各行をトリムする', () => {
    const text = '  Line1  \n  Line2  ';
    const normalized = normalizeText(text, { trimLines: true });
    expect(normalized).toBe('Line1\nLine2');
  });

  test('オプションを組み合わせて使用する', () => {
    const text = '  Hello   WORLD  \n\n  Test  ';
    const normalized = normalizeText(text, {
      caseSensitive: false,
      removeExtraSpaces: true,
      trimLines: true
    });
    expect(normalized).toBe('hello world\ntest');
  });
});

describe('レーベンシュタイン距離', () => {
  test('同一文字列の距離は0', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  test('空文字列との距離', () => {
    expect(levenshteinDistance('hello', '')).toBe(5);
    expect(levenshteinDistance('', 'hello')).toBe(5);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  test('1文字の置換', () => {
    expect(levenshteinDistance('hello', 'hallo')).toBe(1);
  });

  test('1文字の挿入', () => {
    expect(levenshteinDistance('hello', 'helllo')).toBe(1);
  });

  test('1文字の削除', () => {
    expect(levenshteinDistance('hello', 'helo')).toBe(1);
  });

  test('複数の操作', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    // k->s, e->i, 挿入g
  });

  test('完全に異なる文字列', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });
});

describe('テキスト類似度', () => {
  test('同一文字列の類似度は1', () => {
    expect(textSimilarity('hello', 'hello')).toBe(1);
  });

  test('空文字列の類似度', () => {
    expect(textSimilarity('', '')).toBe(1);
    expect(textSimilarity('hello', '')).toBe(0);
    expect(textSimilarity('', 'hello')).toBe(0);
  });

  test('1文字違いの類似度', () => {
    const similarity = textSimilarity('hello', 'hallo');
    expect(similarity).toBeCloseTo(0.8, 2); // 4/5 = 0.8
  });

  test('半分が同じ文字列の類似度', () => {
    const similarity = textSimilarity('abcd', 'abxy');
    expect(similarity).toBe(0.5); // 2文字変更、4文字中
  });

  test('完全に異なる文字列の類似度', () => {
    const similarity = textSimilarity('abc', 'xyz');
    expect(similarity).toBe(0);
  });
});

describe('正規化されたテキストの類似度', () => {
  test('正規化により同一になる場合', () => {
    const result = normalizedTextSimilarity(
      '  Hello   World  ',
      'Hello World',
      { removeExtraSpaces: true }
    );
    expect(result.similarity).toBe(1);
    expect(result.isSimiilar).toBe(true);
  });

  test('大文字小文字を無視した比較', () => {
    const result = normalizedTextSimilarity(
      'Hello World',
      'hello world',
      { caseSensitive: false }
    );
    expect(result.similarity).toBe(1);
    expect(result.isSimiilar).toBe(true);
  });

  test('閾値を下回る場合', () => {
    const result = normalizedTextSimilarity(
      'Hello World',
      'Goodbye World',
      { threshold: 0.9 }
    );
    expect(result.similarity).toBeLessThan(0.9);
    expect(result.isSimiilar).toBe(false);
  });

  test('改行と空白の正規化', () => {
    const result = normalizedTextSimilarity(
      'Line 1\r\n\r\nLine 2',
      'Line 1\nLine 2',
      { removeExtraSpaces: true }
    );
    expect(result.similarity).toBe(1);
    expect(result.isSimiilar).toBe(true);
  });

  test('カスタム閾値での判定', () => {
    const result = normalizedTextSimilarity(
      'Hello World',
      'Hello Worlds',
      { threshold: 0.9 }
    );
    expect(result.similarity).toBeGreaterThan(0.9);
    expect(result.isSimiilar).toBe(true);
  });
});