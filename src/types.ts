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
}