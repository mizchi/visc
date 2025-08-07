/**
 * Element-level diff analyzer for VRT improvements
 * Provides detailed information about CSS, style, and semantic changes
 */

import type { VisualNode, VisualNodeGroup, VisualTreeAnalysis } from '../types.js';
import type { VisualDifference } from '../layout/comparator.js';

/**
 * Detailed element difference information
 */
export interface ElementDiff {
  // Element identification
  selector: string;
  domPath: string;
  elementId?: string;
  className?: string;
  
  // Position and size changes
  positionChange?: {
    previousX: number;
    previousY: number;
    currentX: number;
    currentY: number;
    deltaX: number;
    deltaY: number;
  };
  
  sizeChange?: {
    previousWidth: number;
    previousHeight: number;
    currentWidth: number;
    currentHeight: number;
    deltaWidth: number;
    deltaHeight: number;
  };
  
  // Style changes
  styleChanges?: Array<{
    property: string;
    previousValue: string | number;
    currentValue: string | number;
  }>;
  
  // Semantic information
  semanticInfo?: {
    componentName?: string;
    previousText?: string;
    currentText?: string;
    previousAriaLabel?: string;
    currentAriaLabel?: string;
    role?: string;
    semanticTag?: string;
  };
  
  // CSS class changes
  classChanges?: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };
  
  // Change severity
  severity: 'low' | 'medium' | 'high';
  changeType: 'position' | 'size' | 'style' | 'content' | 'structure' | 'combined';
}

/**
 * Analyze element-level differences between two visual nodes
 */
export function analyzeElementDiff(
  previousNode: VisualNode | undefined,
  currentNode: VisualNode | undefined,
  parentPath?: string
): ElementDiff | null {
  if (!previousNode && !currentNode) return null;
  
  // Build DOM path
  const domPath = buildDomPath(currentNode || previousNode!, parentPath);
  
  // Build selector
  const selector = buildDetailedSelector(currentNode || previousNode!);
  
  const diff: ElementDiff = {
    selector,
    domPath,
    severity: 'low',
    changeType: 'style',
  };
  
  // Element identification
  if (currentNode || previousNode) {
    const node = currentNode || previousNode!;
    if (node.id) diff.elementId = node.id;
    if (node.className) diff.className = node.className;
  }
  
  // Analyze position changes
  if (previousNode && currentNode) {
    const positionDiff = analyzePositionChange(previousNode, currentNode);
    if (positionDiff) {
      diff.positionChange = positionDiff;
      if (Math.abs(positionDiff.deltaX) > 50 || Math.abs(positionDiff.deltaY) > 50) {
        diff.severity = 'high';
        diff.changeType = 'position';
      }
    }
    
    // Analyze size changes
    const sizeDiff = analyzeSizeChange(previousNode, currentNode);
    if (sizeDiff) {
      diff.sizeChange = sizeDiff;
      if (Math.abs(sizeDiff.deltaWidth) > 100 || Math.abs(sizeDiff.deltaHeight) > 100) {
        diff.severity = 'high';
        diff.changeType = diff.changeType === 'position' ? 'combined' : 'size';
      }
    }
    
    // Analyze style changes
    const styleChanges = analyzeStyleChanges(previousNode, currentNode);
    if (styleChanges.length > 0) {
      diff.styleChanges = styleChanges;
      if (styleChanges.some(s => ['display', 'position', 'flex-direction'].includes(s.property))) {
        diff.severity = 'high';
        diff.changeType = diff.changeType === 'position' || diff.changeType === 'size' ? 'combined' : 'style';
      }
    }
    
    // Analyze semantic changes (always include)
    const semanticInfo = analyzeSemanticChanges(previousNode, currentNode);
    diff.semanticInfo = semanticInfo;
    if (semanticInfo.previousText !== semanticInfo.currentText) {
      diff.changeType = 'content';
      diff.severity = 'medium';
    }
    
    // Analyze CSS class changes
    const classChanges = analyzeClassChanges(previousNode, currentNode, true);
    if (classChanges) {
      diff.classChanges = classChanges;
      if (classChanges.added.length > 0 || classChanges.removed.length > 0) {
        diff.severity = diff.severity === 'high' ? 'high' : 'medium';
      }
    }
  }
  
  return diff;
}

/**
 * Build a detailed CSS selector for an element
 */
function buildDetailedSelector(node: VisualNode): string {
  const parts: string[] = [];
  
  // Tag name
  if (node.tagName) {
    parts.push(node.tagName.toLowerCase());
  }
  
  // ID
  if (node.id) {
    parts.push(`#${node.id}`);
  }
  
  // Classes
  if (node.className && typeof node.className === 'string') {
    const classes = node.className.split(' ').filter(c => c);
    if (classes.length > 0) {
      // Use up to 2 most specific classes
      classes.slice(0, 2).forEach(cls => {
        parts.push(`.${cls}`);
      });
    }
  }
  
  // ARIA attributes for specificity
  if (node.ariaLabel) {
    parts.push(`[aria-label="${node.ariaLabel}"]`);
  } else if (node.role) {
    parts.push(`[role="${node.role}"]`);
  }
  
  return parts.join('') || node.tagName || 'element';
}

/**
 * Build DOM path for an element
 */
function buildDomPath(node: VisualNode, parentPath?: string): string {
  const currentSegment = node.tagName ? node.tagName.toLowerCase() : 'element';
  const classSegment = node.className && typeof node.className === 'string' 
    ? `.${node.className.split(' ')[0]}` 
    : '';
  
  const segment = `${currentSegment}${classSegment}`;
  
  return parentPath ? `${parentPath} > ${segment}` : segment;
}

/**
 * Analyze position changes
 */
function analyzePositionChange(prev: VisualNode, curr: VisualNode) {
  const deltaX = curr.rect.x - prev.rect.x;
  const deltaY = curr.rect.y - prev.rect.y;
  
  if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
    return null;
  }
  
  return {
    previousX: prev.rect.x,
    previousY: prev.rect.y,
    currentX: curr.rect.x,
    currentY: curr.rect.y,
    deltaX,
    deltaY,
  };
}

/**
 * Analyze size changes
 */
function analyzeSizeChange(prev: VisualNode, curr: VisualNode) {
  const deltaWidth = curr.rect.width - prev.rect.width;
  const deltaHeight = curr.rect.height - prev.rect.height;
  
  if (Math.abs(deltaWidth) < 1 && Math.abs(deltaHeight) < 1) {
    return null;
  }
  
  return {
    previousWidth: prev.rect.width,
    previousHeight: prev.rect.height,
    currentWidth: curr.rect.width,
    currentHeight: curr.rect.height,
    deltaWidth,
    deltaHeight,
  };
}

/**
 * Analyze style changes
 */
function analyzeStyleChanges(prev: VisualNode, curr: VisualNode): Array<{
  property: string;
  previousValue: string | number;
  currentValue: string | number;
}> {
  const changes: Array<{
    property: string;
    previousValue: string | number;
    currentValue: string | number;
  }> = [];
  
  // Check computed styles if available
  if ('computedStyle' in prev && 'computedStyle' in curr) {
    const prevStyle = (prev as any).computedStyle || {};
    const currStyle = (curr as any).computedStyle || {};
    
    // Important style properties to track (using camelCase for JS properties)
    const importantProps = [
      'display', 'position', 'flexDirection', 'justifyContent', 'alignItems',
      'gridTemplateColumns', 'gridTemplateRows', 'float', 'clear',
      'margin', 'padding', 'backgroundColor', 'color', 'fontSize',
      'fontWeight', 'textAlign', 'lineHeight', 'zIndex', 'opacity',
      'transform', 'transition', 'overflow', 'visibility', 'gap',
      'width', 'height', 'boxShadow', 'borderRadius', 'flexWrap'
    ];
    
    // Check all properties from both prev and curr styles
    const allProps = new Set([...Object.keys(prevStyle), ...Object.keys(currStyle)]);
    
    for (const prop of allProps) {
      // Check if this is an important property
      if (importantProps.includes(prop) || prevStyle[prop] !== currStyle[prop]) {
        if (prevStyle[prop] !== currStyle[prop]) {
          changes.push({
            property: prop,
            previousValue: prevStyle[prop] !== undefined ? prevStyle[prop] : 'none',
            currentValue: currStyle[prop] !== undefined ? currStyle[prop] : 'none',
          });
        }
      }
    }
  }
  
  // Infer display changes from structural changes
  if (prev.rect.width === 0 && curr.rect.width > 0) {
    changes.push({
      property: 'visibility',
      previousValue: 'hidden',
      currentValue: 'visible',
    });
  }
  
  return changes;
}

/**
 * Analyze semantic changes
 */
function analyzeSemanticChanges(prev: VisualNode, curr: VisualNode) {
  // Try to identify component name from classes
  let componentName: string | undefined;
  const className = curr.className || prev.className;
  if (className && typeof className === 'string') {
    const classes = className.split(' ');
    // Look for BEM-style component names
    const componentClass = classes.find(c => 
      /^[A-Z]/.test(c) || // PascalCase
      c.includes('__') || // BEM element
      c.includes('--')    // BEM modifier
    );
    if (componentClass) {
      // Extract base component name from BEM notation
      componentName = componentClass.split('__')[0].split('--')[0];
    }
  }
  
  return {
    componentName,
    previousText: prev.text,
    currentText: curr.text,
    previousAriaLabel: prev.ariaLabel || undefined,
    currentAriaLabel: curr.ariaLabel || undefined,
    role: curr.role || undefined,
    semanticTag: curr.tagName?.toLowerCase(),
  };
}

/**
 * Analyze CSS class changes
 */
function analyzeClassChanges(prev: VisualNode, curr: VisualNode, returnNullIfUnchanged = false) {
  const prevClasses = typeof prev.className === 'string' 
    ? prev.className.split(' ').filter(c => c)
    : [];
  const currClasses = typeof curr.className === 'string'
    ? curr.className.split(' ').filter(c => c)
    : [];
  
  const prevSet = new Set(prevClasses);
  const currSet = new Set(currClasses);
  
  const added = currClasses.filter(c => !prevSet.has(c));
  const removed = prevClasses.filter(c => !currSet.has(c));
  const unchanged = currClasses.filter(c => prevSet.has(c));
  
  // Option to return null if no changes
  if (returnNullIfUnchanged && added.length === 0 && removed.length === 0) {
    // Check if they are the same
    if (prevClasses.length === currClasses.length && prevClasses.length === unchanged.length) {
      return null;
    }
  }
  
  return { added, removed, unchanged };
}

/**
 * Analyze differences for a group of elements
 */
export function analyzeGroupDiffs(
  previousGroup: VisualNodeGroup | undefined,
  currentGroup: VisualNodeGroup | undefined
): ElementDiff[] {
  const diffs: ElementDiff[] = [];
  
  if (!previousGroup && !currentGroup) return diffs;
  
  // If one group is missing, all elements are added/removed
  if (!previousGroup || !currentGroup) {
    const group = previousGroup || currentGroup!;
    const isRemoved = !currentGroup;
    
    // Check if children exists before iterating
    if (!group.children) return diffs;
    
    group.children.forEach(child => {
      if ('tagName' in child) {
        const diff = analyzeElementDiff(
          isRemoved ? child : undefined,
          isRemoved ? undefined : child
        );
        if (diff) {
          diff.changeType = 'structure';
          diff.severity = 'high';
          diffs.push(diff);
        }
      }
    });
    
    return diffs;
  }
  
  // Match elements by ID, class, or position
  const matched = new Map<number, number>();
  const prevNodes = previousGroup.children?.filter(c => 'tagName' in c) as VisualNode[] || [];
  const currNodes = currentGroup.children?.filter(c => 'tagName' in c) as VisualNode[] || [];
  
  // First pass: match by ID
  prevNodes.forEach((prev, prevIdx) => {
    if (prev.id) {
      const currIdx = currNodes.findIndex(curr => curr.id === prev.id);
      if (currIdx !== -1 && !Array.from(matched.values()).includes(currIdx)) {
        matched.set(prevIdx, currIdx);
      }
    }
  });
  
  // Second pass: match by class and tag
  prevNodes.forEach((prev, prevIdx) => {
    if (matched.has(prevIdx)) return;
    
    const currIdx = currNodes.findIndex((curr, idx) => 
      !Array.from(matched.values()).includes(idx) &&
      curr.tagName === prev.tagName &&
      curr.className === prev.className
    );
    
    if (currIdx !== -1) {
      matched.set(prevIdx, currIdx);
    }
  });
  
  // Analyze matched elements
  matched.forEach((currIdx, prevIdx) => {
    const diff = analyzeElementDiff(prevNodes[prevIdx], currNodes[currIdx]);
    if (diff) {
      diffs.push(diff);
    }
  });
  
  // Analyze unmatched elements (removed)
  prevNodes.forEach((prev, idx) => {
    if (!matched.has(idx)) {
      const diff = analyzeElementDiff(prev, undefined);
      if (diff) {
        diff.changeType = 'structure';
        diff.severity = 'high';
        diffs.push(diff);
      }
    }
  });
  
  // Analyze unmatched elements (added)
  currNodes.forEach((curr, idx) => {
    if (!Array.from(matched.values()).includes(idx)) {
      const diff = analyzeElementDiff(undefined, curr);
      if (diff) {
        diff.changeType = 'structure';
        diff.severity = 'high';
        diffs.push(diff);
      }
    }
  });
  
  return diffs;
}

/**
 * Generate a detailed summary of element differences
 */
export function generateElementDiffSummary(diffs: ElementDiff[]): string {
  const lines: string[] = [];
  
  if (diffs.length === 0) return '';
  
  lines.push('### 要素レベルの詳細な差分\n');
  
  // Group by severity
  const highSeverity = diffs.filter(d => d.severity === 'high');
  const mediumSeverity = diffs.filter(d => d.severity === 'medium');
  const lowSeverity = diffs.filter(d => d.severity === 'low');
  
  if (highSeverity.length > 0) {
    lines.push('#### 🔴 重要な変更\n');
    highSeverity.forEach(diff => {
      lines.push(formatElementDiff(diff));
    });
  }
  
  if (mediumSeverity.length > 0) {
    lines.push('\n#### 🟡 中程度の変更\n');
    mediumSeverity.forEach(diff => {
      lines.push(formatElementDiff(diff));
    });
  }
  
  if (lowSeverity.length > 0) {
    lines.push('\n#### 🟢 軽微な変更\n');
    lowSeverity.slice(0, 5).forEach(diff => {
      lines.push(formatElementDiff(diff));
    });
    if (lowSeverity.length > 5) {
      lines.push(`\n...他${lowSeverity.length - 5}件の軽微な変更`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Format a single element diff for display
 */
function formatElementDiff(diff: ElementDiff): string {
  const lines: string[] = [];
  
  // Header with selector and DOM path
  lines.push(`**セレクタ:** \`${diff.selector}\``);
  lines.push(`**DOMパス:** \`${diff.domPath}\``);
  
  // Semantic information
  if (diff.semanticInfo) {
    const { componentName, previousText, currentText, previousAriaLabel, currentAriaLabel } = diff.semanticInfo;
    
    if (componentName) {
      lines.push(`**コンポーネント:** ${componentName}`);
    }
    
    if (previousText !== currentText) {
      lines.push(`**テキスト変更:** "${previousText || '(空)'}" → "${currentText || '(空)'}"`);
    }
    
    if (previousAriaLabel !== currentAriaLabel) {
      lines.push(`**aria-label変更:** "${previousAriaLabel || '(なし)'}" → "${currentAriaLabel || '(なし)'}"`);
    }
  }
  
  // Position changes
  if (diff.positionChange) {
    const { deltaX, deltaY } = diff.positionChange;
    lines.push(`**位置変更:** Δx=${deltaX.toFixed(1)}px, Δy=${deltaY.toFixed(1)}px`);
  }
  
  // Size changes
  if (diff.sizeChange) {
    const { deltaWidth, deltaHeight } = diff.sizeChange;
    lines.push(`**サイズ変更:** Δw=${deltaWidth.toFixed(1)}px, Δh=${deltaHeight.toFixed(1)}px`);
  }
  
  // Style changes
  if (diff.styleChanges && diff.styleChanges.length > 0) {
    lines.push('**スタイル変更:**');
    diff.styleChanges.slice(0, 3).forEach(change => {
      lines.push(`  - \`${change.property}: ${change.previousValue} → ${change.currentValue}\``);
    });
    if (diff.styleChanges.length > 3) {
      lines.push(`  - ...他${diff.styleChanges.length - 3}件`);
    }
  }
  
  // Class changes
  if (diff.classChanges) {
    if (diff.classChanges.added.length > 0) {
      lines.push(`**追加されたクラス:** ${diff.classChanges.added.map(c => `\`.${c}\``).join(', ')}`);
    }
    if (diff.classChanges.removed.length > 0) {
      lines.push(`**削除されたクラス:** ${diff.classChanges.removed.map(c => `\`.${c}\``).join(', ')}`);
    }
  }
  
  lines.push(''); // Empty line between entries
  
  return lines.join('\n');
}