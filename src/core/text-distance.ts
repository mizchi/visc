/**
 * Text distance and similarity calculation functions
 * Pure functions for calculating text-based distances
 */

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 * Returns the minimum number of single-character edits required
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create a 2D array for dynamic programming
  const dp: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= len2; j++) {
    dp[0][j] = j;
  }
  
  // Fill the dp table
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,    // Deletion
        dp[i][j - 1] + 1,    // Insertion
        dp[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  
  return dp[len1][len2];
}

/**
 * Calculate normalized Levenshtein distance (0 to 1)
 */
export function normalizedLevenshteinDistance(
  str1: string,
  str2: string
): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 0;
  return levenshteinDistance(str1, str2) / maxLength;
}

/**
 * Calculate Hamming distance between two strings of equal length
 * Returns the number of positions at which the characters differ
 */
export function hammingDistance(str1: string, str2: string): number {
  if (str1.length !== str2.length) {
    throw new Error('Hamming distance requires strings of equal length');
  }
  
  let distance = 0;
  for (let i = 0; i < str1.length; i++) {
    if (str1[i] !== str2[i]) {
      distance++;
    }
  }
  
  return distance;
}

/**
 * Calculate Jaro similarity between two strings
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
export function jaroSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0 && len2 === 0) return 1;
  if (len1 === 0 || len2 === 0) return 0;
  
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const str1Matches = new Array(len1).fill(false);
  const str2Matches = new Array(len2).fill(false);
  
  let matches = 0;
  let transpositions = 0;
  
  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);
    
    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }
  
  if (matches === 0) return 0;
  
  // Count transpositions
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }
  
  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  );
}

/**
 * Calculate Jaro-Winkler similarity
 * Enhanced version of Jaro that gives more weight to strings with common prefixes
 */
export function jaroWinklerSimilarity(
  str1: string,
  str2: string,
  prefixScale: number = 0.1
): number {
  const jaroSim = jaroSimilarity(str1, str2);
  
  // Find common prefix length (up to 4 characters)
  let prefixLength = 0;
  for (let i = 0; i < Math.min(str1.length, str2.length, 4); i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }
  
  return jaroSim + prefixLength * prefixScale * (1 - jaroSim);
}

/**
 * Calculate Dice coefficient (Sørensen–Dice coefficient)
 * Based on bigram similarity
 */
export function diceCoefficient(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;
  
  const bigrams1 = new Set<string>();
  const bigrams2 = new Set<string>();
  
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }
  
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.substring(i, i + 2));
  }
  
  const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));
  
  return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
}

/**
 * Calculate longest common subsequence length
 */
export function longestCommonSubsequence(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Calculate longest common substring length
 */
export function longestCommonSubstring(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  let maxLength = 0;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        maxLength = Math.max(maxLength, dp[i][j]);
      }
    }
  }
  
  return maxLength;
}

/**
 * Calculate token-based similarity (for word-level comparison)
 */
export function tokenSimilarity(
  text1: string,
  text2: string,
  separator: string | RegExp = /\s+/
): number {
  const tokens1 = new Set(text1.split(separator).filter(t => t.length > 0));
  const tokens2 = new Set(text2.split(separator).filter(t => t.length > 0));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate fuzzy string matching score
 * Combines multiple distance metrics for robust comparison
 */
export function fuzzyStringMatch(
  str1: string,
  str2: string,
  weights: {
    levenshtein?: number;
    jaro?: number;
    dice?: number;
    token?: number;
  } = {}
): number {
  const {
    levenshtein = 0.3,
    jaro = 0.3,
    dice = 0.2,
    token = 0.2,
  } = weights;
  
  const scores = [
    (1 - normalizedLevenshteinDistance(str1, str2)) * levenshtein,
    jaroWinklerSimilarity(str1, str2) * jaro,
    diceCoefficient(str1, str2) * dice,
    tokenSimilarity(str1, str2) * token,
  ];
  
  return scores.reduce((sum, score) => sum + score, 0);
}

/**
 * Check if strings are similar based on threshold
 */
export function areStringsSimilar(
  str1: string,
  str2: string,
  threshold: number = 0.8,
  metric: 'levenshtein' | 'jaro' | 'dice' | 'fuzzy' = 'fuzzy'
): boolean {
  let similarity: number;
  
  switch (metric) {
    case 'levenshtein':
      similarity = 1 - normalizedLevenshteinDistance(str1, str2);
      break;
    case 'jaro':
      similarity = jaroWinklerSimilarity(str1, str2);
      break;
    case 'dice':
      similarity = diceCoefficient(str1, str2);
      break;
    case 'fuzzy':
      similarity = fuzzyStringMatch(str1, str2);
      break;
  }
  
  return similarity >= threshold;
}