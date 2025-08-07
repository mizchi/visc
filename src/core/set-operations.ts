/**
 * Set operations and distance calculations
 * Pure functions for set-based calculations (e.g., accessibility attributes)
 */

/**
 * Calculate Jaccard similarity coefficient between two sets
 * Returns a value between 0 (no overlap) and 1 (identical sets)
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
 * Calculate Dice coefficient for sets
 */
export function diceSimilarity<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  
  const intersection = setIntersection(set1, set2);
  return (2 * intersection.size) / (set1.size + set2.size);
}

/**
 * Calculate overlap coefficient (Szymkiewicz–Simpson coefficient)
 */
export function overlapCoefficient<T>(set1: Set<T>, set2: Set<T>): number {
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = setIntersection(set1, set2);
  return intersection.size / Math.min(set1.size, set2.size);
}

/**
 * Calculate cosine similarity for sets (treating as binary vectors)
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
 * Calculate weighted set similarity
 * Each element has an associated weight
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
 */
export function setEditDistance<T>(set1: Set<T>, set2: Set<T>): number {
  const toAdd = setDifference(set2, set1).size;    // Elements to add
  const toRemove = setDifference(set1, set2).size; // Elements to remove
  return toAdd + toRemove;
}

/**
 * Calculate normalized set edit distance
 */
export function normalizedSetEditDistance<T>(set1: Set<T>, set2: Set<T>): number {
  const maxSize = Math.max(set1.size, set2.size);
  if (maxSize === 0) return 0;
  return setEditDistance(set1, set2) / (2 * maxSize);
}