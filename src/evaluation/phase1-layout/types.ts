/**
 * Phase 1: Layout Extraction & Comparison Types
 */

export interface BaselineLayout {
  id: string;
  url: string;
  timestamp: number;
  viewport: {
    width: number;
    height: number;
  };
  elements: LayoutElement[];
  metadata?: Record<string, any>;
}

export interface LayoutElement {
  selector: string;
  tagName: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  text?: string;
  visibility: {
    isVisible: boolean;
    opacity: number;
    zIndex?: number;
  };
  attributes?: Record<string, string>;
  children?: LayoutElement[];
}

export interface ComparisonResult {
  id: string;
  baselineId: string;
  currentId: string;
  timestamp: number;
  status: 'passed' | 'failed' | 'warning';
  differences: LayoutDifference[];
  statistics: {
    totalElements: number;
    changedElements: number;
    addedElements: number;
    removedElements: number;
    percentageChanged: number;
  };
}

export interface LayoutDifference {
  type: 'added' | 'removed' | 'modified' | 'moved';
  element: LayoutElement;
  baseline?: LayoutElement;
  current?: LayoutElement;
  changes?: {
    bounds?: boolean;
    text?: boolean;
    visibility?: boolean;
    attributes?: boolean;
  };
}