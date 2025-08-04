export interface StabilityCheckOptions {
  minIterations: number;
  maxIterations: number;
  viewport: { width: number; height: number };
  delay: number;
  targetStability: number;
}

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutElement {
  tagName: string;
  className: string;
  id: string;
  rect: LayoutRect;
  text?: string;
  role?: string | null;
  ariaLabel?: string | null;
  ariaAttributes?: { [key: string]: string };
  isInteractive?: boolean;
  hasParentWithSameSize?: boolean;
  computedStyle?: { [key: string]: string };
  importance?: number;
  semanticType?: string;
  children?: (LayoutElement | SemanticGroup)[];
}

export interface SemanticGroup {
  type: string;
  label: string;
  bounds: LayoutRect;
  importance: number;
  children: (LayoutElement | SemanticGroup)[];
}

export interface LayoutPattern {
  elements: LayoutElement[];
  type: string;
  className: string;
  averageSize: { width: number; height: number };
}

export interface LayoutAnalysisResult {
  url: string;
  timestamp: string;
  viewport: { 
    width: number; 
    height: number; 
    scrollX: number; 
    scrollY: number 
  };
  elements: LayoutElement[];
  semanticGroups?: SemanticGroup[];
  patterns?: LayoutPattern[];
  statistics: { [key: string]: number };
}

export interface LayoutDifference {
  type: "added" | "removed" | "modified" | "moved";
  path: string;
  element?: LayoutElement | SemanticGroup;
  previousElement?: LayoutElement | SemanticGroup;
  changes?: {
    property: string;
    before: unknown;
    after: unknown;
  }[];
}