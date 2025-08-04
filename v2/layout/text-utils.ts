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

/**
 * テキストの差分をハイライトする
 */
export function highlightTextDiff(
  text1: string,
  text2: string,
  options: {
    addedTag?: string;
    removedTag?: string;
  } = {}
): { highlighted1: string; highlighted2: string } {
  const { addedTag = '<ins>', removedTag = '<del>' } = options;
  
  // Myersの差分アルゴリズムを使用（簡易版）
  const diff = (a: string[], b: string[]) => {
    const m = a.length;
    const n = b.length;
    const v: { [key: number]: number } = { 1: 0 };
    const paths = [];

    for (let d = 0; d <= m + n; d++) {
      const path = { v: { ...v }, d };
      paths.push(path);

      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
          x = v[k + 1];
        } else {
          x = v[k - 1] + 1;
        }
        
        let y = x - k;
        
        while (x < m && y < n && a[x] === b[y]) {
          x++;
          y++;
        }
        
        v[k] = x;
        
        if (x >= m && y >= n) {
          return paths;
        }
      }
    }
    return paths;
  };

  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  
  // 差分を計算
  const paths = diff(lines1, lines2);
  
  // 差分を再構築
  let x = lines1.length;
  let y = lines2.length;
  const result1: string[] = [];
  const result2: string[] = [];

  for (let d = paths.length - 1; d >= 0; d--) {
    const { v } = paths[d];
    const k = x - y;
    
    let prev_k;
    if (k === -d || (k !== d && v[k - 1] < v[k + 1])) {
      prev_k = k + 1;
    } else {
      prev_k = k - 1;
    }
    
    const prev_x = v[prev_k];
    const prev_y = prev_x - prev_k;
    
    while (x > prev_x && y > prev_y) {
      result1.unshift(lines1[x - 1]);
      result2.unshift(lines2[y - 1]);
      x--;
      y--;
    }
    
    if (d > 0) {
      if (x > prev_x) {
        result1.unshift(`${removedTag}${lines1[x - 1]}${removedTag.replace('<', '</')}`);
      } else {
        result2.unshift(`${addedTag}${lines2[y - 1]}${addedTag.replace('<', '</')}`);
      }
    }
    
    x = prev_x;
    y = prev_y;
  }

  return {
    highlighted1: result1.join('\n'),
    highlighted2: result2.join('\n'),
  };
}
