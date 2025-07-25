/**
 * Phase 3: Visual Diff Generation Types
 */

import { ComparisonResult, LayoutDifference } from '../phase1-layout/types';

export interface VisualDiff {
  id: string;
  comparisonId: string;
  baselineScreenshot: string;
  currentScreenshot: string;
  diffImage?: string;
  overlayImage?: string;
  highlightRegions: HighlightRegion[];
  metadata: {
    createdAt: number;
    diffPixels: number;
    diffPercentage: number;
    threshold: number;
  };
}

export interface HighlightRegion {
  type: 'added' | 'removed' | 'modified';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  color: string;
  opacity: number;
  label?: string;
}

export interface DiffGenerationOptions {
  threshold?: number;
  highlightColor?: {
    added?: string;
    removed?: string;
    modified?: string;
  };
  outputFormat?: 'png' | 'jpeg';
  includeOverlay?: boolean;
}