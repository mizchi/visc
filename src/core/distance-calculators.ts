/**
 * Core distance calculation functions
 * Pure functions for calculating various types of distances
 */

/**
 * Euclidean distance between two points
 */
export function euclideanDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Manhattan distance between two points
 */
export function manhattanDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
}

/**
 * Chebyshev distance (maximum of absolute differences)
 */
export function chebyshevDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
}

/**
 * Calculate center point of a rectangle
 */
export function getRectCenter(rect: {
  x: number;
  y: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

/**
 * Distance between two rectangles (center to center)
 */
export function rectDistance(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  const center1 = getRectCenter(rect1);
  const center2 = getRectCenter(rect2);
  return euclideanDistance(center1, center2);
}

/**
 * Minimum distance between two rectangles (edge to edge)
 */
export function minRectDistance(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  const left1 = rect1.x;
  const right1 = rect1.x + rect1.width;
  const top1 = rect1.y;
  const bottom1 = rect1.y + rect1.height;

  const left2 = rect2.x;
  const right2 = rect2.x + rect2.width;
  const top2 = rect2.y;
  const bottom2 = rect2.y + rect2.height;

  // Horizontal distance
  let dx = 0;
  if (right1 < left2) {
    dx = left2 - right1;
  } else if (right2 < left1) {
    dx = left1 - right2;
  }

  // Vertical distance
  let dy = 0;
  if (bottom1 < top2) {
    dy = top2 - bottom1;
  } else if (bottom2 < top1) {
    dy = top1 - bottom2;
  }

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate overlap area between two rectangles
 */
export function rectOverlapArea(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  const xOverlap = Math.max(
    0,
    Math.min(rect1.x + rect1.width, rect2.x + rect2.width) -
      Math.max(rect1.x, rect2.x)
  );
  const yOverlap = Math.max(
    0,
    Math.min(rect1.y + rect1.height, rect2.y + rect2.height) -
      Math.max(rect1.y, rect2.y)
  );
  return xOverlap * yOverlap;
}

/**
 * Calculate Intersection over Union (IoU) for two rectangles
 */
export function rectIoU(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): number {
  const intersection = rectOverlapArea(rect1, rect2);
  const area1 = rect1.width * rect1.height;
  const area2 = rect2.width * rect2.height;
  const union = area1 + area2 - intersection;
  
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calculate normalized position difference
 * Returns value between 0 (same position) and 1 (maximum difference)
 */
export function normalizedPositionDifference(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bounds: { width: number; height: number }
): number {
  const dx = Math.abs(p2.x - p1.x) / bounds.width;
  const dy = Math.abs(p2.y - p1.y) / bounds.height;
  return Math.sqrt(dx * dx + dy * dy) / Math.sqrt(2); // Normalize to [0, 1]
}

/**
 * Calculate normalized size difference
 * Returns value between 0 (same size) and 1 (maximum difference)
 */
export function normalizedSizeDifference(
  size1: { width: number; height: number },
  size2: { width: number; height: number }
): number {
  const maxWidth = Math.max(size1.width, size2.width);
  const maxHeight = Math.max(size1.height, size2.height);
  
  if (maxWidth === 0 && maxHeight === 0) return 0;
  
  const widthDiff = Math.abs(size1.width - size2.width) / (maxWidth || 1);
  const heightDiff = Math.abs(size1.height - size2.height) / (maxHeight || 1);
  
  return (widthDiff + heightDiff) / 2;
}

/**
 * Calculate aspect ratio difference
 */
export function aspectRatioDifference(
  size1: { width: number; height: number },
  size2: { width: number; height: number }
): number {
  const ratio1 = size1.width / (size1.height || 1);
  const ratio2 = size2.width / (size2.height || 1);
  
  const maxRatio = Math.max(ratio1, ratio2);
  const minRatio = Math.min(ratio1, ratio2);
  
  return maxRatio === 0 ? 0 : 1 - minRatio / maxRatio;
}

/**
 * Calculate relative position (position relative to parent)
 */
export function relativePosition(
  child: { x: number; y: number },
  parent: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: child.x - parent.x,
    y: child.y - parent.y,
  };
}

/**
 * Check if rectangle contains point
 */
export function rectContainsPoint(
  rect: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number }
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * Check if rect1 contains rect2
 */
export function rectContainsRect(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    rect2.x >= rect1.x &&
    rect2.y >= rect1.y &&
    rect2.x + rect2.width <= rect1.x + rect1.width &&
    rect2.y + rect2.height <= rect1.y + rect1.height
  );
}

/**
 * Calculate weighted distance combining position and size differences
 */
export function weightedLayoutDistance(
  layout1: { x: number; y: number; width: number; height: number },
  layout2: { x: number; y: number; width: number; height: number },
  weights: {
    position?: number;
    size?: number;
    aspectRatio?: number;
  } = {}
): number {
  const { position = 0.5, size = 0.3, aspectRatio = 0.2 } = weights;
  
  const posDistance = rectDistance(layout1, layout2);
  const sizeDiff = normalizedSizeDifference(layout1, layout2);
  const aspectDiff = aspectRatioDifference(layout1, layout2);
  
  return position * posDistance + size * sizeDiff + aspectRatio * aspectDiff;
}