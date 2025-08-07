/**
 * Slide presentation detector and validator
 * Detects and validates slide-like content with fixed dimensions and no overflow
 */

import type { VisualTreeAnalysis, VisualNode, VisualNodeGroup } from "../types.js";
import { detectScrollableElements, detectFixedDimensionElements } from "./overflow-detector.js";

// Constants
const DIMENSION_TOLERANCE = 1;
const DIMENSION_MATCH_TOLERANCE = 10;
const ASPECT_RATIO_TOLERANCE = 0.01;
const SLIDE_CONFIDENCE_THRESHOLD = 70;
const CENTERED_CONTENT_THRESHOLD = 0.3;
const PAGE_AREA_THRESHOLD = 0.8;
const CONTENT_AREA_THRESHOLD = 100;

// Confidence score weights
const CONFIDENCE_WEIGHTS = {
  FIXED_DIMENSIONS: 30,
  NO_OVERFLOW: 25,
  CONTENT_FITS: 20,
  SLIDE_PATTERNS: 15,
  MATCHED_CONFIG: 10,
} as const;

export interface SlideConfiguration {
  width: number;
  height: number;
  aspectRatio?: number;
  allowedOverflow?: boolean;
  maxContentDepth?: number;
}

export interface SlideDetectionResult {
  isSlide: boolean;
  confidence: number;
  dimensions: {
    width: number;
    height: number;
    aspectRatio: number;
  };
  violations: SlideViolation[];
  metadata: {
    hasFixedDimensions: boolean;
    hasOverflow: boolean;
    contentFitsWithinBounds: boolean;
    followsSlidePatterns: boolean;
    slideType?: 'presentation' | 'document' | 'canvas' | 'hybrid';
  };
  recommendations: string[];
}

export interface SlideViolation {
  type: 'overflow' | 'dimensions' | 'content-overflow' | 'aspect-ratio' | 'nested-scroll' | 'responsive-element';
  severity: 'error' | 'warning' | 'info';
  element?: VisualNode;
  message: string;
  details?: any;
}

// Common slide dimensions and aspect ratios
const COMMON_SLIDE_CONFIGS: SlideConfiguration[] = [
  { width: 1920, height: 1080, aspectRatio: 16/9 },  // Full HD (16:9)
  { width: 1280, height: 720, aspectRatio: 16/9 },   // HD (16:9)
  { width: 1200, height: 800, aspectRatio: 3/2 },    // Custom (3:2)
  { width: 1024, height: 768, aspectRatio: 4/3 },    // XGA (4:3)
  { width: 800, height: 600, aspectRatio: 4/3 },     // SVGA (4:3)
  { width: 1920, height: 1200, aspectRatio: 16/10 }, // WUXGA (16:10)
  { width: 1680, height: 1050, aspectRatio: 16/10 }, // WSXGA+ (16:10)
];

/**
 * Detect if the content is a slide presentation
 */
export function detectSlide(
  analysis: VisualTreeAnalysis,
  config?: Partial<SlideConfiguration>
): SlideDetectionResult {
  const violations: SlideViolation[] = [];
  const recommendations: string[] = [];
  
  // Detect actual dimensions
  const actualDimensions = detectActualDimensions(analysis);
  
  // Check if dimensions match common slide sizes
  const matchedConfig = findMatchingSlideConfig(actualDimensions, config);
  
  // Check for fixed dimensions
  const hasFixedDimensions = checkFixedDimensions(analysis, violations);
  
  // Check for overflow
  const hasOverflow = checkForOverflow(analysis, violations, config?.allowedOverflow);
  
  // Check if content fits within bounds
  const contentFitsWithinBounds = checkContentBounds(analysis, actualDimensions, violations);
  
  // Check for slide-like patterns
  const followsSlidePatterns = checkSlidePatterns(analysis, violations);
  
  // Detect slide type
  const slideType = detectSlideType(analysis);
  
  // Calculate confidence score
  const confidence = calculateConfidence({
    hasFixedDimensions,
    hasOverflow,
    contentFitsWithinBounds,
    followsSlidePatterns,
    matchedConfig: matchedConfig !== null,
  });
  
  // Generate recommendations
  if (!hasFixedDimensions) {
    recommendations.push('Use fixed pixel dimensions for consistent slide rendering');
  }
  if (hasOverflow) {
    recommendations.push('Remove overflow to ensure all content is visible');
  }
  if (!contentFitsWithinBounds) {
    recommendations.push('Ensure all content fits within slide boundaries');
  }
  if (!matchedConfig && config) {
    recommendations.push(`Consider using standard slide dimensions like ${config.width}x${config.height}`);
  }
  
  return {
    isSlide: confidence > SLIDE_CONFIDENCE_THRESHOLD,
    confidence,
    dimensions: actualDimensions,
    violations,
    metadata: {
      hasFixedDimensions,
      hasOverflow,
      contentFitsWithinBounds,
      followsSlidePatterns,
      slideType,
    },
    recommendations,
  };
}

/**
 * Helper function to validate a single dimension
 */
function validateDimension(
  actual: number,
  expected: number,
  dimensionName: 'width' | 'height',
  violations: SlideViolation[]
): void {
  if (Math.abs(actual - expected) > DIMENSION_TOLERANCE) {
    violations.push({
      type: 'dimensions',
      severity: 'error',
      message: `${dimensionName.charAt(0).toUpperCase() + dimensionName.slice(1)} mismatch: expected ${expected}px, got ${actual}px`,
      details: { expected, actual },
    });
  }
}

/**
 * Validate slide against specific configuration
 */
export function validateSlide(
  analysis: VisualTreeAnalysis,
  config: SlideConfiguration
): SlideViolation[] {
  const violations: SlideViolation[] = [];
  
  // Check dimensions match
  const actualDimensions = detectActualDimensions(analysis);
  
  // Check dimension matches
  validateDimension(actualDimensions.width, config.width, 'width', violations);
  validateDimension(actualDimensions.height, config.height, 'height', violations)
  
  // Check aspect ratio if specified
  if (config.aspectRatio) {
    const actualRatio = actualDimensions.aspectRatio;
    const expectedRatio = config.aspectRatio;
    const ratioDiff = Math.abs(actualRatio - expectedRatio);
    
    if (ratioDiff > ASPECT_RATIO_TOLERANCE) {
      violations.push({
        type: 'aspect-ratio',
        severity: 'warning',
        message: `Aspect ratio mismatch: expected ${expectedRatio.toFixed(2)}, got ${actualRatio.toFixed(2)}`,
        details: { expected: expectedRatio, actual: actualRatio },
      });
    }
  }
  
  // Check for overflow
  if (!config.allowedOverflow) {
    checkForOverflow(analysis, violations, false);
  }
  
  // Check content bounds
  checkContentBounds(analysis, actualDimensions, violations);
  
  // Check for responsive elements that might break in fixed dimensions
  checkResponsiveElements(analysis, violations);
  
  return violations;
}

/**
 * Detect actual dimensions of the slide
 */
function detectActualDimensions(analysis: VisualTreeAnalysis): SlideDetectionResult['dimensions'] {
  // First, check viewport dimensions
  const viewport = analysis.viewport;
  
  // Find the main container (usually the largest element)
  let mainContainer: VisualNode | null = null;
  let maxArea = 0;
  
  for (const element of analysis.elements) {
    const area = element.rect.width * element.rect.height;
    
    // Look for elements that could be slide containers
    if (area > maxArea && isLikelySlideContainer(element)) {
      maxArea = area;
      mainContainer = element;
    }
  }
  
  // Use main container dimensions if found, otherwise use viewport
  const width = mainContainer?.rect.width || viewport.width;
  const height = mainContainer?.rect.height || viewport.height;
  
  return {
    width,
    height,
    aspectRatio: width / height,
  };
}

/**
 * Check if element is likely a slide container
 */
function isLikelySlideContainer(element: VisualNode): boolean {
  // Check for slide-related classes or IDs
  const className = element.className?.toLowerCase() || '';
  const id = element.id?.toLowerCase() || '';
  
  const slideKeywords = ['slide', 'presentation', 'canvas', 'stage', 'viewport', 'container', 'wrapper'];
  
  for (const keyword of slideKeywords) {
    if (className.includes(keyword) || id.includes(keyword)) {
      return true;
    }
  }
  
  // Check for fixed dimensions
  if (element.hasFixedDimensions?.width && element.hasFixedDimensions?.height) {
    return true;
  }
  
  // Check if it's a main container element
  if (element.tagName?.toLowerCase() === 'main' || element.role === 'main') {
    return true;
  }
  
  return false;
}

/**
 * Check if dimensions match within tolerance
 */
function isDimensionMatch(actual: number, expected: number, tolerance: number = DIMENSION_MATCH_TOLERANCE): boolean {
  return Math.abs(actual - expected) < tolerance;
}

/**
 * Find matching slide configuration
 */
function findMatchingSlideConfig(
  dimensions: SlideDetectionResult['dimensions'],
  customConfig?: Partial<SlideConfiguration>
): SlideConfiguration | null {
  // Check custom config first
  if (customConfig?.width && customConfig?.height) {
    const widthMatch = isDimensionMatch(dimensions.width, customConfig.width);
    const heightMatch = isDimensionMatch(dimensions.height, customConfig.height);
    
    if (widthMatch && heightMatch) {
      return {
        width: customConfig.width,
        height: customConfig.height,
        aspectRatio: customConfig.aspectRatio || customConfig.width / customConfig.height,
        allowedOverflow: customConfig.allowedOverflow,
        maxContentDepth: customConfig.maxContentDepth,
      };
    }
  }
  
  // Check common configurations
  for (const config of COMMON_SLIDE_CONFIGS) {
    const widthMatch = isDimensionMatch(dimensions.width, config.width);
    const heightMatch = isDimensionMatch(dimensions.height, config.height);
    
    if (widthMatch && heightMatch) {
      return config;
    }
  }
  
  return null;
}

/**
 * Check for fixed dimensions
 */
function checkFixedDimensions(
  analysis: VisualTreeAnalysis,
  violations: SlideViolation[]
): boolean {
  const fixedElements = detectFixedDimensionElements(analysis);
  
  // Find the main container
  const mainContainer = fixedElements.find(el => 
    isLikelySlideContainer(el.node) && 
    el.dimensions.hasFixedWidth && 
    el.dimensions.hasFixedHeight
  );
  
  if (!mainContainer) {
    violations.push({
      type: 'dimensions',
      severity: 'warning',
      message: 'No fixed-dimension container found for slide',
    });
    return false;
  }
  
  // Check if dimensions are pixel-based (not percentage or viewport)
  if (!mainContainer.dimensions.isPixelBased) {
    violations.push({
      type: 'dimensions',
      severity: 'warning',
      message: 'Slide dimensions should be pixel-based for consistency',
      details: {
        width: mainContainer.dimensions.width,
        height: mainContainer.dimensions.height,
      },
    });
  }
  
  return true;
}

/**
 * Check for overflow
 */
function checkForOverflow(
  analysis: VisualTreeAnalysis,
  violations: SlideViolation[],
  allowedOverflow?: boolean
): boolean {
  const scrollableElements = detectScrollableElements(analysis);
  
  if (scrollableElements.length > 0 && !allowedOverflow) {
    for (const scrollable of scrollableElements) {
      violations.push({
        type: 'overflow',
        severity: 'error',
        element: scrollable.node,
        message: `Overflow detected: ${scrollable.type} scroll in ${scrollable.node.tagName || 'element'}`,
        details: {
          scrollType: scrollable.type,
          scrollDimensions: scrollable.scrollDimensions,
        },
      });
      
      // Check for nested scrollable areas (particularly bad for slides)
      if (scrollable.semantics.isModal || scrollable.semantics.isDropdown) {
        violations.push({
          type: 'nested-scroll',
          severity: 'error',
          element: scrollable.node,
          message: 'Nested scrollable areas are not suitable for slides',
        });
      }
    }
    return true;
  }
  
  return false;
}

/**
 * Check if content fits within bounds
 */
function checkContentBounds(
  analysis: VisualTreeAnalysis,
  dimensions: SlideDetectionResult['dimensions'],
  violations: SlideViolation[]
): boolean {
  let allContentFits = true;
  
  for (const element of analysis.elements) {
    const rect = element.rect;
    
    // Check if element extends beyond slide boundaries
    if (rect.x < 0 || rect.y < 0) {
      violations.push({
        type: 'content-overflow',
        severity: 'error',
        element,
        message: `Content positioned outside slide bounds (negative position)`,
        details: { x: rect.x, y: rect.y },
      });
      allContentFits = false;
    }
    
    if (rect.right > dimensions.width || rect.bottom > dimensions.height) {
      violations.push({
        type: 'content-overflow',
        severity: 'error',
        element,
        message: `Content extends beyond slide boundaries`,
        details: {
          right: rect.right,
          bottom: rect.bottom,
          slideWidth: dimensions.width,
          slideHeight: dimensions.height,
        },
      });
      allContentFits = false;
    }
    
    // Check for elements with overflow visible that might cause issues
    if (element.computedStyle?.overflow === 'visible' && element.hasOverflow) {
      violations.push({
        type: 'content-overflow',
        severity: 'warning',
        element,
        message: 'Element has visible overflow which may extend beyond slide',
      });
    }
  }
  
  return allContentFits;
}

/**
 * Check for slide-like patterns
 */
function checkSlidePatterns(
  analysis: VisualTreeAnalysis,
  violations: SlideViolation[]
): boolean {
  let hasSlidePatterns = false;
  
  // Check for common slide elements
  const slideElements = ['header', 'footer', 'h1', 'h2', 'h3', 'ul', 'ol', 'figure', 'blockquote'];
  const foundElements = new Set<string>();
  
  for (const element of analysis.elements) {
    const tagName = element.tagName?.toLowerCase();
    if (tagName && slideElements.includes(tagName)) {
      foundElements.add(tagName);
    }
  }
  
  // Slides typically have headers and content elements
  if (foundElements.has('h1') || foundElements.has('h2')) {
    hasSlidePatterns = true;
  }
  
  // Check for presentation-specific attributes
  for (const element of analysis.elements) {
    const className = element.className?.toLowerCase() || '';
    const role = element.role?.toLowerCase() || '';
    
    if (className.includes('slide') || 
        className.includes('presentation') ||
        role === 'presentation' ||
        role === 'document') {
      hasSlidePatterns = true;
      break;
    }
  }
  
  // Check layout patterns (centered content is common in slides)
  const centeredElements = analysis.elements.filter(el => {
    const style = el.computedStyle;
    return style && (
      style['text-align'] === 'center' ||
      style['margin'] === '0 auto' ||
      style['display'] === 'flex' && style['justify-content'] === 'center'
    );
  });
  
  if (centeredElements.length > analysis.elements.length * CENTERED_CONTENT_THRESHOLD) {
    hasSlidePatterns = true;
  }
  
  return hasSlidePatterns;
}

/**
 * Check for responsive elements that might break
 */
function checkResponsiveElements(
  analysis: VisualTreeAnalysis,
  violations: SlideViolation[]
): void {
  for (const element of analysis.elements) {
    // Check for percentage-based dimensions
    if (element.boxModel) {
      const width = element.boxModel.width;
      const height = element.boxModel.height;
      
      if (width.includes('%') || height.includes('%')) {
        violations.push({
          type: 'responsive-element',
          severity: 'warning',
          element,
          message: 'Element uses percentage-based dimensions which may cause inconsistency',
          details: { width, height },
        });
      }
      
      // Check for viewport units
      if (width.includes('vw') || width.includes('vh') ||
          height.includes('vw') || height.includes('vh')) {
        violations.push({
          type: 'responsive-element',
          severity: 'warning',
          element,
          message: 'Element uses viewport units which may cause inconsistency across different displays',
          details: { width, height },
        });
      }
    }
    
    // Check for media queries (indicated by responsive behavior)
    if (element.computedStyle?.['@media']) {
      violations.push({
        type: 'responsive-element',
        severity: 'info',
        element,
        message: 'Element may have media query styles that affect slide consistency',
      });
    }
  }
}

/**
 * Detect the type of slide
 */
function detectSlideType(analysis: VisualTreeAnalysis): SlideDetectionResult['metadata']['slideType'] {
  // Check for canvas elements (drawing/diagram slides)
  const hasCanvas = analysis.elements.some(el => 
    el.tagName?.toLowerCase() === 'canvas' ||
    el.tagName?.toLowerCase() === 'svg'
  );
  
  // Check for code blocks (technical presentations)
  const hasCode = analysis.elements.some(el => 
    el.tagName?.toLowerCase() === 'pre' ||
    el.tagName?.toLowerCase() === 'code' ||
    el.className?.includes('highlight') ||
    el.className?.includes('code')
  );
  
  // Check for images/media (visual presentations)
  const hasMedia = analysis.elements.some(el => 
    el.tagName?.toLowerCase() === 'img' ||
    el.tagName?.toLowerCase() === 'video' ||
    el.tagName?.toLowerCase() === 'iframe'
  );
  
  // Check for tables/charts (data presentations)
  const hasData = analysis.elements.some(el => 
    el.tagName?.toLowerCase() === 'table' ||
    el.className?.includes('chart') ||
    el.className?.includes('graph')
  );
  
  // Determine type based on content
  if (hasCanvas && !hasCode) {
    return 'canvas';
  } else if (hasCode && hasData) {
    return 'hybrid';
  } else if (hasMedia || hasData) {
    return 'presentation';
  } else {
    return 'document';
  }
}

/**
 * Calculate confidence score
 */
function calculateConfidence(factors: {
  hasFixedDimensions: boolean;
  hasOverflow: boolean;
  contentFitsWithinBounds: boolean;
  followsSlidePatterns: boolean;
  matchedConfig: boolean;
}): number {
  let score = 0;
  
  if (factors.hasFixedDimensions) score += CONFIDENCE_WEIGHTS.FIXED_DIMENSIONS;
  if (!factors.hasOverflow) score += CONFIDENCE_WEIGHTS.NO_OVERFLOW;
  if (factors.contentFitsWithinBounds) score += CONFIDENCE_WEIGHTS.CONTENT_FITS;
  if (factors.followsSlidePatterns) score += CONFIDENCE_WEIGHTS.SLIDE_PATTERNS;
  if (factors.matchedConfig) score += CONFIDENCE_WEIGHTS.MATCHED_CONFIG;
  
  return Math.min(100, score);
}

/**
 * Get slide validation rules
 */
export function getSlideValidationRules(strict: boolean = true): SlideConfiguration {
  if (strict) {
    return {
      width: 1920,
      height: 1080,
      aspectRatio: 16/9,
      allowedOverflow: false,
      maxContentDepth: 5,
    };
  } else {
    return {
      width: 1200,
      height: 800,
      aspectRatio: 3/2,
      allowedOverflow: true,
      maxContentDepth: 10,
    };
  }
}

/**
 * Generate slide optimization recommendations
 */
export function getSlideOptimizationRecommendations(
  result: SlideDetectionResult
): string[] {
  const recommendations: string[] = [...result.recommendations];
  
  // Add specific recommendations based on violations
  const overflowViolations = result.violations.filter(v => v.type === 'overflow');
  if (overflowViolations.length > 0) {
    recommendations.push('Consider paginating content or reducing font sizes to eliminate overflow');
  }
  
  const dimensionViolations = result.violations.filter(v => v.type === 'dimensions');
  if (dimensionViolations.length > 0) {
    recommendations.push('Set explicit width and height in pixels for the slide container');
  }
  
  const responsiveViolations = result.violations.filter(v => v.type === 'responsive-element');
  if (responsiveViolations.length > 0) {
    recommendations.push('Replace percentage and viewport units with fixed pixel values for consistent rendering');
  }
  
  // Add slide type specific recommendations
  if (result.metadata.slideType === 'canvas') {
    recommendations.push('Ensure canvas resolution matches slide dimensions for crisp rendering');
  } else if (result.metadata.slideType === 'presentation') {
    recommendations.push('Optimize images for the target resolution to reduce loading time');
  } else if (result.metadata.slideType === 'document') {
    recommendations.push('Consider using a consistent typography scale for better readability');
  }
  
  return recommendations;
}