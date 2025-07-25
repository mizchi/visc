/**
 * テキスト処理のユーティリティ関数
 */

/**
 * テキストを正規化する
 * - 余分な空白を削除
 * - 改行を統一
 * - 大文字小文字を統一（オプション）
 */
export function normalizeText(
  text: string,
  options: {
    caseSensitive?: boolean;
    removeExtraSpaces?: boolean;
    trimLines?: boolean;
  } = {}
): string {
  const {
    caseSensitive = true,
    removeExtraSpaces = true,
    trimLines = true,
  } = options;

  let normalized = text;

  // 改行を統一
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 各行をトリム
  if (trimLines) {
    normalized = normalized
      .split('\n')
      .map(line => line.trim())
      .join('\n');
  }

  // 余分な空白を削除
  if (removeExtraSpaces) {
    // 複数の空白を1つに
    normalized = normalized.replace(/[ \t]+/g, ' ');
    // 複数の改行を1つに
    normalized = normalized.replace(/\n+/g, '\n');
  }

  // 前後の空白を削除
  normalized = normalized.trim();

  // 大文字小文字を統一
  if (!caseSensitive) {
    normalized = normalized.toLowerCase();
  }

  return normalized;
}

/**
 * レーベンシュタイン距離を計算する
 * 2つの文字列の編集距離を返す
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // 空文字列の場合
  if (m === 0) return n;
  if (n === 0) return m;

  // DPテーブルを作成
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // 初期化
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // DPで距離を計算
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 削除
        dp[i][j - 1] + 1,      // 挿入
        dp[i - 1][j - 1] + cost // 置換
      );
    }
  }

  return dp[m][n];
}

/**
 * テキストの類似度を計算する（0-1の範囲）
 * レーベンシュタイン距離を基に正規化
 */
export function textSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  if (text1.length === 0 && text2.length === 0) return 1;
  if (text1.length === 0 || text2.length === 0) return 0;

  const distance = levenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  
  // 距離を0-1の範囲に正規化
  return 1 - (distance / maxLength);
}

/**
 * 正規化されたテキストの類似度を計算
 */
export function normalizedTextSimilarity(
  text1: string,
  text2: string,
  options: {
    caseSensitive?: boolean;
    removeExtraSpaces?: boolean;
    trimLines?: boolean;
    threshold?: number;
  } = {}
): { similarity: number; isSimiilar: boolean } {
  const { threshold = 0.8, ...normalizeOptions } = options;

  const normalized1 = normalizeText(text1, normalizeOptions);
  const normalized2 = normalizeText(text2, normalizeOptions);

  const similarity = textSimilarity(normalized1, normalized2);

  return {
    similarity,
    isSimiilar: similarity >= threshold,
  };
}