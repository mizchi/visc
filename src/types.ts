export interface StabilityCheckOptions {
  minIterations: number;
  maxIterations: number;
  viewport: { width: number; height: number };
  delay: number;
  targetStability: number;
}

export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface VisualNode {
  tagName: string;
  className: string;
  id: string;
  rect: BoundingRect;
  text?: string;
  role?: string | null;
  ariaLabel?: string | null;
  ariaAttributes?: { [key: string]: string };
  isInteractive?: boolean;
  hasParentWithSameSize?: boolean;
  hasOverflow?: boolean;
  isScrollable?: boolean;
  scrollDimensions?: {
    scrollWidth: number;
    scrollHeight: number;
    clientWidth: number;
    clientHeight: number;
  };
  boxModel?: {
    width: string;
    height: string;
    minWidth: string;
    minHeight: string;
    maxWidth: string;
    maxHeight: string;
    padding: string;
    margin: string;
    border: string;
    boxSizing: string;
  };
  hasFixedDimensions?: {
    width: boolean;
    height: boolean;
  };
  computedStyle?: { [key: string]: string };
  importance?: number;
  nodeType?: string;
  children?: (VisualNode | VisualNodeGroup)[];
}

export interface VisualNodeGroup {
  type: string;
  label: string;
  bounds: BoundingRect;
  importance: number;
  children: (VisualNode | VisualNodeGroup)[];
  rootSelector?: string; // CSS selector to find the root element of this group
}

export interface VisualPattern {
  elements: VisualNode[];
  type: string;
  className: string;
  averageSize: { width: number; height: number };
}

export interface VisualTreeAnalysis {
  url: string;
  timestamp: string;
  viewport: { 
    width: number; 
    height: number; 
    scrollX: number; 
    scrollY: number 
  };
  elements: VisualNode[];
  visualNodeGroups?: VisualNodeGroup[];
  patterns?: VisualPattern[];
  statistics: { [key: string]: number };
}

export interface VisualDifference {
  type: "added" | "removed" | "modified" | "moved";
  path: string;
  element?: VisualNode | VisualNodeGroup;
  previousElement?: VisualNode | VisualNodeGroup;
  changes?: {
    property: string;
    before: unknown;
    after: unknown;
  }[];
  // Semantic detection fields
  positionDiff?: number;
  sizeDiff?: number;
  similarity?: number;
}

export interface SemanticDifferenceDetection {
  hasPositionShifts: boolean;
  hasZIndexChanges: boolean;
  hasOverflowIssues: boolean;
  hasLayoutShifts: boolean;
  detectedPatterns: string[];
}

export interface SemanticDifferenceMessage {
  severity: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  messages: string[];
  patterns: string[];
}

// Threshold configuration for comparisons
export interface ThresholdConfig {
  // Percentage-based thresholds (0-100)
  similarityThreshold?: number;
  
  // Absolute pixel thresholds
  positionThreshold?: {
    enabled: boolean;
    value: number; // pixels
    strict?: boolean; // If true, any difference above value fails
  };
  
  sizeThreshold?: {
    enabled: boolean;
    value: number; // pixels
    percentage?: number; // Optional: also check percentage change
  };
  
  // Element count thresholds
  elementCountThreshold?: {
    added?: number; // Max allowed added elements
    removed?: number; // Max allowed removed elements
    modified?: number; // Max allowed modified elements
  };
  
  // Specific pattern thresholds
  scrollThreshold?: {
    enabled: boolean;
    maxScrollableElements?: number;
  };
  
  // Z-index change tolerance
  zIndexThreshold?: {
    enabled: boolean;
    allowChanges: boolean;
  };
}