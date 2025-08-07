/**
 * Movement visualization renderer for Visual Node Groups
 * Renders SVG showing the movement of matched groups with dashed lines
 */

import type { GroupCorrespondence } from '../layout/accessibility-matcher.js';
import type { VisualTreeAnalysis } from '../types.js';

export interface MovementRenderOptions {
  showLabels?: boolean;
  showDistances?: boolean;
  showSelectors?: boolean;
  highlightThreshold?: number; // Highlight movements above this distance
  colorScheme?: 'default' | 'severity' | 'direction';
  viewportMode?: 'viewportOnly' | 'full' | 'fullScroll'; // SVG rendering range
}

/**
 * Render movement visualization as SVG
 */
export function renderMovementToSvg(
  correspondences: GroupCorrespondence[],
  viewport: { width: number; height: number; scrollX?: number; scrollY?: number },
  options: MovementRenderOptions = {}
): string {
  const {
    showLabels = true,
    showDistances = true,
    showSelectors = false,
    highlightThreshold = 50,
    colorScheme = 'severity',
    viewportMode = 'viewportOnly'
  } = options;

  // Calculate SVG dimensions based on viewport mode
  const svgDimensions = calculateSvgDimensions(correspondences, viewport, viewportMode);
  const svgElements: string[] = [];
  
  // SVG header with calculated dimensions and viewBox for clipping
  if (viewportMode === 'viewportOnly') {
    // Use viewBox to clip content outside viewport
    svgElements.push(`<svg width="${viewport.width}" height="${viewport.height}" viewBox="0 0 ${viewport.width} ${viewport.height}" xmlns="http://www.w3.org/2000/svg" style="overflow: hidden;">`);
  } else {
    // For full and fullScroll modes, show everything
    svgElements.push(`<svg width="${svgDimensions.width}" height="${svgDimensions.height}" xmlns="http://www.w3.org/2000/svg">`);
  }
  
  // Add definitions for arrow markers and filters
  svgElements.push(`
    <defs>
      <!-- Arrow markers for movement direction -->
      <marker id="arrowhead-small" markerWidth="10" markerHeight="7" 
              refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
      </marker>
      <marker id="arrowhead-large" markerWidth="12" markerHeight="9" 
              refX="11" refY="4.5" orient="auto">
        <polygon points="0 0, 12 4.5, 0 9" fill="#d9534f" />
      </marker>
      
      <!-- Drop shadow filter -->
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
        <feOffset dx="2" dy="2" result="offsetblur"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="0.3"/>
        </feComponentTransfer>
        <feMerge> 
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/> 
        </feMerge>
      </filter>
    </defs>
  `);

  // Background layer for context
  svgElements.push(`<rect width="${svgDimensions.width}" height="${svgDimensions.height}" fill="white" opacity="0.95"/>`);

  // Render each correspondence
  correspondences.forEach((correspondence, index) => {
    const { group1, group2, match } = correspondence;
    
    // For viewportOnly mode, skip elements completely outside viewport
    if (viewportMode === 'viewportOnly') {
      const isGroup1Visible = isInViewport(group1.bounds, viewport);
      const isGroup2Visible = isInViewport(group2.bounds, viewport);
      
      // Skip if both positions are completely outside viewport
      if (!isGroup1Visible && !isGroup2Visible) {
        return;
      }
    }
    
    // Calculate movement vector
    const movement = calculateMovementVector(group1.bounds, group2.bounds);
    
    // Determine color based on movement distance and scheme
    const color = getMovementColor(movement.distance, colorScheme, movement.angle);
    const isSignificant = movement.distance > highlightThreshold;
    
    // Draw the original position (semi-transparent)
    svgElements.push(`
      <g class="original-position" opacity="0.4">
        <rect x="${group1.bounds.x}" y="${group1.bounds.y}" 
              width="${group1.bounds.width}" height="${group1.bounds.height}"
              fill="none" stroke="${color}" stroke-width="1" stroke-dasharray="5,3"/>
      </g>
    `);
    
    // Draw the new position
    svgElements.push(`
      <g class="new-position">
        <rect x="${group2.bounds.x}" y="${group2.bounds.y}" 
              width="${group2.bounds.width}" height="${group2.bounds.height}"
              fill="none" stroke="${color}" stroke-width="${isSignificant ? 2 : 1}"/>
      </g>
    `);
    
    // Draw movement lines from corners
    if (movement.distance > 5) { // Only show movement lines for significant movements
      // Connect corresponding corners with dashed lines
      const corners = [
        { name: 'top-left', x1: group1.bounds.x, y1: group1.bounds.y, 
          x2: group2.bounds.x, y2: group2.bounds.y },
        { name: 'top-right', x1: group1.bounds.x + group1.bounds.width, y1: group1.bounds.y,
          x2: group2.bounds.x + group2.bounds.width, y2: group2.bounds.y },
        { name: 'bottom-left', x1: group1.bounds.x, y1: group1.bounds.y + group1.bounds.height,
          x2: group2.bounds.x, y2: group2.bounds.y + group2.bounds.height },
        { name: 'bottom-right', x1: group1.bounds.x + group1.bounds.width, 
          y1: group1.bounds.y + group1.bounds.height,
          x2: group2.bounds.x + group2.bounds.width, 
          y2: group2.bounds.y + group2.bounds.height },
      ];
      
      corners.forEach((corner, cornerIndex) => {
        const opacity = 0.3 + (isSignificant ? 0.3 : 0);
        svgElements.push(`
          <line x1="${corner.x1}" y1="${corner.y1}" x2="${corner.x2}" y2="${corner.y2}"
                stroke="${color}" stroke-width="1" stroke-dasharray="3,3" 
                opacity="${opacity}" class="movement-line corner-${corner.name}"/>
        `);
      });
      
      // Draw center-to-center movement vector with arrow
      const centerMovement = {
        x1: group1.bounds.x + group1.bounds.width / 2,
        y1: group1.bounds.y + group1.bounds.height / 2,
        x2: group2.bounds.x + group2.bounds.width / 2,
        y2: group2.bounds.y + group2.bounds.height / 2,
      };
      
      const markerEnd = isSignificant ? 'url(#arrowhead-large)' : 'url(#arrowhead-small)';
      svgElements.push(`
        <line x1="${centerMovement.x1}" y1="${centerMovement.y1}" 
              x2="${centerMovement.x2}" y2="${centerMovement.y2}"
              stroke="${color}" stroke-width="${isSignificant ? 2 : 1.5}" 
              marker-end="${markerEnd}" opacity="0.8"
              class="movement-vector" filter="url(#shadow)"/>
      `);
    }
    
    // Add labels and annotations
    if (showLabels || showDistances || showSelectors) {
      const labelX = (group1.bounds.x + group2.bounds.x) / 2;
      const labelY = (group1.bounds.y + group2.bounds.y) / 2;
      
      svgElements.push(`<g class="annotations">`);
      
      // Background for text
      if (showLabels || showDistances) {
        const text = [];
        if (showLabels && group1.label) {
          text.push(group1.label);
        }
        if (showDistances && movement.distance > 5) {
          text.push(`${Math.round(movement.distance)}px`);
        }
        if (showSelectors && correspondence.selector) {
          text.push(correspondence.selector);
        }
        
        if (text.length > 0) {
          const textContent = text.join(' | ');
          const textWidth = textContent.length * 7; // Approximate width
          
          svgElements.push(`
            <rect x="${labelX - textWidth/2 - 5}" y="${labelY - 10}" 
                  width="${textWidth + 10}" height="20" 
                  fill="white" opacity="0.9" rx="3"/>
            <text x="${labelX}" y="${labelY + 3}" 
                  text-anchor="middle" font-family="monospace" font-size="12" 
                  fill="${isSignificant ? '#d9534f' : '#666'}">
              ${textContent}
            </text>
          `);
        }
      }
      
      // Add accessibility match info
      if (match.accessibilityIdentifier) {
        svgElements.push(`
          <text x="${group2.bounds.x}" y="${group2.bounds.y - 5}" 
                font-family="monospace" font-size="10" fill="#0056b3">
            ${match.accessibilityIdentifier}
          </text>
        `);
      }
      
      svgElements.push(`</g>`);
    }
  });
  
  // Add legend
  svgElements.push(renderLegend(svgDimensions, colorScheme));
  
  svgElements.push(`</svg>`);
  
  return svgElements.join('\n');
}

/**
 * Check if bounds are at least partially visible in viewport
 */
function isInViewport(
  bounds: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number }
): boolean {
  // Check if element is completely outside viewport
  if (bounds.x >= viewport.width || bounds.y >= viewport.height) {
    return false;
  }
  if (bounds.x + bounds.width <= 0 || bounds.y + bounds.height <= 0) {
    return false;
  }
  return true;
}

/**
 * Calculate SVG dimensions based on viewport mode
 */
function calculateSvgDimensions(
  correspondences: GroupCorrespondence[],
  viewport: { width: number; height: number; scrollX?: number; scrollY?: number },
  mode: 'viewportOnly' | 'full' | 'fullScroll'
): { width: number; height: number } {
  switch (mode) {
    case 'viewportOnly':
      // Use only the viewport dimensions
      return { width: viewport.width, height: viewport.height };
      
    case 'full':
      // Calculate the bounding box of all elements
      if (correspondences.length === 0) {
        return { width: viewport.width, height: viewport.height };
      }
      
      let maxX = viewport.width;
      let maxY = viewport.height;
      
      correspondences.forEach(corr => {
        // Check both original and new positions
        const x1 = corr.group1.bounds.x + corr.group1.bounds.width;
        const y1 = corr.group1.bounds.y + corr.group1.bounds.height;
        const x2 = corr.group2.bounds.x + corr.group2.bounds.width;
        const y2 = corr.group2.bounds.y + corr.group2.bounds.height;
        
        maxX = Math.max(maxX, x1, x2);
        maxY = Math.max(maxY, y1, y2);
      });
      
      // Add some padding
      return { 
        width: Math.ceil(maxX + 50), 
        height: Math.ceil(maxY + 50) 
      };
      
    case 'fullScroll':
      // Include scroll dimensions if available
      const scrollWidth = viewport.scrollX || 0;
      const scrollHeight = viewport.scrollY || 0;
      
      // Calculate max dimensions including scroll
      let maxScrollX = viewport.width + scrollWidth;
      let maxScrollY = viewport.height + scrollHeight;
      
      correspondences.forEach(corr => {
        const x1 = corr.group1.bounds.x + corr.group1.bounds.width;
        const y1 = corr.group1.bounds.y + corr.group1.bounds.height;
        const x2 = corr.group2.bounds.x + corr.group2.bounds.width;
        const y2 = corr.group2.bounds.y + corr.group2.bounds.height;
        
        maxScrollX = Math.max(maxScrollX, x1, x2);
        maxScrollY = Math.max(maxScrollY, y1, y2);
      });
      
      return {
        width: Math.ceil(maxScrollX + 50),
        height: Math.ceil(maxScrollY + 50)
      };
      
    default:
      return { width: viewport.width, height: viewport.height };
  }
}

/**
 * Calculate movement vector between two bounds
 */
function calculateMovementVector(
  bounds1: { x: number; y: number; width: number; height: number },
  bounds2: { x: number; y: number; width: number; height: number }
): { distance: number; angle: number; dx: number; dy: number } {
  const center1 = {
    x: bounds1.x + bounds1.width / 2,
    y: bounds1.y + bounds1.height / 2,
  };
  
  const center2 = {
    x: bounds2.x + bounds2.width / 2,
    y: bounds2.y + bounds2.height / 2,
  };
  
  const dx = center2.x - center1.x;
  const dy = center2.y - center1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  
  return { distance, angle, dx, dy };
}

/**
 * Get color based on movement distance and color scheme
 */
function getMovementColor(distance: number, scheme: string, angle: number): string {
  switch (scheme) {
    case 'severity':
      if (distance < 10) return '#5cb85c'; // Green - minimal movement
      if (distance < 50) return '#f0ad4e'; // Orange - moderate movement
      return '#d9534f'; // Red - significant movement
      
    case 'direction':
      // Color based on movement direction
      const hue = (angle + 180) % 360; // Normalize to 0-360
      return `hsl(${hue}, 70%, 50%)`;
      
    default:
      return '#0056b3'; // Default blue
  }
}

/**
 * Render legend for the movement visualization
 */
function renderLegend(
  viewport: { width: number; height: number },
  colorScheme: string
): string {
  const legendX = viewport.width - 200;
  const legendY = 20;
  
  const legend = [`<g class="legend" transform="translate(${legendX}, ${legendY})">`];
  
  legend.push(`
    <rect x="0" y="0" width="180" height="120" 
          fill="white" stroke="#ccc" opacity="0.95" rx="5"/>
    <text x="10" y="20" font-family="sans-serif" font-size="14" font-weight="bold">
      Movement Legend
    </text>
  `);
  
  if (colorScheme === 'severity') {
    legend.push(`
      <line x1="10" y1="35" x2="30" y2="35" stroke="#5cb85c" stroke-width="2"/>
      <text x="35" y="40" font-family="sans-serif" font-size="12">< 10px (Minor)</text>
      
      <line x1="10" y1="55" x2="30" y2="55" stroke="#f0ad4e" stroke-width="2"/>
      <text x="35" y="60" font-family="sans-serif" font-size="12">10-50px (Moderate)</text>
      
      <line x1="10" y1="75" x2="30" y2="75" stroke="#d9534f" stroke-width="2"/>
      <text x="35" y="80" font-family="sans-serif" font-size="12">> 50px (Major)</text>
    `);
  }
  
  legend.push(`
    <line x1="10" y1="95" x2="30" y2="95" stroke="#666" stroke-width="1" stroke-dasharray="5,3"/>
    <text x="35" y="100" font-family="sans-serif" font-size="12">Original position</text>
  `);
  
  legend.push(`</g>`);
  
  return legend.join('\n');
}

/**
 * Generate a summary of movements for reporting
 */
export function generateMovementSummary(correspondences: GroupCorrespondence[]): {
  totalMovements: number;
  significantMovements: number;
  averageDistance: number;
  maxDistance: number;
  movements: Array<{
    selector: string;
    label: string;
    distance: number;
    direction: string;
    accessibilityId: string;
  }>;
} {
  const movements = correspondences.map(corr => {
    const movement = calculateMovementVector(corr.group1.bounds, corr.group2.bounds);
    const direction = getMovementDirection(movement.angle);
    
    return {
      selector: corr.selector || '',
      label: corr.group1.label || 'Unknown',
      distance: Math.round(movement.distance),
      direction,
      accessibilityId: corr.match.accessibilityIdentifier || '',
    };
  }).filter(m => m.distance > 5); // Filter out negligible movements
  
  const distances = movements.map(m => m.distance);
  const totalDistance = distances.reduce((sum, d) => sum + d, 0);
  
  return {
    totalMovements: movements.length,
    significantMovements: movements.filter(m => m.distance > 50).length,
    averageDistance: movements.length > 0 ? Math.round(totalDistance / movements.length) : 0,
    maxDistance: movements.length > 0 ? Math.max(...distances) : 0,
    movements: movements.sort((a, b) => b.distance - a.distance), // Sort by distance descending
  };
}

/**
 * Get human-readable direction from angle
 */
function getMovementDirection(angle: number): string {
  const normalizedAngle = ((angle + 360) % 360);
  
  if (normalizedAngle < 22.5 || normalizedAngle >= 337.5) return 'right';
  if (normalizedAngle < 67.5) return 'down-right';
  if (normalizedAngle < 112.5) return 'down';
  if (normalizedAngle < 157.5) return 'down-left';
  if (normalizedAngle < 202.5) return 'left';
  if (normalizedAngle < 247.5) return 'up-left';
  if (normalizedAngle < 292.5) return 'up';
  return 'up-right';
}