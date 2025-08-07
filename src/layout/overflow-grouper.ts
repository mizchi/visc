/**
 * Overflow elements to VisualNodeGroup converter
 * Groups overflow/scrollable elements as independent visual node groups
 */

import type { VisualNode, VisualNodeGroup, BoundingRect } from "../types.js";
import { detectScrollableElements, detectFixedDimensionElements } from "../analysis/overflow-detector.js";
import type { ScrollableElement, FixedDimensionElement } from "../analysis/overflow-detector.js";

export interface OverflowGroupOptions {
  includeFixed?: boolean; // Include fixed dimension elements
  minScrollRatio?: number; // Minimum scroll ratio to consider (0-1)
  semanticGrouping?: boolean; // Group by semantic meaning
  nestingDepth?: number; // Maximum nesting depth for groups
}

/**
 * Create VisualNodeGroups from overflow elements
 */
export function createOverflowGroups(
  elements: VisualNode[],
  existingGroups: VisualNodeGroup[] = [],
  options: OverflowGroupOptions = {}
): VisualNodeGroup[] {
  const {
    includeFixed = true,
    minScrollRatio = 0.1, // At least 10% scrollable
    semanticGrouping = true,
    nestingDepth = 3,
  } = options;

  // Create a temporary analysis structure
  const tempAnalysis = {
    url: '',
    timestamp: new Date().toISOString(),
    viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0 },
    elements,
    statistics: {},
  };

  // Detect scrollable elements
  const scrollableElements = detectScrollableElements(tempAnalysis);
  const fixedElements = includeFixed ? detectFixedDimensionElements(tempAnalysis) : [];

  const overflowGroups: VisualNodeGroup[] = [];
  const processedElements = new Set<VisualNode>();

  // Process scrollable elements
  for (const scrollable of scrollableElements) {
    // Skip if scroll ratio is too small
    const verticalRatio = scrollable.scrollDimensions.verticalScrollRatio;
    const horizontalRatio = scrollable.scrollDimensions.horizontalScrollRatio;
    
    if (Math.min(verticalRatio, horizontalRatio) > (1 - minScrollRatio)) {
      continue; // Not enough overflow
    }

    // Skip if already processed
    if (processedElements.has(scrollable.node)) {
      continue;
    }

    const group = createScrollableGroup(scrollable, elements, semanticGrouping);
    if (group) {
      overflowGroups.push(group);
      processedElements.add(scrollable.node);
      
      // Mark children as processed to avoid duplication
      markChildrenAsProcessed(scrollable.node, elements, processedElements);
    }
  }

  // Process fixed dimension elements that aren't scrollable
  if (includeFixed) {
    for (const fixed of fixedElements) {
      if (processedElements.has(fixed.node)) {
        continue;
      }

      // Only create groups for fully fixed elements or important semi-fixed ones
      if (fixed.flexibility === 'fixed' || 
          (fixed.flexibility === 'semi-fixed' && isImportantFixed(fixed))) {
        const group = createFixedGroup(fixed, elements);
        if (group) {
          overflowGroups.push(group);
          processedElements.add(fixed.node);
        }
      }
    }
  }

  // Handle nested scrollable areas
  if (nestingDepth > 1) {
    overflowGroups.forEach(group => {
      detectNestedOverflow(group, elements, nestingDepth - 1, processedElements);
    });
  }

  // Merge with existing groups, avoiding duplicates
  return mergeOverflowGroups(existingGroups, overflowGroups);
}

/**
 * Create a VisualNodeGroup for a scrollable element
 */
function createScrollableGroup(
  scrollable: ScrollableElement,
  allElements: VisualNode[],
  useSemantics: boolean
): VisualNodeGroup | null {
  const node = scrollable.node;
  
  // Determine group type and label based on semantics
  let groupType = 'scrollable';
  let label = 'Scrollable Container';
  
  if (useSemantics) {
    if (scrollable.semantics.isDataTable) {
      groupType = 'data-table';
      label = 'Data Table';
    } else if (scrollable.semantics.isCodeBlock) {
      groupType = 'code-block';
      label = 'Code Block';
    } else if (scrollable.semantics.isCarousel) {
      groupType = 'carousel';
      label = 'Carousel/Slider';
    } else if (scrollable.semantics.isModal) {
      groupType = 'modal';
      label = 'Modal Dialog';
    } else if (scrollable.semantics.isDropdown) {
      groupType = 'dropdown';
      label = 'Dropdown Menu';
    } else {
      // Determine by scroll type
      if (scrollable.type === 'horizontal') {
        groupType = 'horizontal-scroll';
        label = 'Horizontal Scroll Container';
      } else if (scrollable.type === 'vertical') {
        groupType = 'vertical-scroll';
        label = 'Vertical Scroll Container';
      } else {
        groupType = 'both-scroll';
        label = 'Bidirectional Scroll Container';
      }
    }
  }

  // Find child elements
  const children = findChildElements(node, allElements);
  
  // Calculate expanded bounds (including scrollable area)
  const expandedBounds = calculateExpandedBounds(node, scrollable);

  const group: VisualNodeGroup = {
    type: groupType,
    label: `${label} (${scrollable.type} scroll)`,
    bounds: expandedBounds,
    importance: calculateGroupImportance(node, children, scrollable),
    children: children,
    rootSelector: generateSelector(node),
  };

  // Add metadata about overflow
  (group as any).overflowMetadata = {
    scrollType: scrollable.type,
    scrollDimensions: scrollable.scrollDimensions,
    cssDefinition: scrollable.cssDefinition,
    semantics: scrollable.semantics,
  };

  return group;
}

/**
 * Create a VisualNodeGroup for a fixed dimension element
 */
function createFixedGroup(
  fixed: FixedDimensionElement,
  allElements: VisualNode[]
): VisualNodeGroup | null {
  const node = fixed.node;
  
  const groupType = 'fixed-dimension';
  const label = `Fixed Container (${fixed.flexibility})`;
  
  const children = findChildElements(node, allElements);

  const group: VisualNodeGroup = {
    type: groupType,
    label,
    bounds: node.rect,
    importance: calculateGroupImportance(node, children, null),
    children: children,
    rootSelector: generateSelector(node),
  };

  // Add metadata about fixed dimensions
  (group as any).fixedMetadata = {
    dimensions: fixed.dimensions,
    constraints: fixed.constraints,
    flexibility: fixed.flexibility,
  };

  return group;
}

/**
 * Calculate expanded bounds including scrollable area
 */
function calculateExpandedBounds(
  node: VisualNode,
  scrollable: ScrollableElement
): BoundingRect {
  const baseRect = node.rect;
  const scrollDims = scrollable.scrollDimensions;
  
  // Calculate the theoretical expanded size if all content was visible
  const expandedWidth = Math.max(baseRect.width, scrollDims.scrollWidth);
  const expandedHeight = Math.max(baseRect.height, scrollDims.scrollHeight);
  
  return {
    x: baseRect.x,
    y: baseRect.y,
    width: expandedWidth,
    height: expandedHeight,
    top: baseRect.top,
    right: baseRect.x + expandedWidth,
    bottom: baseRect.y + expandedHeight,
    left: baseRect.left,
  };
}

/**
 * Find child elements within a parent node
 */
function findChildElements(
  parent: VisualNode,
  allElements: VisualNode[]
): VisualNode[] {
  const parentRect = parent.rect;
  const children: VisualNode[] = [];
  
  for (const element of allElements) {
    if (element === parent) continue;
    
    const rect = element.rect;
    
    // Check if element is contained within parent
    if (
      rect.x >= parentRect.x &&
      rect.y >= parentRect.y &&
      rect.right <= parentRect.right &&
      rect.bottom <= parentRect.bottom
    ) {
      // Additional check: ensure it's not a sibling at the same level
      const xOverlap = Math.min(rect.right, parentRect.right) - Math.max(rect.x, parentRect.x);
      const yOverlap = Math.min(rect.bottom, parentRect.bottom) - Math.max(rect.y, parentRect.y);
      const overlapArea = xOverlap * yOverlap;
      const elementArea = rect.width * rect.height;
      
      if (overlapArea >= elementArea * 0.8) { // At least 80% contained
        children.push(element);
      }
    }
  }
  
  return children;
}

/**
 * Calculate importance score for a group
 */
function calculateGroupImportance(
  node: VisualNode,
  children: VisualNode[],
  scrollable: ScrollableElement | null
): number {
  let importance = node.importance || 50;
  
  // Boost importance for scrollable containers
  if (scrollable) {
    importance += 10;
    
    // Extra boost for semantic types
    if (scrollable.semantics.isDataTable || scrollable.semantics.isModal) {
      importance += 15;
    } else if (scrollable.semantics.isCarousel) {
      importance += 10;
    }
    
    // Boost based on overflow amount
    const scrollRatio = Math.min(
      scrollable.scrollDimensions.verticalScrollRatio,
      scrollable.scrollDimensions.horizontalScrollRatio
    );
    importance += (1 - scrollRatio) * 20; // More overflow = higher importance
  }
  
  // Consider number of children
  if (children.length > 10) {
    importance += 10;
  } else if (children.length > 5) {
    importance += 5;
  }
  
  // Consider size relative to viewport (if available)
  const area = node.rect.width * node.rect.height;
  if (area > 100000) { // Large element
    importance += 10;
  }
  
  return Math.min(100, importance);
}

/**
 * Generate CSS selector for an element
 */
function generateSelector(node: VisualNode): string {
  const parts: string[] = [];
  
  if (node.id) {
    return `#${node.id}`;
  }
  
  if (node.tagName) {
    parts.push(node.tagName.toLowerCase());
  }
  
  if (node.className) {
    const classes = node.className.split(' ').filter(c => c.length > 0);
    if (classes.length > 0) {
      parts.push(`.${classes.join('.')}`);
    }
  }
  
  if (node.role) {
    parts.push(`[role="${node.role}"]`);
  }
  
  return parts.join('') || '*';
}

/**
 * Mark children as processed to avoid duplication
 */
function markChildrenAsProcessed(
  parent: VisualNode,
  allElements: VisualNode[],
  processed: Set<VisualNode>
): void {
  const children = findChildElements(parent, allElements);
  for (const child of children) {
    processed.add(child);
  }
}

/**
 * Check if a fixed element is important enough to group
 */
function isImportantFixed(fixed: FixedDimensionElement): boolean {
  // Important if it has both fixed dimensions
  if (fixed.dimensions.hasFixedWidth && fixed.dimensions.hasFixedHeight) {
    return true;
  }
  
  // Important if it has strict constraints
  if (fixed.constraints.hasMinConstraints && fixed.constraints.hasMaxConstraints) {
    return true;
  }
  
  // Important if it's pixel-based (likely designed for specific size)
  if (fixed.dimensions.isPixelBased) {
    return true;
  }
  
  return false;
}

/**
 * Detect nested overflow within groups
 */
function detectNestedOverflow(
  group: VisualNodeGroup,
  allElements: VisualNode[],
  remainingDepth: number,
  processed: Set<VisualNode>
): void {
  if (remainingDepth <= 0) return;
  
  const childNodes = group.children.filter(
    (child): child is VisualNode => !('type' in child && 'label' in child)
  );
  
  // Create temporary analysis for children
  const tempAnalysis = {
    url: '',
    timestamp: new Date().toISOString(),
    viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0 },
    elements: childNodes,
    statistics: {},
  };
  
  const nestedScrollable = detectScrollableElements(tempAnalysis);
  
  for (const scrollable of nestedScrollable) {
    if (!processed.has(scrollable.node)) {
      const nestedGroup = createScrollableGroup(scrollable, allElements, true);
      if (nestedGroup) {
        // Replace the node with the group in children
        const nodeIndex = group.children.indexOf(scrollable.node);
        if (nodeIndex !== -1) {
          group.children[nodeIndex] = nestedGroup;
          processed.add(scrollable.node);
          
          // Recursively detect in the nested group
          detectNestedOverflow(nestedGroup, allElements, remainingDepth - 1, processed);
        }
      }
    }
  }
}

/**
 * Merge overflow groups with existing groups
 */
function mergeOverflowGroups(
  existing: VisualNodeGroup[],
  overflow: VisualNodeGroup[]
): VisualNodeGroup[] {
  const merged = [...existing];
  const existingSelectors = new Set(existing.map(g => g.rootSelector));
  
  for (const overflowGroup of overflow) {
    // Skip if a group with the same selector already exists
    if (overflowGroup.rootSelector && existingSelectors.has(overflowGroup.rootSelector)) {
      continue;
    }
    
    // Find if this overflow group should replace or be added to an existing group
    let replaced = false;
    for (let i = 0; i < merged.length; i++) {
      const existingGroup = merged[i];
      
      // Check if overflow group is more specific than existing
      if (isMoreSpecificGroup(overflowGroup, existingGroup)) {
        merged[i] = overflowGroup;
        replaced = true;
        break;
      }
    }
    
    if (!replaced) {
      merged.push(overflowGroup);
    }
  }
  
  return merged;
}

/**
 * Check if one group is more specific than another
 */
function isMoreSpecificGroup(a: VisualNodeGroup, b: VisualNodeGroup): boolean {
  // Overflow groups are more specific than generic groups
  if (a.type.includes('scroll') && !b.type.includes('scroll')) {
    return true;
  }
  
  // Semantic groups are more specific
  const semanticTypes = ['data-table', 'code-block', 'carousel', 'modal', 'dropdown'];
  const aIsSemantic = semanticTypes.includes(a.type);
  const bIsSemantic = semanticTypes.includes(b.type);
  
  if (aIsSemantic && !bIsSemantic) {
    return true;
  }
  
  // Check bounds overlap
  const boundsOverlap = calculateBoundsOverlap(a.bounds, b.bounds);
  if (boundsOverlap > 0.8) {
    // If they mostly overlap, prefer the one with more specific type
    return a.type.length > b.type.length;
  }
  
  return false;
}

/**
 * Calculate overlap ratio between two bounds
 */
function calculateBoundsOverlap(a: BoundingRect, b: BoundingRect): number {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  
  const overlapArea = xOverlap * yOverlap;
  const aArea = a.width * a.height;
  const bArea = b.width * b.height;
  
  return overlapArea / Math.min(aArea, bArea);
}

/**
 * Export the enhanced group detection including overflow
 */
export function enhanceVisualNodeGroups(
  elements: VisualNode[],
  existingGroups: VisualNodeGroup[],
  options: OverflowGroupOptions = {}
): VisualNodeGroup[] {
  return createOverflowGroups(elements, existingGroups, options);
}