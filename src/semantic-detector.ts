import type { 
  VisualDifference, 
  SemanticDifferenceDetection, 
  SemanticDifferenceMessage,
  VisualTreeAnalysis 
} from './types.js';

/**
 * Detects semantic differences from visual differences
 */
export function detectSemanticDifferences(
  differences: VisualDifference[],
  currentAnalysis: VisualTreeAnalysis,
  previousAnalysis?: VisualTreeAnalysis
): SemanticDifferenceDetection {
  const patterns: string[] = [];
  
  // Detect position shifts (even 1px matters)
  const positionShifts = differences.filter(d => 
    d.type === 'moved' || 
    (d.positionDiff && d.positionDiff > 0)
  );
  
  const hasPositionShifts = positionShifts.length > 0;
  
  if (hasPositionShifts) {
    // Analyze shift magnitude
    const shiftMagnitudes = positionShifts
      .map(d => d.positionDiff || 0)
      .filter(m => m > 0);
    
    const has1pxShift = shiftMagnitudes.some(m => m === 1);
    const hasSmallShift = shiftMagnitudes.some(m => m > 1 && m <= 5);
    const hasLargeShift = shiftMagnitudes.some(m => m > 5);
    
    if (has1pxShift) patterns.push('1px微細シフト検出');
    if (hasSmallShift) patterns.push('小規模位置ずれ(2-5px)');
    if (hasLargeShift) patterns.push('大規模位置ずれ(>5px)');
  }
  
  // Detect z-index/stacking changes
  const hasZIndexChanges = differences.some(d => {
    if (d.changes) {
      return d.changes.some(c => 
        c.property === 'zIndex' || 
        c.property === 'position' ||
        c.property === 'transform' ||
        c.property === 'opacity'
      );
    }
    return false;
  });
  
  if (hasZIndexChanges) {
    patterns.push('重なり順序の変更');
  }
  
  // Detect overflow issues
  const scrollableElements = currentAnalysis.elements.filter(e => e.isScrollable).length;
  const fixedDimensionElements = currentAnalysis.elements.filter(e => 
    e.hasFixedDimensions?.width && e.hasFixedDimensions?.height
  ).length;
  
  const hasOverflowIssues = scrollableElements > 0 || 
    currentAnalysis.elements.some(e => e.hasOverflow);
  
  if (hasOverflowIssues) {
    if (scrollableElements > 0) {
      patterns.push(`スクロール要素検出(${scrollableElements}個)`);
    }
    if (fixedDimensionElements > 0) {
      patterns.push('固定サイズ要素による潜在的オーバーフロー');
    }
  }
  
  // Detect layout shifts
  const addedElements = differences.filter(d => d.type === 'added').length;
  const removedElements = differences.filter(d => d.type === 'removed').length;
  const modifiedElements = differences.filter(d => d.type === 'modified').length;
  
  const hasLayoutShifts = addedElements > 0 || 
    removedElements > 0 || 
    modifiedElements > 3; // More than 3 modifications indicates layout shift
  
  if (hasLayoutShifts) {
    if (addedElements > 0) patterns.push(`要素追加(${addedElements}個)`);
    if (removedElements > 0) patterns.push(`要素削除(${removedElements}個)`);
    if (modifiedElements > 3) patterns.push('大規模レイアウト変更');
  }
  
  return {
    hasPositionShifts,
    hasZIndexChanges,
    hasOverflowIssues,
    hasLayoutShifts,
    detectedPatterns: patterns
  };
}

/**
 * Generates semantic message from detection results
 */
export function generateSemanticMessage(
  detection: SemanticDifferenceDetection,
  similarity: number = 100
): SemanticDifferenceMessage {
  const messages: string[] = [];
  
  if (detection.hasPositionShifts) {
    messages.push('⚠️ 位置ずれを検出しました');
  }
  
  if (detection.hasZIndexChanges) {
    messages.push('🔄 要素の重なり順序が変更されています');
  }
  
  if (detection.hasOverflowIssues) {
    messages.push('📜 スクロール/オーバーフロー問題の可能性');
  }
  
  if (detection.hasLayoutShifts) {
    messages.push('🏗️ レイアウト構造に変更があります');
  }
  
  // Determine severity based on similarity score
  let severity: SemanticDifferenceMessage['severity'];
  if (similarity >= 98) severity = 'minimal';
  else if (similarity >= 95) severity = 'low';
  else if (similarity >= 90) severity = 'medium';
  else if (similarity >= 80) severity = 'high';
  else severity = 'critical';
  
  if (messages.length === 0) {
    messages.push('✅ 重要な視覚的変更は検出されませんでした');
  }
  
  return {
    severity,
    messages,
    patterns: detection.detectedPatterns
  };
}

/**
 * Calculates position difference between two elements
 */
export function calculatePositionDiff(
  element1: { rect: { x: number; y: number } },
  element2: { rect: { x: number; y: number } }
): number {
  const dx = Math.abs(element1.rect.x - element2.rect.x);
  const dy = Math.abs(element1.rect.y - element2.rect.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates size difference between two elements
 */
export function calculateSizeDiff(
  element1: { rect: { width: number; height: number } },
  element2: { rect: { width: number; height: number } }
): number {
  const dw = Math.abs(element1.rect.width - element2.rect.width);
  const dh = Math.abs(element1.rect.height - element2.rect.height);
  return Math.sqrt(dw * dw + dh * dh);
}

/**
 * Analyzes subtle visual differences
 */
export function analyzeSubtleDifferences(
  differences: VisualDifference[]
): {
  has1pxShift: boolean;
  hasSubpixelRendering: boolean;
  hasFloatCollapse: boolean;
  hasMarginCollapse: boolean;
} {
  const has1pxShift = differences.some(d => 
    d.positionDiff === 1
  );
  
  const hasSubpixelRendering = differences.some(d => 
    d.positionDiff && d.positionDiff > 0 && d.positionDiff < 1
  );
  
  // Detect float collapse by looking for parent height changes
  const hasFloatCollapse = differences.some(d => {
    if (d.type === 'modified' && d.changes) {
      const heightChange = d.changes.find(c => c.property === 'height');
      if (heightChange && typeof heightChange.before === 'number' && typeof heightChange.after === 'number') {
        // Parent collapsed if height decreased significantly
        return heightChange.after < heightChange.before * 0.5;
      }
    }
    return false;
  });
  
  // Detect margin collapse by looking for unexpected position changes
  const hasMarginCollapse = differences.some(d => {
    if (d.type === 'moved' && d.changes) {
      const topChange = d.changes.find(c => c.property === 'top' || c.property === 'y');
      if (topChange && typeof topChange.before === 'number' && typeof topChange.after === 'number') {
        // Margin might have collapsed if position changed without explicit position change
        const unexpectedShift = Math.abs(topChange.after - topChange.before) > 10;
        return unexpectedShift;
      }
    }
    return false;
  });
  
  return {
    has1pxShift,
    hasSubpixelRendering,
    hasFloatCollapse,
    hasMarginCollapse
  };
}