/**
 * Accessibility-based Visual Node Group matching
 * Matches groups based on ARIA attributes, roles, and semantic structure
 */

import type { VisualNodeGroup, VisualNode, VisualTreeAnalysis } from '../types.js';

export interface AccessibilityMatch {
  confidence: number;
  matchReason: string[];
  positionShift?: { x: number; y: number };
  sizeChange?: { width: number; height: number };
  isShifted?: boolean;
  accessibilityIdentifier?: string;
}

export interface GroupCorrespondence {
  group1: VisualNodeGroup;
  group2: VisualNodeGroup;
  match: AccessibilityMatch;
  positionShift: { x: number; y: number };
  sizeChange: { width: number; height: number };
  selector?: string;
}

/**
 * Match two Visual Node Groups based on accessibility attributes
 */
export function matchGroupsByAccessibility(
  group1: VisualNodeGroup,
  group2: VisualNodeGroup
): AccessibilityMatch | null {
  const reasons: string[] = [];
  let confidence = 0;
  let accessibilityIdentifier: string | undefined;

  // Extract accessibility attributes from both groups
  const attrs1 = extractAccessibilityAttributes(group1);
  const attrs2 = extractAccessibilityAttributes(group2);

  // Priority 1: Match by aria-label (highest confidence)
  if (attrs1.ariaLabel && attrs1.ariaLabel === attrs2.ariaLabel) {
    reasons.push(`aria-label="${attrs1.ariaLabel}"`);
    confidence = 0.95;
    accessibilityIdentifier = `aria-label="${attrs1.ariaLabel}"`;
  }

  // Priority 2: Match by aria-labelledby
  if (attrs1.ariaLabelledBy && attrs1.ariaLabelledBy === attrs2.ariaLabelledBy) {
    reasons.push(`aria-labelledby="${attrs1.ariaLabelledBy}"`);
    confidence = Math.max(confidence, 0.92);
    if (!accessibilityIdentifier) {
      accessibilityIdentifier = `aria-labelledby="${attrs1.ariaLabelledBy}"`;
    }
  }

  // Priority 3: Match by aria-describedby
  if (attrs1.ariaDescribedBy && attrs1.ariaDescribedBy === attrs2.ariaDescribedBy) {
    reasons.push(`aria-describedby="${attrs1.ariaDescribedBy}"`);
    confidence = Math.max(confidence, 0.90);
    if (!accessibilityIdentifier) {
      accessibilityIdentifier = `aria-describedby="${attrs1.ariaDescribedBy}"`;
    }
  }

  // Priority 4: Match by semantic HTML tag
  if (attrs1.semanticTag && attrs1.semanticTag === attrs2.semanticTag) {
    reasons.push(`semantic-tag="${attrs1.semanticTag}"`);
    
    // Different semantic tags have different uniqueness levels
    const uniqueSemanticTags = ['main', 'header', 'footer', 'nav', 'aside'];
    const moderatelyUniqueTags = ['article', 'section', 'form', 'dialog', 'figure'];
    
    let tagConfidence = 0.70; // Default for common semantic tags
    if (uniqueSemanticTags.includes(attrs1.semanticTag)) {
      tagConfidence = 0.90; // High confidence for unique landmark tags
    } else if (moderatelyUniqueTags.includes(attrs1.semanticTag)) {
      tagConfidence = 0.80; // Moderate confidence
    }
    
    confidence = Math.max(confidence, tagConfidence);
    
    if (!accessibilityIdentifier) {
      accessibilityIdentifier = attrs1.semanticTag;
    }
  }

  // Priority 5: Match by role
  if (attrs1.role && attrs1.role === attrs2.role) {
    reasons.push(`role="${attrs1.role}"`);
    
    // Role matching alone is less confident unless it's a unique role
    const uniqueRoles = ['main', 'banner', 'contentinfo', 'search', 'form'];
    const roleConfidence = uniqueRoles.includes(attrs1.role) ? 0.88 : 0.75;
    confidence = Math.max(confidence, roleConfidence);
    
    if (!accessibilityIdentifier) {
      accessibilityIdentifier = `role="${attrs1.role}"`;
    }
  }

  // Priority 6: Match by ID
  if (attrs1.id && attrs1.id === attrs2.id) {
    reasons.push(`id="${attrs1.id}"`);
    confidence = Math.max(confidence, 0.93);
    if (!accessibilityIdentifier) {
      accessibilityIdentifier = `#${attrs1.id}`;
    }
  }

  // Priority 7: Combined semantic tag + role matching (higher confidence)
  if (attrs1.semanticTag && attrs2.semanticTag && 
      attrs1.semanticTag === attrs2.semanticTag &&
      attrs1.role && attrs2.role && attrs1.role === attrs2.role) {
    // Boost confidence when both semantic tag and role match
    confidence = Math.min(confidence * 1.1, 0.98);
    reasons.push('semantic+role-match');
  }

  // Priority 8: Match by structural similarity with accessibility context
  if (confidence > 0 && attrs1.structure && attrs2.structure) {
    const structuralSimilarity = compareStructure(attrs1.structure, attrs2.structure);
    if (structuralSimilarity > 0.8) {
      reasons.push(`structural-similarity=${structuralSimilarity.toFixed(2)}`);
      confidence = confidence * 0.9 + structuralSimilarity * 0.1; // Weighted combination
    }
  }

  // If no match found, return null
  if (confidence === 0) {
    return null;
  }

  // Calculate position shift and size change
  const positionShift = {
    x: group2.bounds.x - group1.bounds.x,
    y: group2.bounds.y - group1.bounds.y,
  };

  const sizeChange = {
    width: group2.bounds.width - group1.bounds.width,
    height: group2.bounds.height - group1.bounds.height,
  };

  const isShifted = Math.abs(positionShift.x) > 5 || Math.abs(positionShift.y) > 5;

  return {
    confidence,
    matchReason: reasons,
    positionShift,
    sizeChange,
    isShifted,
    accessibilityIdentifier,
  };
}

/**
 * Find all corresponding groups between two layouts
 */
export function findCorrespondingGroups(
  layout1: VisualTreeAnalysis,
  layout2: VisualTreeAnalysis
): GroupCorrespondence[] {
  const correspondences: GroupCorrespondence[] = [];
  
  if (!layout1.visualNodeGroups || !layout2.visualNodeGroups) {
    return correspondences;
  }

  const usedGroup2Indices = new Set<number>();

  // For each group in layout1, find the best match in layout2
  for (const group1 of layout1.visualNodeGroups) {
    let bestMatch: AccessibilityMatch | null = null;
    let bestGroup2: VisualNodeGroup | null = null;
    let bestGroup2Index = -1;

    layout2.visualNodeGroups.forEach((group2, index) => {
      // Skip if this group2 has already been matched
      if (usedGroup2Indices.has(index)) {
        return;
      }

      const match = matchGroupsByAccessibility(group1, group2);
      if (match) {
        if (!bestMatch || match.confidence > bestMatch.confidence) {
          bestMatch = match;
          bestGroup2 = group2;
          bestGroup2Index = index;
        }
      }
    });

    // Add correspondence if a good match was found
    if (bestMatch !== null && bestGroup2 !== null) {
      const match = bestMatch as AccessibilityMatch;
      if (match.confidence > 0.7) {
        usedGroup2Indices.add(bestGroup2Index);
        
        const positionShift = match.positionShift || { x: 0, y: 0 };
        const sizeChange = match.sizeChange || { width: 0, height: 0 };
        
        correspondences.push({
          group1,
          group2: bestGroup2,
          match: match,
          positionShift,
          sizeChange,
          selector: generateAccessibilitySelector(group1),
        });
      }
    }
  }

  return correspondences;
}

/**
 * Extract accessibility attributes from a Visual Node Group
 */
function extractAccessibilityAttributes(group: VisualNodeGroup): {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  role?: string;
  id?: string;
  semanticTag?: string;
  structure?: string[];
} {
  const attrs: any = {};
  const structure: string[] = [];
  const semanticTags = new Set<string>();

  // Define semantic HTML5 tags that have inherent meaning
  const SEMANTIC_TAGS = [
    'nav', 'main', 'header', 'footer', 'article', 'section', 'aside',
    'figure', 'figcaption', 'details', 'summary', 'dialog', 'menu',
    'form', 'fieldset', 'legend', 'label', 'output', 'progress', 'meter',
    'time', 'mark', 'address', 'blockquote', 'cite', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ];

  // Traverse all children to collect accessibility attributes
  const traverse = (node: VisualNode | VisualNodeGroup, depth: number = 0) => {
    if ('tagName' in node) {
      // It's a VisualNode
      const tagLower = node.tagName.toLowerCase();
      
      // Collect semantic tags
      if (SEMANTIC_TAGS.includes(tagLower)) {
        semanticTags.add(tagLower);
        if (!attrs.semanticTag) {
          attrs.semanticTag = tagLower; // Store the first/primary semantic tag
        }
      }
      
      if (node.ariaLabel && !attrs.ariaLabel) {
        attrs.ariaLabel = node.ariaLabel;
      }
      
      if (node.ariaAttributes) {
        if (node.ariaAttributes['aria-labelledby'] && !attrs.ariaLabelledBy) {
          attrs.ariaLabelledBy = node.ariaAttributes['aria-labelledby'];
        }
        if (node.ariaAttributes['aria-describedby'] && !attrs.ariaDescribedBy) {
          attrs.ariaDescribedBy = node.ariaAttributes['aria-describedby'];
        }
      }
      
      if (node.role && !attrs.role) {
        attrs.role = node.role;
      }
      
      if (node.id && !attrs.id) {
        attrs.id = node.id;
      }

      // Build structure signature including semantic tags
      if (depth < 3) { // Limit depth for performance
        let sig = tagLower;
        if (node.role) {
          sig += `[role=${node.role}]`;
        }
        if (SEMANTIC_TAGS.includes(tagLower)) {
          sig = `<${sig}>`; // Mark semantic tags
        }
        structure.push(sig);
      }
    }

    // Process children if they exist
    if ('children' in node && node.children) {
      for (const child of node.children) {
        traverse(child, depth + 1);
      }
    }
  };

  // Start traversal from the group itself
  traverse(group);

  if (structure.length > 0) {
    attrs.structure = structure;
  }

  return attrs;
}

/**
 * Compare structural signatures of two groups
 */
function compareStructure(structure1: string[], structure2: string[]): number {
  if (structure1.length === 0 || structure2.length === 0) {
    return 0;
  }

  // Calculate Jaccard similarity
  const set1 = new Set(structure1);
  const set2 = new Set(structure2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Generate a CSS selector based on accessibility attributes
 */
export function generateAccessibilitySelector(group: VisualNodeGroup): string {
  const attrs = extractAccessibilityAttributes(group);
  
  // Priority order for selector generation
  if (attrs.id) {
    return `#${attrs.id}`;
  }
  
  if (attrs.ariaLabel) {
    return `[aria-label="${attrs.ariaLabel}"]`;
  }
  
  if (attrs.ariaLabelledBy) {
    return `[aria-labelledby="${attrs.ariaLabelledBy}"]`;
  }
  
  // Semantic tag with role for more specific selection
  if (attrs.semanticTag && attrs.role) {
    return `${attrs.semanticTag}[role="${attrs.role}"]`;
  }
  
  // Semantic tag alone (for unique landmark elements)
  if (attrs.semanticTag) {
    const uniqueTags = ['main', 'header', 'footer', 'nav', 'aside'];
    if (uniqueTags.includes(attrs.semanticTag)) {
      return attrs.semanticTag;
    }
  }
  
  if (attrs.role) {
    return `[role="${attrs.role}"]`;
  }
  
  // Semantic tag for less unique elements (with potential class)
  if (attrs.semanticTag) {
    // Try to combine with first class for more specificity
    for (const child of group.children) {
      if ('className' in child && child.className) {
        const firstClass = child.className.split(' ')[0];
        if (firstClass) {
          return `${attrs.semanticTag}.${firstClass}`;
        }
      }
    }
    return attrs.semanticTag;
  }
  
  // Fallback: try to get class or tag from first child
  for (const child of group.children) {
    if ('className' in child && child.className) {
      const firstClass = child.className.split(' ')[0];
      if (firstClass) {
        return `.${firstClass}`;
      }
    }
    if ('tagName' in child) {
      return child.tagName.toLowerCase();
    }
  }
  
  return '';
}

/**
 * Calculate the movement vector between two corresponding groups
 */
export function calculateMovementVector(correspondence: GroupCorrespondence): {
  from: { x: number; y: number };
  to: { x: number; y: number };
  distance: number;
  angle: number;
} {
  const from = {
    x: correspondence.group1.bounds.x + correspondence.group1.bounds.width / 2,
    y: correspondence.group1.bounds.y + correspondence.group1.bounds.height / 2,
  };
  
  const to = {
    x: correspondence.group2.bounds.x + correspondence.group2.bounds.width / 2,
    y: correspondence.group2.bounds.y + correspondence.group2.bounds.height / 2,
  };
  
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return { from, to, distance, angle };
}