/**
 * Accessibility-based Visual Node Group matching tests
 */

import { describe, it, expect } from 'vitest';
import type { VisualNodeGroup, VisualNode, VisualTreeAnalysis } from '../src/types.js';

// Test helpers
function createMockVisualNode(overrides: Partial<VisualNode> = {}): VisualNode {
  return {
    tagName: 'div',
    className: '',
    id: '',
    rect: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0, right: 100, bottom: 50 },
    text: '',
    role: null,
    ariaLabel: null,
    ariaAttributes: {},
    ...overrides,
  };
}

function createMockVisualNodeGroup(overrides: Partial<VisualNodeGroup> = {}): VisualNodeGroup {
  return {
    type: 'content',
    label: 'Group',
    bounds: { x: 0, y: 0, width: 100, height: 50, top: 0, left: 0, right: 100, bottom: 50 },
    importance: 50,
    children: [],
    ...overrides,
  };
}

describe('Accessibility-based Visual Node Group Matching', () => {
  describe('matchGroupsByAccessibility', () => {
    it('should match groups with same semantic HTML tag', () => {
      const group1 = createMockVisualNodeGroup({
        label: 'Navigation',
        children: [
          createMockVisualNode({
            tagName: 'nav',
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        label: 'Navigation',
        bounds: { x: 50, y: 0, width: 100, height: 50, top: 0, left: 50, right: 150, bottom: 50 },
        children: [
          createMockVisualNode({
            tagName: 'nav',
            rect: { x: 50, y: 0, width: 100, height: 50, top: 0, left: 50, right: 150, bottom: 50 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.confidence).toBeGreaterThan(0.85);
      expect(match?.matchReason).toContain('semantic-tag="nav"');
    });

    it('should match groups with same aria-label', () => {
      const group1 = createMockVisualNodeGroup({
        label: 'Navigation',
        children: [
          createMockVisualNode({
            tagName: 'nav',
            ariaLabel: 'メインナビゲーション',
            role: 'navigation',
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        label: 'Navigation',
        bounds: { x: 50, y: 0, width: 100, height: 50, top: 0, left: 50, right: 150, bottom: 50 },
        children: [
          createMockVisualNode({
            tagName: 'nav',
            ariaLabel: 'メインナビゲーション',
            role: 'navigation',
            rect: { x: 50, y: 0, width: 100, height: 50, top: 0, left: 50, right: 150, bottom: 50 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.confidence).toBeGreaterThan(0.9);
      expect(match?.matchReason).toContain('aria-label');
    });

    it('should match groups with same role and similar structure', () => {
      const group1 = createMockVisualNodeGroup({
        children: [
          createMockVisualNode({ role: 'main', tagName: 'main' }),
          createMockVisualNode({ tagName: 'h1', text: 'Title' }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        bounds: { x: 30, y: 20, width: 100, height: 50, top: 20, left: 30, right: 130, bottom: 70 },
        children: [
          createMockVisualNode({ 
            role: 'main', 
            tagName: 'main',
            rect: { x: 30, y: 20, width: 100, height: 50, top: 20, left: 30, right: 130, bottom: 70 },
          }),
          createMockVisualNode({ 
            tagName: 'h1', 
            text: 'Title',
            rect: { x: 30, y: 20, width: 100, height: 20, top: 20, left: 30, right: 130, bottom: 40 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.matchReason).toContain('role');
    });

    it('should match form groups by aria-labelledby', () => {
      const group1 = createMockVisualNodeGroup({
        children: [
          createMockVisualNode({
            tagName: 'form',
            ariaAttributes: { 'aria-labelledby': 'form-title' },
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        bounds: { x: 100, y: 100, width: 200, height: 150, top: 100, left: 100, right: 300, bottom: 250 },
        children: [
          createMockVisualNode({
            tagName: 'form',
            ariaAttributes: { 'aria-labelledby': 'form-title' },
            rect: { x: 100, y: 100, width: 200, height: 150, top: 100, left: 100, right: 300, bottom: 250 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.matchReason).toContain('aria-labelledby');
    });

    it('should detect position shift for matched groups', () => {
      const group1 = createMockVisualNodeGroup({
        label: 'Sidebar',
        bounds: { x: 0, y: 100, width: 200, height: 300, top: 100, left: 0, right: 200, bottom: 400 },
        children: [
          createMockVisualNode({
            role: 'complementary',
            ariaLabel: 'サイドバーナビゲーション',
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        label: 'Sidebar',
        bounds: { x: 0, y: 200, width: 200, height: 300, top: 200, left: 0, right: 200, bottom: 500 },
        children: [
          createMockVisualNode({
            role: 'complementary',
            ariaLabel: 'サイドバーナビゲーション',
            rect: { x: 0, y: 200, width: 200, height: 300, top: 200, left: 0, right: 200, bottom: 500 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.positionShift).toEqual({ x: 0, y: 100 });
      expect(match?.isShifted).toBe(true);
    });

    it('should have higher confidence for semantic tag + role combination', () => {
      const group1 = createMockVisualNodeGroup({
        children: [
          createMockVisualNode({
            tagName: 'main',
            role: 'main',
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        bounds: { x: 30, y: 20, width: 100, height: 50, top: 20, left: 30, right: 130, bottom: 70 },
        children: [
          createMockVisualNode({
            tagName: 'main',
            role: 'main',
            rect: { x: 30, y: 20, width: 100, height: 50, top: 20, left: 30, right: 130, bottom: 70 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.confidence).toBeGreaterThan(0.95);
      expect(match?.matchReason).toContain('semantic+role-match');
    });

    it('should match article elements as semantic tags', () => {
      const group1 = createMockVisualNodeGroup({
        children: [
          createMockVisualNode({
            tagName: 'article',
            id: 'post-123',
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        bounds: { x: 0, y: 100, width: 600, height: 400, top: 100, left: 0, right: 600, bottom: 500 },
        children: [
          createMockVisualNode({
            tagName: 'article',
            id: 'post-123',
            rect: { x: 0, y: 100, width: 600, height: 400, top: 100, left: 0, right: 600, bottom: 500 },
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeTruthy();
      expect(match?.confidence).toBeGreaterThan(0.9);
      expect(match?.matchReason).toContain('id="post-123"');
      expect(match?.matchReason).toContain('semantic-tag="article"');
    });

    it('should not match groups with different accessibility identifiers', () => {
      const group1 = createMockVisualNodeGroup({
        children: [
          createMockVisualNode({
            ariaLabel: 'メインコンテンツ',
            role: 'main',
          }),
        ],
      });

      const group2 = createMockVisualNodeGroup({
        children: [
          createMockVisualNode({
            ariaLabel: 'サイドバー',
            role: 'complementary',
          }),
        ],
      });

      const match = matchGroupsByAccessibility(group1, group2);
      expect(match).toBeFalsy();
    });
  });

  describe('findCorrespondingGroups', () => {
    it('should find all corresponding groups between two layouts', () => {
      const layout1: VisualTreeAnalysis = {
        url: 'test.html',
        timestamp: new Date().toISOString(),
        viewport: { width: 1024, height: 768, scrollX: 0, scrollY: 0 },
        elements: [],
        statistics: {},
        visualNodeGroups: [
          createMockVisualNodeGroup({
            label: 'Navigation',
            children: [
              createMockVisualNode({ ariaLabel: 'メインナビゲーション', role: 'navigation' }),
            ],
          }),
          createMockVisualNodeGroup({
            label: 'Main',
            bounds: { x: 0, y: 50, width: 800, height: 500, top: 50, left: 0, right: 800, bottom: 550 },
            children: [
              createMockVisualNode({ role: 'main' }),
            ],
          }),
          createMockVisualNodeGroup({
            label: 'Sidebar',
            bounds: { x: 800, y: 50, width: 224, height: 500, top: 50, left: 800, right: 1024, bottom: 550 },
            children: [
              createMockVisualNode({ role: 'complementary', ariaLabel: 'サイドバー' }),
            ],
          }),
        ],
      };

      const layout2: VisualTreeAnalysis = {
        url: 'test.html',
        timestamp: new Date().toISOString(),
        viewport: { width: 1024, height: 768, scrollX: 0, scrollY: 0 },
        elements: [],
        statistics: {},
        visualNodeGroups: [
          createMockVisualNodeGroup({
            label: 'Navigation',
            bounds: { x: 50, y: 0, width: 974, height: 50, top: 0, left: 50, right: 1024, bottom: 50 },
            children: [
              createMockVisualNode({ 
                ariaLabel: 'メインナビゲーション', 
                role: 'navigation',
                rect: { x: 50, y: 0, width: 974, height: 50, top: 0, left: 50, right: 1024, bottom: 50 },
              }),
            ],
          }),
          createMockVisualNodeGroup({
            label: 'Main',
            bounds: { x: 30, y: 70, width: 770, height: 500, top: 70, left: 30, right: 800, bottom: 570 },
            children: [
              createMockVisualNode({ 
                role: 'main',
                rect: { x: 30, y: 70, width: 770, height: 500, top: 70, left: 30, right: 800, bottom: 570 },
              }),
            ],
          }),
          createMockVisualNodeGroup({
            label: 'Sidebar',
            bounds: { x: 800, y: 150, width: 224, height: 400, top: 150, left: 800, right: 1024, bottom: 550 },
            children: [
              createMockVisualNode({ 
                role: 'complementary', 
                ariaLabel: 'サイドバー',
                rect: { x: 800, y: 150, width: 224, height: 400, top: 150, left: 800, right: 1024, bottom: 550 },
              }),
            ],
          }),
        ],
      };

      const correspondences = findCorrespondingGroups(layout1, layout2);
      
      expect(correspondences).toHaveLength(3);
      
      const navCorrespondence = correspondences.find(c => c.group1.label === 'Navigation');
      expect(navCorrespondence).toBeTruthy();
      expect(navCorrespondence?.positionShift).toEqual({ x: 50, y: 0 });
      
      const mainCorrespondence = correspondences.find(c => c.group1.label === 'Main');
      expect(mainCorrespondence).toBeTruthy();
      expect(mainCorrespondence?.positionShift).toEqual({ x: 30, y: 20 });
      
      const sidebarCorrespondence = correspondences.find(c => c.group1.label === 'Sidebar');
      expect(sidebarCorrespondence).toBeTruthy();
      expect(sidebarCorrespondence?.positionShift).toEqual({ x: 0, y: 100 });
    });
  });
});

// Implementation stubs (to be implemented in accessibility-matcher.ts)
export interface AccessibilityMatch {
  confidence: number;
  matchReason: string[];
  positionShift?: { x: number; y: number };
  sizeChange?: { width: number; height: number };
  isShifted?: boolean;
}

export interface GroupCorrespondence {
  group1: VisualNodeGroup;
  group2: VisualNodeGroup;
  match: AccessibilityMatch;
  positionShift: { x: number; y: number };
  sizeChange: { width: number; height: number };
  selector?: string;
}

// Stub implementations for testing
function matchGroupsByAccessibility(
  group1: VisualNodeGroup,
  group2: VisualNodeGroup
): AccessibilityMatch | null {
  // This will be implemented in accessibility-matcher.ts
  const reasons: string[] = [];
  let confidence = 0;

  // Check semantic tag match
  const semanticTag1 = getGroupSemanticTag(group1);
  const semanticTag2 = getGroupSemanticTag(group2);
  if (semanticTag1 && semanticTag1 === semanticTag2) {
    reasons.push(`semantic-tag="${semanticTag1}"`);
    const uniqueTags = ['main', 'header', 'footer', 'nav', 'aside'];
    confidence = Math.max(confidence, uniqueTags.includes(semanticTag1) ? 0.9 : 0.8);
  }

  // Check aria-label match
  const ariaLabel1 = getGroupAriaLabel(group1);
  const ariaLabel2 = getGroupAriaLabel(group2);
  if (ariaLabel1 && ariaLabel1 === ariaLabel2) {
    reasons.push('aria-label');
    confidence = 0.95;
  }

  // Check role match
  const role1 = getGroupRole(group1);
  const role2 = getGroupRole(group2);
  if (role1 && role1 === role2) {
    reasons.push('role');
    confidence = Math.max(confidence, 0.85);
  }

  // Check aria-labelledby
  const labelledBy1 = getGroupAriaLabelledBy(group1);
  const labelledBy2 = getGroupAriaLabelledBy(group2);
  if (labelledBy1 && labelledBy1 === labelledBy2) {
    reasons.push('aria-labelledby');
    confidence = Math.max(confidence, 0.9);
  }

  // Check ID match
  const id1 = getGroupId(group1);
  const id2 = getGroupId(group2);
  if (id1 && id1 === id2) {
    reasons.push(`id="${id1}"`);
    confidence = Math.max(confidence, 0.93);
  }
  
  // Boost confidence for semantic tag + role match
  if (semanticTag1 && semanticTag2 && semanticTag1 === semanticTag2 &&
      role1 && role2 && role1 === role2) {
    confidence = Math.min(confidence * 1.1, 0.98);
    reasons.push('semantic+role-match');
  }

  if (confidence === 0) {
    return null;
  }

  // Calculate position shift
  const positionShift = {
    x: group2.bounds.x - group1.bounds.x,
    y: group2.bounds.y - group1.bounds.y,
  };

  const isShifted = Math.abs(positionShift.x) > 5 || Math.abs(positionShift.y) > 5;

  return {
    confidence,
    matchReason: reasons,
    positionShift,
    isShifted,
  };
}

function findCorrespondingGroups(
  layout1: VisualTreeAnalysis,
  layout2: VisualTreeAnalysis
): GroupCorrespondence[] {
  // This will be implemented in accessibility-matcher.ts
  const correspondences: GroupCorrespondence[] = [];
  
  if (!layout1.visualNodeGroups || !layout2.visualNodeGroups) {
    return correspondences;
  }

  for (const group1 of layout1.visualNodeGroups) {
    for (const group2 of layout2.visualNodeGroups) {
      const match = matchGroupsByAccessibility(group1, group2);
      if (match && match.confidence > 0.8) {
        correspondences.push({
          group1,
          group2,
          match,
          positionShift: match.positionShift || { x: 0, y: 0 },
          sizeChange: {
            width: group2.bounds.width - group1.bounds.width,
            height: group2.bounds.height - group1.bounds.height,
          },
          selector: generateAccessibilitySelector(group1),
        });
        break; // Each group1 matches at most one group2
      }
    }
  }

  return correspondences;
}

// Helper functions
function getGroupAriaLabel(group: VisualNodeGroup): string | null {
  for (const child of group.children) {
    if ('ariaLabel' in child && child.ariaLabel) {
      return child.ariaLabel;
    }
  }
  return null;
}

function getGroupRole(group: VisualNodeGroup): string | null {
  for (const child of group.children) {
    if ('role' in child && child.role) {
      return child.role;
    }
  }
  return null;
}

function getGroupAriaLabelledBy(group: VisualNodeGroup): string | null {
  for (const child of group.children) {
    if ('ariaAttributes' in child && child.ariaAttributes?.['aria-labelledby']) {
      return child.ariaAttributes['aria-labelledby'];
    }
  }
  return null;
}

function getGroupId(group: VisualNodeGroup): string | null {
  for (const child of group.children) {
    if ('id' in child && child.id) {
      return child.id;
    }
  }
  return null;
}

function getGroupSemanticTag(group: VisualNodeGroup): string | null {
  const SEMANTIC_TAGS = [
    'nav', 'main', 'header', 'footer', 'article', 'section', 'aside',
    'figure', 'figcaption', 'details', 'summary', 'dialog', 'menu',
    'form', 'fieldset', 'legend', 'label', 'output', 'progress', 'meter',
    'time', 'mark', 'address', 'blockquote', 'cite', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ];
  
  for (const child of group.children) {
    if ('tagName' in child) {
      const tagLower = child.tagName.toLowerCase();
      if (SEMANTIC_TAGS.includes(tagLower)) {
        return tagLower;
      }
    }
  }
  return null;
}

function generateAccessibilitySelector(group: VisualNodeGroup): string {
  const ariaLabel = getGroupAriaLabel(group);
  const role = getGroupRole(group);
  const semanticTag = getGroupSemanticTag(group);
  
  if (ariaLabel) {
    return `[aria-label="${ariaLabel}"]`;
  }
  
  // Semantic tag with role for specificity
  if (semanticTag && role) {
    return `${semanticTag}[role="${role}"]`;
  }
  
  // Unique semantic tags can stand alone
  if (semanticTag) {
    const uniqueTags = ['main', 'header', 'footer', 'nav', 'aside'];
    if (uniqueTags.includes(semanticTag)) {
      return semanticTag;
    }
  }
  
  if (role) {
    return `[role="${role}"]`;
  }
  
  // Non-unique semantic tags need more specificity
  if (semanticTag) {
    return semanticTag;
  }
  
  // Fallback to first element with ID or class
  for (const child of group.children) {
    if ('id' in child && child.id) {
      return `#${child.id}`;
    }
    if ('className' in child && child.className) {
      const firstClass = child.className.split(' ')[0];
      if (firstClass) {
        return `.${firstClass}`;
      }
    }
  }
  
  return '';
}