/**
 * Phase 4: AI Analysis Integration Types
 */

import { ComparisonResult } from '../phase1-layout/types';
import { VisualDiff } from '../phase3-visual-diff/types';

export interface AIAnalysisRequest {
  comparisonResult: ComparisonResult;
  visualDiff: VisualDiff;
  context?: {
    testName?: string;
    previousAnalysis?: AIAnalysisResult;
    customPrompt?: string;
  };
}

export interface AIAnalysisResult {
  id: string;
  comparisonId: string;
  timestamp: number;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  categories: AnalysisCategory[];
  recommendations: string[];
  confidence: number;
  rawResponse?: string;
}

export interface AnalysisCategory {
  type: 'layout' | 'content' | 'style' | 'functionality' | 'accessibility';
  issues: Issue[];
}

export interface Issue {
  description: string;
  impact: 'minor' | 'moderate' | 'major';
  element?: string;
  suggestion?: string;
}

export interface AIProvider {
  analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult>;
}