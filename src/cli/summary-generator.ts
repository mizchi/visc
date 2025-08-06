/**
 * Summary generator for visual regression test results
 * Generates human-readable markdown summaries from comparison results
 */

import type { TestResult } from '../workflow.js';
import type { VisualNodeGroup } from '../types.js';

interface SummaryData {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testResults: TestSummary[];
}

interface TestSummary {
  testId: string;
  url: string;
  status: 'passed' | 'failed';
  viewports: ViewportSummary[];
}

interface ViewportSummary {
  name: string;
  width: number;
  height: number;
  similarity: number;
  status: 'passed' | 'failed';
  changes: ChangeDescription[];
}

interface ChangeDescription {
  type: 'added' | 'removed' | 'modified' | 'moved';
  description: string;
  severity: 'low' | 'medium' | 'high';
  details?: string;
}

/**
 * Generate a markdown summary from test results
 */
export function generateSummary(testResults: TestResult[]): string {
  const summaryData = prepareSummaryData(testResults);
  return renderMarkdown(summaryData);
}

/**
 * Prepare summary data from test results
 */
function prepareSummaryData(testResults: TestResult[]): SummaryData {
  const timestamp = new Date().toISOString();
  const totalTests = testResults.length;
  const failedTests = testResults.filter(r => r.hasIssues).length;
  const passedTests = totalTests - failedTests;

  const testSummaries: TestSummary[] = testResults.map(result => {
    const viewportSummaries: ViewportSummary[] = result.comparisons.map((comp: any) => {
      const changes = analyzeChanges(comp.comparison.raw);
      
      return {
        name: comp.viewport.name || `${comp.viewport.width}x${comp.viewport.height}`,
        width: comp.viewport.width,
        height: comp.viewport.height,
        similarity: comp.comparison.similarity,
        status: comp.comparison.hasIssues ? 'failed' : 'passed',
        changes
      };
    });

    return {
      testId: result.testCase.id,
      url: result.testCase.url,
      status: result.hasIssues ? 'failed' : 'passed',
      viewports: viewportSummaries
    };
  });

  return {
    timestamp,
    totalTests,
    passedTests,
    failedTests,
    testResults: testSummaries
  };
}

/**
 * Analyze changes from comparison result
 */
function analyzeChanges(comparison: any): ChangeDescription[] {
  const changes: ChangeDescription[] = [];

  // Analyze added groups
  if (comparison.addedGroups && comparison.addedGroups.length > 0) {
    for (const group of comparison.addedGroups) {
      changes.push({
        type: 'added',
        description: describeGroup(group),
        severity: assessSeverity(group),
        details: `New ${group.type || 'element'} group with ${group.children?.length || 0} elements`
      });
    }
  }

  // Analyze removed groups
  if (comparison.removedGroups && comparison.removedGroups.length > 0) {
    for (const group of comparison.removedGroups) {
      changes.push({
        type: 'removed',
        description: describeGroup(group),
        severity: assessSeverity(group),
        details: `Removed ${group.type || 'element'} group with ${group.children?.length || 0} elements`
      });
    }
  }

  // Analyze differences
  if (comparison.differences && comparison.differences.length > 0) {
    for (const diff of comparison.differences) {
      const change = analyzeGroupDifference(diff);
      if (change) {
        changes.push(change);
      }
    }
  }

  // Fallback to element-level changes if no group changes
  if (changes.length === 0) {
    if (comparison.addedElements && comparison.addedElements.length > 0) {
      changes.push({
        type: 'added',
        description: `${comparison.addedElements.length} new elements`,
        severity: comparison.addedElements.length > 10 ? 'high' : 'medium'
      });
    }

    if (comparison.removedElements && comparison.removedElements.length > 0) {
      changes.push({
        type: 'removed',
        description: `${comparison.removedElements.length} elements removed`,
        severity: comparison.removedElements.length > 10 ? 'high' : 'medium'
      });
    }

    if (comparison.differences && comparison.differences.length > 0) {
      const significantChanges = comparison.differences.filter((d: any) => 
        d.similarity < 90 || d.positionDiff > 10 || d.sizeDiff > 10
      );
      
      if (significantChanges.length > 0) {
        changes.push({
          type: 'modified',
          description: `${significantChanges.length} elements changed`,
          severity: significantChanges.length > 5 ? 'high' : 'medium'
        });
      }
    }
  }

  return changes.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Describe a visual node group
 */
function describeGroup(group: VisualNodeGroup): string {
  const type = group.type || 'element';
  const elementCount = group.children?.length || 0;
  
  // Try to identify the group by its content
  if (group.children && group.children.length > 0) {
    const firstElement = group.children[0] as any;
    if (firstElement.tag === 'nav') return 'Navigation menu';
    if (firstElement.tag === 'header') return 'Page header';
    if (firstElement.tag === 'footer') return 'Page footer';
    if (firstElement.tag === 'aside') return 'Sidebar';
    if (firstElement.tag === 'article') return 'Article content';
    if (firstElement.tag === 'section') return 'Content section';
    if (firstElement.tag === 'form') return 'Form';
    if (firstElement.tag === 'table') return 'Table';
    if (firstElement.className?.includes('modal')) return 'Modal dialog';
    if (firstElement.className?.includes('popup')) return 'Popup';
    if (firstElement.className?.includes('menu')) return 'Menu';
    if (firstElement.className?.includes('card')) return 'Card component';
    if (firstElement.className?.includes('button')) return 'Button group';
  }
  
  return `${type} group (${elementCount} elements)`;
}

/**
 * Assess the severity of a change
 */
function assessSeverity(group: VisualNodeGroup): 'low' | 'medium' | 'high' {
  const elementCount = group.children?.length || 0;
  
  // High severity for large groups or important elements
  if (elementCount > 20) return 'high';
  if (group.type === 'header' || group.type === 'navigation') return 'high';
  if (group.type === 'form' || group.type === 'table') return 'high';
  
  // Medium severity for moderate groups
  if (elementCount > 5) return 'medium';
  if (group.type === 'content' || group.type === 'article') return 'medium';
  
  // Low severity for small groups
  return 'low';
}

/**
 * Analyze difference between groups
 */
function analyzeGroupDifference(diff: any): ChangeDescription | null {
  if (!diff.group) return null;
  
  const group = diff.group;
  const positionChange = diff.positionDiff || 0;
  const sizeChange = diff.sizeDiff || 0;
  
  // Determine the type of change
  if (positionChange > 20 && sizeChange < 5) {
    return {
      type: 'moved',
      description: `${describeGroup(group)} moved by ${Math.round(positionChange)}px`,
      severity: positionChange > 100 ? 'high' : 'medium'
    };
  }
  
  if (sizeChange > 10) {
    return {
      type: 'modified',
      description: `${describeGroup(group)} resized by ${Math.round(sizeChange)}%`,
      severity: sizeChange > 50 ? 'high' : 'medium'
    };
  }
  
  if (diff.similarity < 90) {
    return {
      type: 'modified',
      description: `${describeGroup(group)} content changed (${Math.round(diff.similarity)}% similar)`,
      severity: diff.similarity < 50 ? 'high' : 'medium'
    };
  }
  
  return null;
}

/**
 * Render summary data as markdown
 */
function renderMarkdown(data: SummaryData): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# Visual Regression Test Summary');
  lines.push('');
  lines.push(`**Generated:** ${new Date(data.timestamp).toLocaleString()}`);
  lines.push('');
  
  // Overall status
  lines.push('## Overall Results');
  lines.push('');
  
  const statusEmoji = data.failedTests === 0 ? '✅' : '❌';
  const statusText = data.failedTests === 0 ? 'All tests passed' : `${data.failedTests} test(s) failed`;
  
  lines.push(`${statusEmoji} **${statusText}**`);
  lines.push('');
  lines.push(`- Total Tests: ${data.totalTests}`);
  lines.push(`- Passed: ${data.passedTests}`);
  lines.push(`- Failed: ${data.failedTests}`);
  lines.push('');
  
  // Failed tests summary (if any)
  if (data.failedTests > 0) {
    lines.push('## Failed Tests');
    lines.push('');
    
    const failedTests = data.testResults.filter(t => t.status === 'failed');
    
    for (const test of failedTests) {
      lines.push(`### 🔴 ${test.testId}`);
      lines.push('');
      lines.push(`**URL:** ${test.url}`);
      lines.push('');
      
      for (const viewport of test.viewports.filter(v => v.status === 'failed')) {
        lines.push(`#### ${viewport.name} (${viewport.width}×${viewport.height})`);
        lines.push('');
        lines.push(`**Similarity:** ${viewport.similarity.toFixed(1)}%`);
        lines.push('');
        
        if (viewport.changes.length > 0) {
          lines.push('**Changes detected:**');
          lines.push('');
          
          for (const change of viewport.changes) {
            const icon = getChangeIcon(change.type);
            const severityBadge = getSeverityBadge(change.severity);
            lines.push(`- ${icon} ${change.description} ${severityBadge}`);
            if (change.details) {
              lines.push(`  - ${change.details}`);
            }
          }
          lines.push('');
        }
      }
    }
  }
  
  // Passed tests summary
  if (data.passedTests > 0) {
    lines.push('## Passed Tests');
    lines.push('');
    
    const passedTests = data.testResults.filter(t => t.status === 'passed');
    
    for (const test of passedTests) {
      lines.push(`✅ **${test.testId}** - ${test.url}`);
      
      const similarities = test.viewports.map(v => v.similarity);
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      lines.push(`  - Average similarity: ${avgSimilarity.toFixed(1)}%`);
    }
    lines.push('');
  }
  
  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*This summary was automatically generated for AI analysis and quick issue identification.*');
  lines.push('*For detailed visual comparisons, check the SVG diff files in the output directory.*');
  
  return lines.join('\n');
}

/**
 * Get icon for change type
 */
function getChangeIcon(type: ChangeDescription['type']): string {
  switch (type) {
    case 'added': return '➕';
    case 'removed': return '➖';
    case 'modified': return '🔄';
    case 'moved': return '↔️';
    default: return '•';
  }
}

/**
 * Get severity badge
 */
function getSeverityBadge(severity: ChangeDescription['severity']): string {
  switch (severity) {
    case 'high': return '`HIGH`';
    case 'medium': return '`MEDIUM`';
    case 'low': return '`LOW`';
    default: return '';
  }
}