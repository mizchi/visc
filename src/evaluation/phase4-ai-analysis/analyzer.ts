/**
 * Phase 4: AI Analysis Service
 */

import { AIAnalysisRequest, AIAnalysisResult, AIProvider, AnalysisCategory, Issue } from './types';

export class AIAnalyzer {
  constructor(private readonly provider: AIProvider) {}
  
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    try {
      const result = await this.provider.analyze(request);
      
      // Validate and enhance the result
      return this.validateAndEnhanceResult(result, request);
    } catch (error) {
      // Fallback to basic analysis if AI fails
      return this.createFallbackAnalysis(request);
    }
  }
  
  private validateAndEnhanceResult(
    result: AIAnalysisResult,
    request: AIAnalysisRequest
  ): AIAnalysisResult {
    // Ensure all required fields are present
    return {
      ...result,
      id: result.id || `ai-analysis-${Date.now()}`,
      comparisonId: request.comparisonResult.id,
      timestamp: result.timestamp || Date.now(),
      severity: this.validateSeverity(result.severity),
      confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
    };
  }
  
  private validateSeverity(severity: any): AIAnalysisResult['severity'] {
    const valid = ['low', 'medium', 'high', 'critical'];
    return valid.includes(severity) ? severity : 'medium';
  }
  
  private createFallbackAnalysis(request: AIAnalysisRequest): AIAnalysisResult {
    const stats = request.comparisonResult.statistics;
    const severity = this.calculateSeverity(stats);
    
    const categories: AnalysisCategory[] = [];
    const issues: Issue[] = [];
    
    if (stats.removedElements > 0) {
      issues.push({
        description: `${stats.removedElements} elements were removed`,
        impact: 'major'
      });
    }
    
    if (stats.addedElements > 0) {
      issues.push({
        description: `${stats.addedElements} new elements were added`,
        impact: 'moderate'
      });
    }
    
    if (stats.changedElements > 0) {
      issues.push({
        description: `${stats.changedElements} elements were modified`,
        impact: 'moderate'
      });
    }
    
    categories.push({
      type: 'layout',
      issues
    });
    
    return {
      id: `ai-analysis-${Date.now()}`,
      comparisonId: request.comparisonResult.id,
      timestamp: Date.now(),
      summary: `Detected ${stats.percentageChanged.toFixed(1)}% changes in the layout`,
      severity,
      categories,
      recommendations: this.generateRecommendations(stats),
      confidence: 0.7
    };
  }
  
  private calculateSeverity(stats: any): AIAnalysisResult['severity'] {
    if (stats.percentageChanged > 50) return 'critical';
    if (stats.percentageChanged > 20) return 'high';
    if (stats.percentageChanged > 5) return 'medium';
    return 'low';
  }
  
  private generateRecommendations(stats: any): string[] {
    const recommendations: string[] = [];
    
    if (stats.removedElements > 5) {
      recommendations.push('Review removed elements to ensure no critical functionality was lost');
    }
    
    if (stats.addedElements > 10) {
      recommendations.push('Verify that new elements maintain design consistency');
    }
    
    if (stats.percentageChanged > 20) {
      recommendations.push('Consider reviewing this change with the design team');
    }
    
    return recommendations;
  }
}

/**
 * Mock AI Provider for testing
 */
export class MockAIProvider implements AIProvider {
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const stats = request.comparisonResult.statistics;
    const severity = this.calculateSeverity(stats);
    
    return {
      id: `ai-analysis-${Date.now()}`,
      comparisonId: request.comparisonResult.id,
      timestamp: Date.now(),
      summary: this.generateSummary(request),
      severity,
      categories: this.analyzeCategories(request),
      recommendations: this.generateRecommendations(request),
      confidence: 0.85
    };
  }
  
  private calculateSeverity(stats: any): AIAnalysisResult['severity'] {
    if (stats.percentageChanged > 50) return 'critical';
    if (stats.percentageChanged > 20) return 'high';
    if (stats.percentageChanged > 5) return 'medium';
    return 'low';
  }
  
  private generateSummary(request: AIAnalysisRequest): string {
    const stats = request.comparisonResult.statistics;
    const changes: string[] = [];
    
    if (stats.addedElements > 0) {
      changes.push(`${stats.addedElements} new elements`);
    }
    if (stats.removedElements > 0) {
      changes.push(`${stats.removedElements} removed elements`);
    }
    if (stats.changedElements > 0) {
      changes.push(`${stats.changedElements} modified elements`);
    }
    
    return `Visual regression detected with ${changes.join(', ')}. Overall change: ${stats.percentageChanged.toFixed(1)}%`;
  }
  
  private analyzeCategories(request: AIAnalysisRequest): AnalysisCategory[] {
    const categories: AnalysisCategory[] = [];
    const differences = request.comparisonResult.differences;
    
    // Layout analysis
    const layoutIssues: Issue[] = [];
    const movedElements = differences.filter(d => d.type === 'moved');
    if (movedElements.length > 0) {
      layoutIssues.push({
        description: `${movedElements.length} elements changed position`,
        impact: 'moderate',
        suggestion: 'Verify that element repositioning maintains usability'
      });
    }
    
    if (layoutIssues.length > 0) {
      categories.push({ type: 'layout', issues: layoutIssues });
    }
    
    // Content analysis
    const contentIssues: Issue[] = [];
    const textChanges = differences.filter(d => d.changes?.text);
    if (textChanges.length > 0) {
      contentIssues.push({
        description: `Text content changed in ${textChanges.length} elements`,
        impact: 'minor',
        suggestion: 'Review text changes for accuracy'
      });
    }
    
    if (contentIssues.length > 0) {
      categories.push({ type: 'content', issues: contentIssues });
    }
    
    return categories;
  }
  
  private generateRecommendations(request: AIAnalysisRequest): string[] {
    const recommendations: string[] = [];
    const stats = request.comparisonResult.statistics;
    
    if (stats.percentageChanged > 10) {
      recommendations.push('Review changes with stakeholders before approval');
    }
    
    if (stats.removedElements > 0) {
      recommendations.push('Ensure removed elements don\'t impact user workflows');
    }
    
    recommendations.push('Run accessibility tests on modified areas');
    
    return recommendations;
  }
}