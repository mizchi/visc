/**
 * Text distance and similarity calculation functions
 * Pure functions for calculating text-based distances
 * 
 * This module provides string comparison algorithms for:
 * - Text content changes (button labels, headings)
 * - Identifier matching (classes, IDs, data attributes)
 * - Fuzzy string matching for element correlation
 * - Natural language content comparison
 * 
 * Choose the right algorithm:
 * - Exact changes: Levenshtein (edit operations)
 * - Typos/similar text: Jaro-Winkler (transpositions)
 * - Token-based: Dice coefficient (word similarity)
 * - Fuzzy matching: Combined metrics
 */

/**
 * Calculate Levenshtein distance (edit distance) between two strings
 * Returns the minimum number of single-character edits required
 * 
 * Use cases:
 * - Detecting typos in UI text
 * - Measuring text content changes
 * - Finding closest matching strings
 * - Spell-check suggestions
 * 
 * Operations counted:
 * - Insertion: "cat" → "cats" (distance: 1)
 * - Deletion: "cats" → "cat" (distance: 1)
 * - Substitution: "cat" → "bat" (distance: 1)
 * 
 * Complexity: O(m×n) where m,n are string lengths
 * 
 * @example
 * // Typo detection
 * levenshteinDistance("button", "buton") // 1 (one deletion)
 * levenshteinDistance("receive", "recieve") // 2 (transposition)
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
 * 
 * Use cases:
 * - Threshold-based text similarity checks
 * - Percentage of change calculations
 * - Cross-length string comparison
 * 
 * Range: [0, 1]
 * - 0: Identical strings
 * - 0.2: Minor changes (usually acceptable)
 * - 0.5: Significant changes
 * - 1.0: Completely different
 * 
 * @example
 * normalizedLevenshteinDistance("hello", "helo") // 0.2 (80% similar)
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
 * 
 * Use cases:
 * - Short string matching (names, labels)
 * - Typo-tolerant matching
 * - Record linkage/deduplication
 * 
 * Characteristics:
 * - Considers character transpositions
 * - Better for short strings than Levenshtein
 * - Position-sensitive (order matters)
 * 
 * Matching window: floor(max(len1, len2) / 2) - 1
 * 
 * @example
 * jaroSimilarity("martha", "marhta") // ≈ 0.944 (transposition)
 * jaroSimilarity("DIXON", "DICKSONX") // ≈ 0.767
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
 * 
 * Use cases:
 * - Name matching (people, companies)
 * - URL/path similarity
 * - Identifier matching (where prefixes matter)
 * - Autocomplete suggestions
 * 
 * Prefix bonus:
 * - Up to 4 characters of common prefix
 * - Default scaling factor: 0.1
 * - Boosts score for matching beginnings
 * 
 * Best for:
 * - Strings that commonly differ at the end
 * - Hierarchical identifiers
 * - Human names (firstname.lastname)
 * 
 * @example
 * jaroWinklerSimilarity("prefixed", "prefix") // Higher than plain Jaro
 * jaroWinklerSimilarity("className", "classNames") // ≈ 0.97
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
 * Based on bigram (2-character) similarity
 * 
 * Use cases:
 * - Fuzzy string matching
 * - Similar word detection
 * - OCR error correction
 * - DNA sequence comparison
 * 
 * How it works:
 * - Splits strings into bigrams ("hello" → ["he", "el", "ll", "lo"])
 * - Compares bigram sets
 * - Formula: 2 × |intersection| / (|set1| + |set2|)
 * 
 * Characteristics:
 * - Order-independent within bigrams
 * - Good for detecting rearranged text
 * - Less sensitive to string length differences
 * 
 * @example
 * diceCoefficient("night", "nacht") // ≈ 0.25
 * diceCoefficient("hello world", "world hello") // Different bigrams
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
 * 
 * Use cases:
 * - Diff algorithms (like git diff)
 * - DNA/protein sequence alignment
 * - Plagiarism detection
 * - Version comparison
 * 
 * Note: Characters don't need to be consecutive
 * "ABCDGH" vs "AEDFHR" → LCS = "ADH" (length: 3)
 * 
 * Complexity: O(m×n) time and space
 * 
 * @example
 * // Code similarity
 * longestCommonSubsequence("function foo()", "function bar()") 
 * // Returns length of "function ()"
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
 * 
 * Use cases:
 * - Finding shared code segments
 * - URL path similarity
 * - Detecting copy-pasted content
 * - File path comparison
 * 
 * Note: Characters must be consecutive (unlike subsequence)
 * "ABABC" vs "BABCA" → Longest substring = "BABC" (length: 4)
 * 
 * @example
 * // Shared URL paths
 * longestCommonSubstring(
 *   "/api/v1/users/123",
 *   "/api/v1/users/456"
 * ) // 14 ("/api/v1/users/")
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
 * 
 * Use cases:
 * - Comparing sentences/paragraphs
 * - Class name similarity (space-separated)
 * - Tag/keyword matching
 * - Search relevance scoring
 * 
 * Formula: |intersection| / |union| (Jaccard for tokens)
 * 
 * Characteristics:
 * - Order-independent
 * - Good for multi-word content
 * - Customizable separator (space, comma, etc.)
 * 
 * @example
 * // Class name changes
 * tokenSimilarity("btn btn-primary large", "btn-primary btn disabled")
 * // Common tokens: "btn", "btn-primary" → 0.5
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
 * 
 * Use cases:
 * - Element matching across page versions
 * - Smart search/autocomplete
 * - Duplicate detection with variations
 * - Content correlation in A/B tests
 * 
 * Default weight distribution:
 * - 30% Levenshtein (exact character changes)
 * - 30% Jaro-Winkler (transpositions, prefixes)
 * - 20% Dice (bigram similarity)
 * - 20% Token (word-level matching)
 * 
 * Customization guidelines:
 * - Short strings: Increase Jaro weight
 * - Long text: Increase token weight
 * - Typo detection: Increase Levenshtein
 * - Rearranged text: Increase Dice
 * 
 * @example
 * // Adaptive matching
 * fuzzyStringMatch("Sign In", "Sign in") // ≈ 0.95
 * fuzzyStringMatch("Login", "Sign In") // ≈ 0.3
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
 * 
 * Use cases:
 * - Binary decision for element matching
 * - Validation of text changes
 * - Deduplication filters
 * - Content verification
 * 
 * Recommended thresholds by use case:
 * - Exact match required: 0.95+
 * - Same element detection: 0.8-0.9
 * - Similar content: 0.6-0.8
 * - Related content: 0.4-0.6
 * 
 * Metric selection:
 * - 'levenshtein': Character-level precision
 * - 'jaro': Short strings, typos
 * - 'dice': Rearranged content
 * - 'fuzzy': Balanced comparison (default)
 * 
 * @example
 * // Element text validation
 * if (areStringsSimilar(oldText, newText, 0.9)) {
 *   console.log('Minor text change detected');
 * }
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