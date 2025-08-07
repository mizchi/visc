/**
 * Summary generator for visual regression test results
 * Generates human-readable markdown summaries from comparison results
 */

import type { TestResult } from '../workflow.js';
import type { VisualNodeGroup, VisualDifference } from '../types.js';
import { 
  detectSemanticDifferences, 
  generateSemanticMessage,
  calculatePositionDiff,
  calculateSizeDiff 
} from '../semantic-detector.js';
import { 
  findCorrespondingGroups,
  generateAccessibilitySelector,
  type GroupCorrespondence 
} from '../layout/accessibility-matcher.js';
import { generateMovementSummary } from '../renderer/movement-renderer.js';
import {
  analyzeGroupDiffs,
  generateElementDiffSummary,
  type ElementDiff
} from '../analysis/element-diff-analyzer.js';

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
  semanticAnalysis?: {
    detection: ReturnType<typeof detectSemanticDifferences>;
    message: ReturnType<typeof generateSemanticMessage>;
  };
  movementAnalysis?: {
    correspondences: GroupCorrespondence[];
    summary: ReturnType<typeof generateMovementSummary>;
  };
  elementDiffs?: ElementDiff[];
}

interface ChangeDescription {
  type: 'added' | 'removed' | 'modified' | 'moved';
  description: string;
  severity: 'low' | 'medium' | 'high';
  details?: string;
  selector?: string; // CSS selector for the changed element
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
      
      // Create VisualDifference array for semantic detection
      const differences: VisualDifference[] = [];
      
      // Convert raw comparison data to VisualDifference format
      if (comp.comparison.raw.addedGroups) {
        comp.comparison.raw.addedGroups.forEach((group: any) => {
          differences.push({ type: 'added', path: '', element: group });
        });
      }
      if (comp.comparison.raw.removedGroups) {
        comp.comparison.raw.removedGroups.forEach((group: any) => {
          differences.push({ type: 'removed', path: '', previousElement: group });
        });
      }
      if (comp.comparison.raw.differences) {
        comp.comparison.raw.differences.forEach((diff: any) => {
          differences.push({
            type: diff.type || 'modified',
            path: '',
            element: diff.group,
            positionDiff: diff.positionDiff,
            sizeDiff: diff.sizeDiff,
            similarity: diff.similarity
          });
        });
      }
      
      // Perform semantic detection if there are differences
      let semanticAnalysis;
      if (differences.length > 0 && comp.currentLayout && comp.previousLayout) {
        const detection = detectSemanticDifferences(
          differences,
          comp.currentLayout,
          comp.previousLayout
        );
        const message = generateSemanticMessage(detection, comp.comparison.similarity);
        semanticAnalysis = { detection, message };
      }
      
      // Perform accessibility-based movement analysis
      let movementAnalysis;
      if (comp.currentLayout && comp.previousLayout) {
        const correspondences = findCorrespondingGroups(
          comp.previousLayout,
          comp.currentLayout
        );
        if (correspondences.length > 0) {
          const summary = generateMovementSummary(correspondences);
          movementAnalysis = { correspondences, summary };
        }
      }
      
      // Perform element-level diff analysis
      let elementDiffs: ElementDiff[] = [];
      if (comp.currentLayout && comp.previousLayout) {
        // Analyze differences for each group correspondence
        if (movementAnalysis && movementAnalysis.correspondences) {
          movementAnalysis.correspondences.forEach(corr => {
            const groupDiffs = analyzeGroupDiffs(corr.group1, corr.group2);
            elementDiffs.push(...groupDiffs);
          });
        }
        
        // Also analyze added/removed groups
        if (comp.comparison.raw.addedGroups) {
          comp.comparison.raw.addedGroups.forEach((group: VisualNodeGroup) => {
            const groupDiffs = analyzeGroupDiffs(undefined, group);
            elementDiffs.push(...groupDiffs);
          });
        }
        if (comp.comparison.raw.removedGroups) {
          comp.comparison.raw.removedGroups.forEach((group: VisualNodeGroup) => {
            const groupDiffs = analyzeGroupDiffs(group, undefined);
            elementDiffs.push(...groupDiffs);
          });
        }
      }
      
      return {
        name: comp.viewport.name || `${comp.viewport.width}x${comp.viewport.height}`,
        width: comp.viewport.width,
        height: comp.viewport.height,
        similarity: comp.comparison.similarity,
        status: comp.comparison.hasIssues ? 'failed' : 'passed',
        changes,
        semanticAnalysis,
        movementAnalysis,
        elementDiffs: elementDiffs.length > 0 ? elementDiffs : undefined
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
        details: `New ${group.type || 'element'} group with ${group.children?.length || 0} elements`,
        selector: generateSelector(group)
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
        details: `Removed ${group.type || 'element'} group with ${group.children?.length || 0} elements`,
        selector: generateSelector(group)
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
      // Group added elements by type/class for better reporting
      const elementGroups = groupElementsByType(comparison.addedElements);
      for (const [key, elements] of Object.entries(elementGroups)) {
        changes.push({
          type: 'added',
          description: `${elements.length} new ${key} elements`,
          severity: elements.length > 10 ? 'high' : 'medium',
          details: elements.slice(0, 3).map((el: any) => generateSelector(el)).filter(Boolean).join(', '),
          selector: elements.length === 1 ? generateSelector(elements[0]) : undefined
        });
      }
    }

    if (comparison.removedElements && comparison.removedElements.length > 0) {
      // Group removed elements by type/class for better reporting
      const elementGroups = groupElementsByType(comparison.removedElements);
      for (const [key, elements] of Object.entries(elementGroups)) {
        changes.push({
          type: 'removed',
          description: `${elements.length} ${key} elements removed`,
          severity: elements.length > 10 ? 'high' : 'medium',
          details: elements.slice(0, 3).map((el: any) => generateSelector(el)).filter(Boolean).join(', '),
          selector: elements.length === 1 ? generateSelector(elements[0]) : undefined
        });
      }
    }

    if (comparison.differences && comparison.differences.length > 0) {
      const significantChanges = comparison.differences.filter((d: any) => 
        d.similarity < 90 || d.positionDiff > 10 || d.sizeDiff > 10
      );
      
      if (significantChanges.length > 0) {
        // Group by change type for better reporting
        const grouped = groupDifferencesByType(significantChanges);
        for (const [changeType, diffs] of Object.entries(grouped)) {
          changes.push({
            type: 'modified',
            description: `${diffs.length} elements with ${changeType} changes`,
            severity: diffs.length > 5 ? 'high' : 'medium',
            details: diffs.slice(0, 3).map((d: any) => {
              const selector = generateSelector(d.element || d.previousElement);
              const changeDetail = describeElementChange(d);
              return selector ? `${selector}: ${changeDetail}` : changeDetail;
            }).join('; '),
            selector: diffs.length === 1 ? generateSelector(diffs[0].element || diffs[0].previousElement) : undefined
          });
        }
      }
    }
  }

  return changes.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Generate CSS selector for a visual node or group
 */
function generateSelector(node: any): string | undefined {
  if (!node) return undefined;
  
  // Check if node is an object (not a string)
  if (typeof node !== 'object') return undefined;
  
  // For VisualNode
  if ('tagName' in node || 'id' in node || 'className' in node) {
    const parts: string[] = [];
    
    if (node.tagName) {
      parts.push(node.tagName.toLowerCase());
    }
    
    if (node.id) {
      parts.push(`#${node.id}`);
    } else if (node.className && typeof node.className === 'string') {
      const classes = node.className.split(' ').filter((c: string) => c);
      if (classes.length > 0) {
        parts.push(`.${classes[0]}`);
      }
    }
    
    return parts.length > 0 ? parts.join('') : undefined;
  }
  
  // For VisualNodeGroup
  if ('children' in node && node.children && node.children.length > 0) {
    const firstChild = node.children[0];
    return generateSelector(firstChild);
  }
  
  return undefined;
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
  const selector = generateSelector(group);
  
  // Determine the type of change
  if (positionChange > 20 && sizeChange < 5) {
    return {
      type: 'moved',
      description: `${describeGroup(group)} moved by ${Math.round(positionChange)}px`,
      severity: positionChange > 100 ? 'high' : 'medium',
      selector
    };
  }
  
  if (sizeChange > 10) {
    return {
      type: 'modified',
      description: `${describeGroup(group)} resized by ${Math.round(sizeChange)}%`,
      severity: sizeChange > 50 ? 'high' : 'medium',
      selector
    };
  }
  
  if (diff.similarity < 90) {
    return {
      type: 'modified',
      description: `${describeGroup(group)} content changed (${Math.round(diff.similarity)}% similar)`,
      severity: diff.similarity < 50 ? 'high' : 'medium',
      selector
    };
  }
  
  return null;
}

/**
 * Group elements by their type and class for better reporting
 */
function groupElementsByType(elements: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  for (const element of elements) {
    let key = element.tagName || 'unknown';
    if (element.className) {
      const mainClass = element.className.split(' ')[0];
      if (mainClass) {
        key = `${key}.${mainClass}`;
      }
    }
    
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(element);
  }
  
  return groups;
}

/**
 * Group differences by their change type
 */
function groupDifferencesByType(differences: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  
  for (const diff of differences) {
    let changeType = 'general';
    
    if (diff.positionDiff && diff.positionDiff > 10) {
      changeType = 'position';
    } else if (diff.sizeDiff && diff.sizeDiff > 10) {
      changeType = 'size';
    } else if (diff.changes && diff.changes.length > 0) {
      // Check what properties changed
      const changedProps = diff.changes.map((c: any) => c.property);
      if (changedProps.includes('display') || changedProps.includes('visibility')) {
        changeType = 'visibility';
      } else if (changedProps.includes('color') || changedProps.includes('backgroundColor')) {
        changeType = 'style';
      } else if (changedProps.includes('fontSize') || changedProps.includes('fontWeight')) {
        changeType = 'typography';
      }
    }
    
    if (!groups[changeType]) {
      groups[changeType] = [];
    }
    groups[changeType].push(diff);
  }
  
  return groups;
}

/**
 * Describe element change details
 */
function describeElementChange(diff: any): string {
  const details: string[] = [];
  
  if (diff.positionDiff && diff.positionDiff > 0) {
    details.push(`moved ${diff.positionDiff.toFixed(0)}px`);
  }
  
  if (diff.sizeDiff && diff.sizeDiff > 0) {
    details.push(`resized ${diff.sizeDiff.toFixed(0)}px`);
  }
  
  if (diff.changes && diff.changes.length > 0) {
    const importantProps = diff.changes
      .filter((c: any) => ['display', 'visibility', 'opacity', 'color', 'backgroundColor'].includes(c.property))
      .map((c: any) => `${c.property}: ${c.before} → ${c.after}`);
    
    if (importantProps.length > 0) {
      details.push(importantProps.slice(0, 2).join(', '));
    }
  }
  
  if (diff.similarity !== undefined && diff.similarity < 90) {
    details.push(`${diff.similarity.toFixed(0)}% similar`);
  }
  
  return details.length > 0 ? details.join(', ') : 'changed';
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
        
        // Add semantic analysis if available
        if (viewport.semanticAnalysis) {
          lines.push('**意味的差分検出:**');
          lines.push('');
          const { message } = viewport.semanticAnalysis;
          lines.push(`- Severity: ${message.severity.toUpperCase()}`);
          for (const msg of message.messages) {
            lines.push(`- ${msg}`);
          }
          if (message.patterns.length > 0) {
            lines.push('');
            lines.push('**検出パターン:**');
            for (const pattern of message.patterns) {
              lines.push(`  • ${pattern}`);
            }
          }
          lines.push('');
        }
        
        // Add movement analysis if available
        if (viewport.movementAnalysis && viewport.movementAnalysis.summary.totalMovements > 0) {
          lines.push('**要素の移動検出 (アクセシビリティベース):**');
          lines.push('');
          const { summary } = viewport.movementAnalysis;
          lines.push(`- 移動した要素数: ${summary.totalMovements}`);
          lines.push(`- 大幅な移動 (>50px): ${summary.significantMovements}`);
          lines.push(`- 平均移動距離: ${summary.averageDistance}px`);
          lines.push(`- 最大移動距離: ${summary.maxDistance}px`);
          lines.push('');
          
          if (summary.movements.length > 0) {
            lines.push('**主な移動要素:**');
            lines.push('');
            lines.push('| セレクタ | ラベル | 移動距離 | 方向 | アクセシビリティID |');
            lines.push('|----------|--------|----------|------|-------------------|');
            
            // Show top 5 movements
            summary.movements.slice(0, 5).forEach(movement => {
              lines.push(
                `| \`${movement.selector || 'N/A'}\` | ${movement.label} | ${movement.distance}px | ${movement.direction} | ${movement.accessibilityId || 'N/A'} |`
              );
            });
            
            if (summary.movements.length > 5) {
              lines.push(`| ... and ${summary.movements.length - 5} more ... | | | | |`);
            }
            lines.push('');
          }
        }
        
        // Add element-level differences
        if (viewport.elementDiffs && viewport.elementDiffs.length > 0) {
          const elementDiffSummary = generateElementDiffSummary(viewport.elementDiffs);
          if (elementDiffSummary) {
            lines.push('');
            lines.push(elementDiffSummary);
          }
        }
        
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
            if (change.selector) {
              lines.push(`  - Selector: \`${change.selector}\``);
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