/**
 * High-level calculator utilities
 * Convenient functions for common calculation scenarios
 */

import {
  euclideanDistance,
  manhattanDistance,
  rectIoU,
  normalizedPositionDifference,
  normalizedSizeDifference,
  aspectRatioDifference,
  weightedLayoutDistance,
} from './distance-calculators.js';

import {
  levenshteinDistance,
  normalizedLevenshteinDistance,
  jaroWinklerSimilarity,
  fuzzyStringMatch,
  areStringsSimilar,
} from './text-distance.js';

import {
  jaccardSimilarity,
  diceSimilarity,
  accessibilitySimilarity,
} from './set-operations.js';

/**
 * Calculate all distance metrics between two points
 */
export function calculatePointDistances(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
) {
  return {
    euclidean: euclideanDistance(p1, p2),
    manhattan: manhattanDistance(p1, p2),
    chebyshev: Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y)),
  };
}

/**
 * Calculate comprehensive rectangle comparison metrics
 */
export function calculateRectangleMetrics(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
) {
  const center1 = { x: rect1.x + rect1.width / 2, y: rect1.y + rect1.height / 2 };
  const center2 = { x: rect2.x + rect2.width / 2, y: rect2.y + rect2.height / 2 };
  
  return {
    centerDistance: euclideanDistance(center1, center2),
    iou: rectIoU(rect1, rect2),
    positionDiff: normalizedPositionDifference(
      { x: rect1.x, y: rect1.y },
      { x: rect2.x, y: rect2.y },
      { width: Math.max(rect1.x + rect1.width, rect2.x + rect2.width),
        height: Math.max(rect1.y + rect1.height, rect2.y + rect2.height) }
    ),
    sizeDiff: normalizedSizeDifference(rect1, rect2),
    aspectRatioDiff: aspectRatioDifference(rect1, rect2),
    overallSimilarity: 1 - weightedLayoutDistance(rect1, rect2, {
      position: 0.4,
      size: 0.4,
      aspectRatio: 0.2,
    }) / 100, // Normalize to 0-1
  };
}

/**
 * Calculate all text similarity metrics
 */
export function calculateTextSimilarity(text1: string, text2: string) {
  return {
    levenshtein: {
      distance: levenshteinDistance(text1, text2),
      normalized: normalizedLevenshteinDistance(text1, text2),
      similarity: 1 - normalizedLevenshteinDistance(text1, text2),
    },
    jaroWinkler: jaroWinklerSimilarity(text1, text2),
    fuzzy: fuzzyStringMatch(text1, text2),
    isLikelySame: areStringsSimilar(text1, text2, 0.85),
    isProbablySame: areStringsSimilar(text1, text2, 0.7),
    isRelated: areStringsSimilar(text1, text2, 0.5),
  };
}

/**
 * Calculate CSS class similarity
 */
export function calculateClassSimilarity(
  classes1: string | string[],
  classes2: string | string[]
) {
  const set1 = new Set(Array.isArray(classes1) ? classes1 : classes1.split(/\s+/));
  const set2 = new Set(Array.isArray(classes2) ? classes2 : classes2.split(/\s+/));
  
  return {
    jaccard: jaccardSimilarity(set1, set2),
    dice: diceSimilarity(set1, set2),
    commonClasses: Array.from(new Set([...set1].filter(x => set2.has(x)))),
    uniqueToFirst: Array.from(new Set([...set1].filter(x => !set2.has(x)))),
    uniqueToSecond: Array.from(new Set([...set2].filter(x => !set1.has(x)))),
    isLikelySame: jaccardSimilarity(set1, set2) > 0.7,
  };
}

/**
 * Calculate element similarity based on multiple factors
 */
export interface ElementComparison {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  text?: string;
  classes?: string[];
  attributes?: Record<string, string>;
}

export function calculateElementSimilarity(
  element1: ElementComparison,
  element2: ElementComparison,
  weights = {
    position: 0.3,
    size: 0.2,
    text: 0.3,
    classes: 0.1,
    attributes: 0.1,
  }
) {
  let totalScore = 0;
  let totalWeight = 0;
  
  // Position similarity
  if (element1.position && element2.position && weights.position > 0) {
    const distance = euclideanDistance(element1.position, element2.position);
    const similarity = Math.exp(-distance / 100); // Exponential decay
    totalScore += similarity * weights.position;
    totalWeight += weights.position;
  }
  
  // Size similarity
  if (element1.size && element2.size && weights.size > 0) {
    const sizeDiff = normalizedSizeDifference(element1.size, element2.size);
    totalScore += (1 - sizeDiff) * weights.size;
    totalWeight += weights.size;
  }
  
  // Text similarity
  if (element1.text && element2.text && weights.text > 0) {
    const textSim = fuzzyStringMatch(element1.text, element2.text);
    totalScore += textSim * weights.text;
    totalWeight += weights.text;
  }
  
  // Class similarity
  if (element1.classes && element2.classes && weights.classes > 0) {
    const set1 = new Set(element1.classes);
    const set2 = new Set(element2.classes);
    const classSim = jaccardSimilarity(set1, set2);
    totalScore += classSim * weights.classes;
    totalWeight += weights.classes;
  }
  
  // Attribute similarity
  if (element1.attributes && element2.attributes && weights.attributes > 0) {
    const result = accessibilitySimilarity(element1.attributes, element2.attributes);
    totalScore += result.similarity * weights.attributes;
    totalWeight += weights.attributes;
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Determine if two elements are likely the same
 */
export function areElementsLikelySame(
  element1: ElementComparison,
  element2: ElementComparison,
  threshold = 0.7
): boolean {
  return calculateElementSimilarity(element1, element2) >= threshold;
}

/**
 * Find best matching element from a list
 */
export function findBestMatch<T extends ElementComparison>(
  target: ElementComparison,
  candidates: T[],
  minSimilarity = 0.5
): { element: T; similarity: number } | null {
  let bestMatch: T | null = null;
  let bestSimilarity = minSimilarity;
  
  for (const candidate of candidates) {
    const similarity = calculateElementSimilarity(target, candidate);
    if (similarity > bestSimilarity) {
      bestMatch = candidate;
      bestSimilarity = similarity;
    }
  }
  
  return bestMatch ? { element: bestMatch, similarity: bestSimilarity } : null;
}

/**
 * Calculate layout shift score (similar to CLS)
 */
export function calculateLayoutShift(
  before: { x: number; y: number; width: number; height: number }[],
  after: { x: number; y: number; width: number; height: number }[],
  viewport: { width: number; height: number }
): number {
  let totalShift = 0;
  const viewportArea = viewport.width * viewport.height;
  
  // Find matching elements and calculate shift
  for (const beforeElement of before) {
    const afterElement = after.find(a => {
      const iou = rectIoU(beforeElement, a);
      return iou > 0.5; // Consider same element if IoU > 0.5
    });
    
    if (afterElement) {
      const distance = euclideanDistance(
        { x: beforeElement.x, y: beforeElement.y },
        { x: afterElement.x, y: afterElement.y }
      );
      
      if (distance > 0) {
        const impactFraction = (beforeElement.width * beforeElement.height) / viewportArea;
        const distanceFraction = distance / Math.sqrt(viewportArea);
        totalShift += impactFraction * distanceFraction;
      }
    }
  }
  
  return totalShift;
}

/**
 * Batch calculate distances for multiple pairs
 */
export function batchCalculateDistances<T extends { x: number; y: number }>(
  points: T[],
  metric: 'euclidean' | 'manhattan' = 'euclidean'
): number[][] {
  const n = points.length;
  const distances: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
  
  const distanceFn = metric === 'euclidean' ? euclideanDistance : manhattanDistance;
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distance = distanceFn(points[i], points[j]);
      distances[i][j] = distance;
      distances[j][i] = distance;
    }
  }
  
  return distances;
}

/**
 * Find clusters of nearby elements
 */
export function findElementClusters<T extends { x: number; y: number; width: number; height: number }>(
  elements: T[],
  maxDistance = 50
): T[][] {
  const clusters: T[][] = [];
  const visited = new Set<number>();
  
  for (let i = 0; i < elements.length; i++) {
    if (visited.has(i)) continue;
    
    const cluster: T[] = [elements[i]];
    visited.add(i);
    
    // Find all elements within maxDistance
    for (let j = i + 1; j < elements.length; j++) {
      if (visited.has(j)) continue;
      
      const center1 = {
        x: elements[i].x + elements[i].width / 2,
        y: elements[i].y + elements[i].height / 2,
      };
      const center2 = {
        x: elements[j].x + elements[j].width / 2,
        y: elements[j].y + elements[j].height / 2,
      };
      
      if (euclideanDistance(center1, center2) <= maxDistance) {
        cluster.push(elements[j]);
        visited.add(j);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}