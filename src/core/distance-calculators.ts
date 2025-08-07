/**
 * Core distance calculation functions
 * Pure functions for calculating various types of distances
 * 
 * This module provides fundamental distance and similarity metrics for:
 * - Layout comparison (position, size, overlap)
 * - Geometric calculations (point-to-point, rect-to-rect)
 * - Normalized metrics for threshold-based comparisons
 * 
 * All functions are pure (no side effects) and deterministic.
 */

/**
 * Euclidean distance between two points (straight-line distance)
 * 
 * Use cases:
 * - Measuring actual pixel distance between UI elements
 * - Finding nearest neighbor elements
 * - Calculating movement vectors for animations
 * 
 * Formula: √((x₂-x₁)² + (y₂-y₁)²)
 * 
 * @example
 * // Distance between two button positions
 * euclideanDistance({x: 100, y: 100}, {x: 200, y: 200}) // ≈ 141.42
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
 * Manhattan distance between two points (city-block distance)
 * 
 * Use cases:
 * - Grid-based layouts (tables, cards)
 * - Keyboard navigation distance
 * - Movement in constrained directions (horizontal/vertical only)
 * 
 * Formula: |x₂-x₁| + |y₂-y₁|
 * 
 * Characteristics:
 * - Always ≥ Euclidean distance
 * - Better for grid-aligned movement
 * - Used in pathfinding for grid-based UIs
 * 
 * @example
 * // Steps needed to move in a grid
 * manhattanDistance({x: 0, y: 0}, {x: 3, y: 4}) // 7 (3 right + 4 down)
 */
export function manhattanDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.abs(p2.x - p1.x) + Math.abs(p2.y - p1.y);
}

/**
 * Chebyshev distance (chessboard distance, king move distance)
 * 
 * Use cases:
 * - Determining if elements are within a square radius
 * - Touch target proximity (square hit areas)
 * - Maximum change detection in any dimension
 * 
 * Formula: max(|x₂-x₁|, |y₂-y₁|)
 * 
 * Characteristics:
 * - Measures moves in 8 directions (like a chess king)
 * - Always ≤ Manhattan distance
 * - Useful for "within N pixels" checks
 * 
 * @example
 * // Minimum moves for a chess king
 * chebyshevDistance({x: 0, y: 0}, {x: 3, y: 4}) // 4
 */
export function chebyshevDistance(
  p1: { x: number; y: number },
  p2: { x: number; y: number }
): number {
  return Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
}

/**
 * Calculate center point of a rectangle
 * 
 * Use cases:
 * - Finding focal point for animations
 * - Calculating connection lines between elements
 * - Determining element clusters
 * 
 * @example
 * getRectCenter({x: 10, y: 10, width: 100, height: 50})
 * // Returns: {x: 60, y: 35}
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
 * 
 * Use cases:
 * - Measuring spacing between UI components
 * - Finding related elements by proximity
 * - Layout shift detection
 * 
 * Note: Measures from center points, not edges
 * 
 * @example
 * // Distance between two cards
 * const card1 = {x: 0, y: 0, width: 100, height: 100};
 * const card2 = {x: 200, y: 0, width: 100, height: 100};
 * rectDistance(card1, card2) // 200 (center to center)
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
 * 
 * Use cases:
 * - Detecting element collisions (returns 0 if overlapping)
 * - Measuring actual spacing/gaps between elements
 * - Touch target proximity validation
 * - Finding whitespace violations
 * 
 * Characteristics:
 * - Returns 0 for overlapping/touching rectangles
 * - Measures shortest path between edges
 * - More accurate than center-to-center for spacing
 * 
 * @example
 * // Gap between two buttons
 * const btn1 = {x: 0, y: 0, width: 100, height: 40};
 * const btn2 = {x: 110, y: 0, width: 100, height: 40};
 * minRectDistance(btn1, btn2) // 10 (horizontal gap)
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
 * 
 * Use cases:
 * - Detecting element occlusion
 * - Measuring intersection for collision detection
 * - Finding overlapping click targets
 * - Calculating visible area of partially hidden elements
 * 
 * Returns: Area in square pixels (0 if no overlap)
 * 
 * @example
 * // Overlapping modals
 * const modal1 = {x: 0, y: 0, width: 300, height: 200};
 * const modal2 = {x: 100, y: 50, width: 300, height: 200};
 * rectOverlapArea(modal1, modal2) // 15000 (200x150 overlap)
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
 * 
 * Use cases:
 * - Measuring element similarity in different states
 * - Detecting if elements are "the same" after layout changes
 * - Validating responsive design element positions
 * - Object tracking in animations
 * 
 * Formula: intersection_area / union_area
 * Range: [0, 1] where 1 = identical position/size
 * 
 * Thresholds:
 * - IoU > 0.9: Nearly identical
 * - IoU > 0.7: Strong match
 * - IoU > 0.5: Moderate overlap
 * - IoU < 0.3: Different elements
 * 
 * @example
 * // Check if button moved significantly
 * const before = {x: 100, y: 100, width: 100, height: 40};
 * const after = {x: 105, y: 100, width: 100, height: 40};
 * rectIoU(before, after) // ≈ 0.95 (slight movement)
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
 * 
 * Use cases:
 * - Threshold-based position change detection
 * - Responsive design validation
 * - Animation distance calculations
 * - Cross-resolution position comparison
 * 
 * Normalization:
 * - Relative to viewport/container bounds
 * - Resolution-independent comparison
 * - Useful for percentage-based thresholds
 * 
 * @example
 * // Check if element moved > 10% of viewport
 * const diff = normalizedPositionDifference(
 *   {x: 100, y: 100},
 *   {x: 200, y: 200},
 *   {width: 1920, height: 1080}
 * );
 * if (diff > 0.1) console.log('Significant movement');
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
 * 
 * Use cases:
 * - Detecting resize operations
 * - Validating responsive scaling
 * - Finding size anomalies in component lists
 * - Comparing elements across different viewports
 * 
 * Calculation:
 * - Average of width and height differences
 * - Normalized by larger dimension
 * - Handles zero dimensions gracefully
 * 
 * @example
 * // Check if image resized significantly
 * const original = {width: 400, height: 300};
 * const resized = {width: 200, height: 150};
 * normalizedSizeDifference(original, resized) // 0.5 (50% smaller)
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
 * 
 * Use cases:
 * - Detecting image distortion
 * - Validating responsive image scaling
 * - Finding stretched/squashed elements
 * - Media container validation
 * 
 * Range: [0, 1]
 * - 0: Same aspect ratio
 * - 0.1: Slightly different (usually acceptable)
 * - 0.3: Noticeable difference
 * - 0.5+: Significant distortion
 * 
 * @example
 * // Check if image maintains aspect ratio
 * const original = {width: 1920, height: 1080}; // 16:9
 * const displayed = {width: 800, height: 600};  // 4:3
 * aspectRatioDifference(original, displayed) // ≈ 0.25 (distorted)
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
 * 
 * Use cases:
 * - Comprehensive layout change detection
 * - Visual regression scoring
 * - Finding most similar elements
 * - Layout stability metrics
 * 
 * Default weights:
 * - Position: 50% (most important for layout)
 * - Size: 30% (affects visual hierarchy)
 * - Aspect ratio: 20% (distortion detection)
 * 
 * Customization examples:
 * - Text elements: High position weight (flow matters)
 * - Images: High aspect ratio weight (prevent distortion)
 * - Buttons: Balanced weights (all aspects matter)
 * 
 * @example
 * // Custom weights for image comparison
 * weightedLayoutDistance(img1, img2, {
 *   position: 0.3,
 *   size: 0.2,
 *   aspectRatio: 0.5  // Emphasize aspect ratio
 * });
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