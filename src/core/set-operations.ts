/**
 * Set operations and distance calculations
 * Pure functions for set-based calculations
 * 
 * This module provides set-theoretic operations for:
 * - Accessibility attribute comparison (ARIA roles, labels)
 * - CSS class list comparison
 * - Feature/capability matching
 * - Tag/category similarity
 * 
 * Algorithm selection guide:
 * - Jaccard: Standard set similarity (size-sensitive)
 * - Dice: Emphasizes common elements (good for small sets)
 * - Overlap: Subset relationships (one contains the other)
 * - Cosine: Weighted/frequency-based comparison
 */

/**
 * Calculate Jaccard similarity coefficient (Jaccard index)
 * Returns a value between 0 (no overlap) and 1 (identical sets)
 * 
 * Use cases:
 * - CSS class similarity between elements
 * - Feature set comparison
 * - Tag/category matching
 * - Accessibility attribute comparison
 * 
 * Formula: |A ∩ B| / |A ∪ B|
 * 
 * Characteristics:
 * - Symmetric: J(A,B) = J(B,A)
 * - Size-sensitive (penalizes different set sizes)
 * - Empty set handling: J(∅,∅) = 1
 * 
 * Thresholds:
 * - > 0.8: Very similar
 * - 0.5-0.8: Moderately similar
 * - < 0.3: Different
 * 
 * @example
 * // CSS class comparison
 * const classes1 = new Set(['btn', 'btn-primary', 'large']);
 * const classes2 = new Set(['btn', 'btn-primary', 'disabled']);
 * jaccardSimilarity(classes1, classes2) // 0.5 (2 common, 4 total)
 */
export function jaccardSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  
  const intersection = setIntersection(set1, set2);
  const union = setUnion(set1, set2);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate Jaccard distance (1 - Jaccard similarity)
 */
export function jaccardDistance<T>(set1: Set<T>, set2: Set<T>): number {
  return 1 - jaccardSimilarity(set1, set2);
}

/**
 * Set intersection
 */
export function setIntersection<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const item of set1) {
    if (set2.has(item)) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Set union
 */
export function setUnion<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  return new Set([...set1, ...set2]);
}

/**
 * Set difference (elements in set1 but not in set2)
 */
export function setDifference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const item of set1) {
    if (!set2.has(item)) {
      result.add(item);
    }
  }
  return result;
}

/**
 * Symmetric difference (elements in either set but not in both)
 */
export function symmetricDifference<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  const diff1 = setDifference(set1, set2);
  const diff2 = setDifference(set2, set1);
  return setUnion(diff1, diff2);
}

/**
 * Check if set1 is a subset of set2
 */
export function isSubset<T>(set1: Set<T>, set2: Set<T>): boolean {
  for (const item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if set1 is a superset of set2
 */
export function isSuperset<T>(set1: Set<T>, set2: Set<T>): boolean {
  return isSubset(set2, set1);
}

/**
 * Check if two sets are disjoint (no common elements)
 */
export function areDisjoint<T>(set1: Set<T>, set2: Set<T>): boolean {
  for (const item of set1) {
    if (set2.has(item)) {
      return false;
    }
  }
  return true;
}

/**
 * Calculate Dice coefficient for sets (Sørensen–Dice index)
 * 
 * Use cases:
 * - Small set comparison (< 10 elements)
 * - Presence/absence features
 * - Binary attribute matching
 * - Quick similarity checks
 * 
 * Formula: 2 × |A ∩ B| / (|A| + |B|)
 * 
 * Characteristics:
 * - Emphasizes shared elements more than Jaccard
 * - Less sensitive to set size differences
 * - Range: [0, 1] where 1 = identical
 * - Better for imbalanced sets
 * 
 * @example
 * // Feature comparison
 * const features1 = new Set(['responsive', 'dark-mode']);
 * const features2 = new Set(['responsive', 'dark-mode', 'rtl']);
 * diceSimilarity(features1, features2) // 0.8 (emphasizes common)
 */
export function diceSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  
  const intersection = setIntersection(set1, set2);
  return (2 * intersection.size) / (set1.size + set2.size);
}

/**
 * Calculate overlap coefficient (Szymkiewicz–Simpson coefficient)
 * 
 * Use cases:
 * - Detecting subset relationships
 * - Finding if one element contains another's features
 * - Hierarchical classification matching
 * - Permission/capability checking
 * 
 * Formula: |A ∩ B| / min(|A|, |B|)
 * 
 * Characteristics:
 * - Returns 1 if smaller set is subset of larger
 * - Not symmetric for different-sized sets
 * - Good for "contains all features of" checks
 * 
 * @example
 * // Check if element has all required attributes
 * const required = new Set(['role', 'aria-label']);
 * const actual = new Set(['role', 'aria-label', 'tabindex', 'id']);
 * overlapCoefficient(required, actual) // 1.0 (all required present)
 */
export function overlapCoefficient<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = setIntersection(set1, set2);
  return intersection.size / Math.min(set1.size, set2.size);
}

/**
 * Calculate cosine similarity for sets (treating as binary vectors)
 * 
 * Use cases:
 * - Document/content similarity
 * - Feature vector comparison
 * - Normalized set similarity
 * - High-dimensional sparse data
 * 
 * Formula: |A ∩ B| / √(|A| × |B|)
 * 
 * Characteristics:
 * - Geometric interpretation (angle between vectors)
 * - Size-normalized (good for different magnitudes)
 * - Range: [0, 1] where 1 = same direction
 * 
 * @example
 * // Tag similarity
 * const tags1 = new Set(['javascript', 'react', 'frontend']);
 * const tags2 = new Set(['javascript', 'vue', 'frontend']);
 * cosineSimilarity(tags1, tags2) // ≈ 0.67
 */
export function cosineSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = setIntersection(set1, set2);
  return intersection.size / Math.sqrt(set1.size * set2.size);
}

/**
 * Convert object to set of key-value pairs for comparison
 */
export function objectToSet(obj: Record<string, any>): Set<string> {
  const result = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    result.add(`${key}=${String(value)}`);
  }
  return result;
}

/**
 * Calculate similarity between two objects based on their properties
 * 
 * Use cases:
 * - Configuration comparison
 * - Style object similarity
 * - Data attribute matching
 * - Settings validation
 * 
 * Converts objects to key=value sets for comparison
 * 
 * @example
 * // Style comparison
 * const style1 = { color: 'red', size: 'large' };
 * const style2 = { color: 'red', size: 'medium', weight: 'bold' };
 * objectSimilarity(style1, style2, 'jaccard') // 0.25 (1 match, 4 total)
 */
export function objectSimilarity(
  obj1: Record<string, any>,
  obj2: Record<string, any>,
  metric: 'jaccard' | 'dice' | 'cosine' = 'jaccard'
): number {
  const set1 = objectToSet(obj1);
  const set2 = objectToSet(obj2);
  
  switch (metric) {
    case 'jaccard':
      return jaccardSimilarity(set1, set2);
    case 'dice':
      return diceSimilarity(set1, set2);
    case 'cosine':
      return cosineSimilarity(set1, set2);
  }
}

/**
 * Calculate weighted set similarity (cosine similarity with weights)
 * Each element has an associated weight/frequency
 * 
 * Use cases:
 * - Term frequency comparison (TF-IDF)
 * - Weighted feature matching
 * - Importance-based similarity
 * - Score/confidence-based matching
 * 
 * Formula: Σ(w1ᵢ × w2ᵢ) / (√Σw1ᵢ² × √Σw2ᵢ²)
 * 
 * @example
 * // Weighted feature importance
 * const features1 = new Map([['responsive', 1.0], ['a11y', 0.8]]);
 * const features2 = new Map([['responsive', 0.9], ['a11y', 1.0]]);
 * weightedSetSimilarity(features1, features2) // High similarity
 */
export function weightedSetSimilarity<T>(
  set1: Map<T, number>,
  set2: Map<T, number>
): number {
  const allKeys = new Set([...set1.keys(), ...set2.keys()]);
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (const key of allKeys) {
    const weight1 = set1.get(key) || 0;
    const weight2 = set2.get(key) || 0;
    
    dotProduct += weight1 * weight2;
    norm1 += weight1 * weight1;
    norm2 += weight2 * weight2;
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate accessibility attributes similarity
 * Specialized function for comparing ARIA attributes
 * 
 * Use cases:
 * - Finding corresponding elements across versions
 * - Accessibility compliance checking
 * - ARIA attribute migration validation
 * - Screen reader compatibility testing
 * 
 * Important attributes (weighted 2x):
 * - role: Defines element purpose
 * - aria-label: Primary accessible name
 * - aria-labelledby: Label references
 * - aria-describedby: Description references
 * 
 * Returns detailed breakdown:
 * - similarity: Weighted score [0, 1]
 * - matchedAttributes: Common attributes with same values
 * - uniqueToFirst/Second: Differential attributes
 * 
 * @example
 * // Button accessibility comparison
 * const btn1 = { role: 'button', 'aria-label': 'Submit' };
 * const btn2 = { role: 'button', 'aria-label': 'Submit', 'aria-disabled': 'true' };
 * const result = accessibilitySimilarity(btn1, btn2);
 * // result.similarity > 0.8 (core attributes match)
 */
export function accessibilitySimilarity(
  attrs1: Record<string, string>,
  attrs2: Record<string, string>
): {
  similarity: number;
  matchedAttributes: Set<string>;
  uniqueToFirst: Set<string>;
  uniqueToSecond: Set<string>;
} {
  const keys1 = new Set(Object.keys(attrs1));
  const keys2 = new Set(Object.keys(attrs2));
  
  const matchedAttributes = new Set<string>();
  const uniqueToFirst = new Set<string>();
  const uniqueToSecond = new Set<string>();
  
  // Check matching attributes with same values
  for (const key of keys1) {
    if (keys2.has(key) && attrs1[key] === attrs2[key]) {
      matchedAttributes.add(key);
    } else if (!keys2.has(key)) {
      uniqueToFirst.add(key);
    }
  }
  
  // Check attributes unique to second
  for (const key of keys2) {
    if (!keys1.has(key)) {
      uniqueToSecond.add(key);
    }
  }
  
  // Calculate similarity with weights for important attributes
  const importantAttrs = ['role', 'aria-label', 'aria-labelledby', 'aria-describedby'];
  let weightedMatches = 0;
  let totalWeight = 0;
  
  for (const key of new Set([...keys1, ...keys2])) {
    const weight = importantAttrs.includes(key) ? 2 : 1;
    totalWeight += weight;
    
    if (matchedAttributes.has(key)) {
      weightedMatches += weight;
    }
  }
  
  const similarity = totalWeight === 0 ? 0 : weightedMatches / totalWeight;
  
  return {
    similarity,
    matchedAttributes,
    uniqueToFirst,
    uniqueToSecond,
  };
}

/**
 * Calculate set edit distance (minimum operations to transform one set to another)
 * 
 * Use cases:
 * - Measuring UI state changes
 * - Class list modifications
 * - Feature flag changes
 * - Permission updates
 * 
 * Operations counted:
 * - Add element: cost = 1 per element
 * - Remove element: cost = 1 per element
 * 
 * Total cost = |A − B| + |B − A|
 * 
 * @example
 * // Class list changes
 * const before = new Set(['btn', 'primary', 'large']);
 * const after = new Set(['btn', 'secondary', 'large', 'disabled']);
 * setEditDistance(before, after) // 3 (remove 'primary', add 'secondary', 'disabled')
 */
export function setEditDistance<T>(set1: Set<T>, set2: Set<T>): number {
  const toAdd = setDifference(set2, set1).size;    // Elements to add
  const toRemove = setDifference(set1, set2).size; // Elements to remove
  return toAdd + toRemove;
}

/**
 * Calculate normalized set edit distance
 * 
 * Use cases:
 * - Percentage of change calculations
 * - Threshold-based change detection
 * - Cross-size set comparison
 * - Change impact assessment
 * 
 * Formula: editDistance / (2 × max(|A|, |B|))
 * Range: [0, 1]
 * - 0: Identical sets
 * - 0.5: Half the elements changed
 * - 1.0: Completely disjoint sets
 * 
 * @example
 * // Measure percentage of features changed
 * const v1 = new Set(['feat1', 'feat2', 'feat3']);
 * const v2 = new Set(['feat2', 'feat3', 'feat4']);
 * normalizedSetEditDistance(v1, v2) // 0.33 (33% change)
 */
export function normalizedSetEditDistance<T>(set1: Set<T>, set2: Set<T>): number {
  const maxSize = Math.max(set1.size, set2.size);
  if (maxSize === 0) return 0;
  return setEditDistance(set1, set2) / (2 * maxSize);
}