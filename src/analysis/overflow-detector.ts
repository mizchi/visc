/**
 * Overflow and scroll detection utilities
 * Detects internal scrollable areas and fixed dimensions
 */

import type { VisualNode, VisualTreeAnalysis } from "../types.js";

export interface ScrollableElement {
  node: VisualNode;
  type: 'vertical' | 'horizontal' | 'both';
  scrollDimensions: {
    scrollWidth: number;
    scrollHeight: number;
    clientWidth: number;
    clientHeight: number;
    hasVerticalScroll: boolean;
    hasHorizontalScroll: boolean;
    verticalScrollRatio: number;
    horizontalScrollRatio: number;
  };
  cssDefinition: {
    overflow: string;
    overflowX: string;
    overflowY: string;
    hasFixedWidth: boolean;
    hasFixedHeight: boolean;
    widthValue: string;
    heightValue: string;
  };
  semantics: {
    isDataTable: boolean;
    isCodeBlock: boolean;
    isCarousel: boolean;
    isModal: boolean;
    isDropdown: boolean;
  };
}

export interface FixedDimensionElement {
  node: VisualNode;
  dimensions: {
    width: string;
    height: string;
    hasFixedWidth: boolean;
    hasFixedHeight: boolean;
    isPixelBased: boolean;
    isViewportBased: boolean;
    isPercentageBased: boolean;
  };
  constraints: {
    minWidth?: string;
    minHeight?: string;
    maxWidth?: string;
    maxHeight?: string;
    hasMinConstraints: boolean;
    hasMaxConstraints: boolean;
  };
  flexibility: 'fixed' | 'semi-fixed' | 'flexible';
}

/**
 * Detect all scrollable elements in the layout
 */
export function detectScrollableElements(analysis: VisualTreeAnalysis): ScrollableElement[] {
  const scrollableElements: ScrollableElement[] = [];
  
  for (const element of analysis.elements) {
    if (element.isScrollable && element.scrollDimensions) {
      const hasVerticalScroll = element.scrollDimensions.scrollHeight > element.scrollDimensions.clientHeight;
      const hasHorizontalScroll = element.scrollDimensions.scrollWidth > element.scrollDimensions.clientWidth;
      
      let scrollType: 'vertical' | 'horizontal' | 'both';
      if (hasVerticalScroll && hasHorizontalScroll) {
        scrollType = 'both';
      } else if (hasVerticalScroll) {
        scrollType = 'vertical';
      } else {
        scrollType = 'horizontal';
      }
      
      const scrollable: ScrollableElement = {
        node: element,
        type: scrollType,
        scrollDimensions: {
          ...element.scrollDimensions,
          hasVerticalScroll,
          hasHorizontalScroll,
          verticalScrollRatio: hasVerticalScroll 
            ? element.scrollDimensions.clientHeight / element.scrollDimensions.scrollHeight 
            : 1,
          horizontalScrollRatio: hasHorizontalScroll 
            ? element.scrollDimensions.clientWidth / element.scrollDimensions.scrollWidth 
            : 1,
        },
        cssDefinition: {
          overflow: element.computedStyle?.overflow || 'visible',
          overflowX: element.computedStyle?.overflowX || 'visible',
          overflowY: element.computedStyle?.overflowY || 'visible',
          hasFixedWidth: element.hasFixedDimensions?.width || false,
          hasFixedHeight: element.hasFixedDimensions?.height || false,
          widthValue: element.boxModel?.width || 'auto',
          heightValue: element.boxModel?.height || 'auto',
        },
        semantics: detectScrollableSemantics(element),
      };
      
      scrollableElements.push(scrollable);
    }
  }
  
  return scrollableElements;
}

/**
 * Detect fixed dimension elements
 */
export function detectFixedDimensionElements(analysis: VisualTreeAnalysis): FixedDimensionElement[] {
  const fixedElements: FixedDimensionElement[] = [];
  
  for (const element of analysis.elements) {
    if (!element.boxModel) continue;
    
    const hasFixedWidth = element.hasFixedDimensions?.width || false;
    const hasFixedHeight = element.hasFixedDimensions?.height || false;
    
    // Skip elements without any fixed dimensions
    if (!hasFixedWidth && !hasFixedHeight) continue;
    
    const dimensions = analyzeDimensions(element.boxModel);
    const constraints = analyzeConstraints(element.boxModel);
    
    const fixedElement: FixedDimensionElement = {
      node: element,
      dimensions: {
        width: element.boxModel.width,
        height: element.boxModel.height,
        hasFixedWidth: Boolean(hasFixedWidth),
        hasFixedHeight: Boolean(hasFixedHeight),
        isPixelBased: dimensions.isPixelBased,
        isViewportBased: dimensions.isViewportBased,
        isPercentageBased: dimensions.isPercentageBased,
      },
      constraints: {
        minWidth: element.boxModel.minWidth,
        minHeight: element.boxModel.minHeight,
        maxWidth: element.boxModel.maxWidth,
        maxHeight: element.boxModel.maxHeight,
        hasMinConstraints: constraints.hasMinConstraints,
        hasMaxConstraints: constraints.hasMaxConstraints,
      },
      flexibility: determineFlexibility(hasFixedWidth, hasFixedHeight, constraints),
    };
    
    fixedElements.push(fixedElement);
  }
  
  return fixedElements;
}

/**
 * Detect semantic meaning of scrollable elements
 */
function detectScrollableSemantics(element: VisualNode): ScrollableElement['semantics'] {
  const tagName = element.tagName?.toLowerCase() || '';
  const className = element.className?.toLowerCase() || '';
  const role = element.role?.toLowerCase() || '';
  
  return {
    isDataTable: tagName === 'table' || 
                 className.includes('table') || 
                 role === 'table',
    
    isCodeBlock: tagName === 'pre' || 
                 tagName === 'code' || 
                 className.includes('code') ||
                 className.includes('highlight'),
    
    isCarousel: className.includes('carousel') || 
                className.includes('slider') ||
                className.includes('swiper') ||
                role === 'slider',
    
    isModal: className.includes('modal') || 
             className.includes('dialog') ||
             role === 'dialog',
    
    isDropdown: className.includes('dropdown') || 
                className.includes('select') ||
                className.includes('menu') ||
                role === 'listbox',
  };
}

/**
 * Analyze dimension values
 */
function analyzeDimensions(boxModel: VisualNode['boxModel']) {
  if (!boxModel) {
    return {
      isPixelBased: false,
      isViewportBased: false,
      isPercentageBased: false,
    };
  }
  
  const width = boxModel.width || '';
  const height = boxModel.height || '';
  const combined = width + height;
  
  return {
    isPixelBased: combined.includes('px'),
    isViewportBased: combined.includes('vw') || combined.includes('vh') || 
                     combined.includes('vmin') || combined.includes('vmax'),
    isPercentageBased: combined.includes('%'),
  };
}

/**
 * Analyze constraints
 */
function analyzeConstraints(boxModel: VisualNode['boxModel']) {
  if (!boxModel) {
    return {
      hasMinConstraints: false,
      hasMaxConstraints: false,
    };
  }
  
  const hasMinConstraints = Boolean(
    (boxModel.minWidth && boxModel.minWidth !== 'none' && boxModel.minWidth !== '0px') ||
    (boxModel.minHeight && boxModel.minHeight !== 'none' && boxModel.minHeight !== '0px')
  );
  
  const hasMaxConstraints = Boolean(
    (boxModel.maxWidth && boxModel.maxWidth !== 'none') ||
    (boxModel.maxHeight && boxModel.maxHeight !== 'none')
  );
  
  return {
    hasMinConstraints,
    hasMaxConstraints,
  };
}

/**
 * Determine flexibility level
 */
function determineFlexibility(
  hasFixedWidth: boolean,
  hasFixedHeight: boolean,
  constraints: { hasMinConstraints: boolean; hasMaxConstraints: boolean }
): 'fixed' | 'semi-fixed' | 'flexible' {
  if (hasFixedWidth && hasFixedHeight) {
    return 'fixed';
  }
  
  if ((hasFixedWidth || hasFixedHeight) || 
      (constraints.hasMinConstraints && constraints.hasMaxConstraints)) {
    return 'semi-fixed';
  }
  
  return 'flexible';
}

/**
 * Analyze overflow patterns
 */
export function analyzeOverflowPatterns(analysis: VisualTreeAnalysis) {
  const scrollableElements = detectScrollableElements(analysis);
  const fixedElements = detectFixedDimensionElements(analysis);
  
  return {
    scrollableElements,
    fixedElements,
    statistics: {
      totalScrollable: scrollableElements.length,
      verticalScrollCount: scrollableElements.filter(e => e.type === 'vertical').length,
      horizontalScrollCount: scrollableElements.filter(e => e.type === 'horizontal').length,
      bothScrollCount: scrollableElements.filter(e => e.type === 'both').length,
      fixedDimensionCount: fixedElements.length,
      fullyFixedCount: fixedElements.filter(e => e.flexibility === 'fixed').length,
      semiFixedCount: fixedElements.filter(e => e.flexibility === 'semi-fixed').length,
    },
    patterns: {
      hasDataTables: scrollableElements.some(e => e.semantics.isDataTable),
      hasCodeBlocks: scrollableElements.some(e => e.semantics.isCodeBlock),
      hasCarousels: scrollableElements.some(e => e.semantics.isCarousel),
      hasModals: scrollableElements.some(e => e.semantics.isModal),
      hasDropdowns: scrollableElements.some(e => e.semantics.isDropdown),
    },
  };
}

/**
 * Get overflow change recommendations
 */
export function getOverflowRecommendations(
  scrollable: ScrollableElement
): string[] {
  const recommendations: string[] = [];
  
  // Check for hidden overflow that might hide content
  if (scrollable.cssDefinition.overflow === 'hidden') {
    recommendations.push('Hidden overflow may clip content - consider using auto or scroll');
  }
  
  // Check for unnecessary scrollbars
  if (scrollable.scrollDimensions.verticalScrollRatio > 0.95) {
    recommendations.push('Vertical scroll area is nearly visible - consider adjusting height');
  }
  
  if (scrollable.scrollDimensions.horizontalScrollRatio > 0.95) {
    recommendations.push('Horizontal scroll area is nearly visible - consider adjusting width');
  }
  
  // Check for fixed dimensions on responsive elements
  if (scrollable.cssDefinition.hasFixedWidth && !scrollable.semantics.isDataTable) {
    recommendations.push('Fixed width on scrollable element may cause responsive issues');
  }
  
  // Check for missing scroll indicators
  if (scrollable.type === 'horizontal' && !scrollable.semantics.isCarousel) {
    recommendations.push('Horizontal scroll without carousel semantics - users may not notice scrollable content');
  }
  
  return recommendations;
}