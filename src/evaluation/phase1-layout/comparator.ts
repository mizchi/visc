/**
 * Phase 1: Layout Comparison Logic
 */

import { BaselineLayout, ComparisonResult, LayoutDifference, LayoutElement } from './types';

export class LayoutComparator {
  constructor(private readonly options: {
    tolerance?: {
      bounds?: number;  // Pixel tolerance for position/size changes
      text?: boolean;   // Whether to compare text content
    };
    ignoreAttributes?: string[];
  } = {}) {}

  compare(baseline: BaselineLayout, current: BaselineLayout): ComparisonResult {
    const differences: LayoutDifference[] = [];
    const baselineElements = this.flattenElements(baseline.elements);
    const currentElements = this.flattenElements(current.elements);
    
    const baselineMap = new Map(
      baselineElements.map(e => [this.getElementKey(e), e])
    );
    const currentMap = new Map(
      currentElements.map(e => [this.getElementKey(e), e])
    );
    
    // Find removed elements
    for (const [key, element] of baselineMap) {
      if (!currentMap.has(key)) {
        differences.push({
          type: 'removed',
          element,
          baseline: element
        });
      }
    }
    
    // Find added and modified elements
    for (const [key, currentElement] of currentMap) {
      const baselineElement = baselineMap.get(key);
      
      if (!baselineElement) {
        differences.push({
          type: 'added',
          element: currentElement,
          current: currentElement
        });
      } else {
        const changes = this.compareElements(baselineElement, currentElement);
        if (changes) {
          differences.push({
            type: this.determineDiffType(changes),
            element: currentElement,
            baseline: baselineElement,
            current: currentElement,
            changes
          });
        }
      }
    }
    
    const statistics = {
      totalElements: currentElements.length,
      changedElements: differences.filter(d => d.type === 'modified' || d.type === 'moved').length,
      addedElements: differences.filter(d => d.type === 'added').length,
      removedElements: differences.filter(d => d.type === 'removed').length,
      percentageChanged: (differences.length / Math.max(baselineElements.length, currentElements.length)) * 100
    };
    
    return {
      id: `comparison-${Date.now()}`,
      baselineId: baseline.id,
      currentId: current.id,
      timestamp: Date.now(),
      status: differences.length === 0 ? 'passed' : 
              statistics.percentageChanged > 50 ? 'failed' : 'warning',
      differences,
      statistics
    };
  }
  
  private flattenElements(elements: LayoutElement[]): LayoutElement[] {
    const result: LayoutElement[] = [];
    
    const traverse = (element: LayoutElement) => {
      result.push(element);
      if (element.children) {
        element.children.forEach(traverse);
      }
    };
    
    elements.forEach(traverse);
    return result;
  }
  
  private getElementKey(element: LayoutElement): string {
    const parts = [element.tagName];
    
    if (element.attributes?.id) {
      parts.push(`#${element.attributes.id}`);
    }
    if (element.attributes?.class) {
      parts.push(`.${element.attributes.class.split(' ')[0]}`);
    }
    
    // Use position as part of key for better matching
    parts.push(`@${Math.round(element.bounds.x)},${Math.round(element.bounds.y)}`);
    
    return parts.join('');
  }
  
  private compareElements(baseline: LayoutElement, current: LayoutElement): {
    bounds?: boolean;
    text?: boolean;
    visibility?: boolean;
    attributes?: boolean;
  } | null {
    const changes: any = {};
    const tolerance = this.options.tolerance?.bounds || 0;
    
    // Compare bounds
    if (
      Math.abs(baseline.bounds.x - current.bounds.x) > tolerance ||
      Math.abs(baseline.bounds.y - current.bounds.y) > tolerance ||
      Math.abs(baseline.bounds.width - current.bounds.width) > tolerance ||
      Math.abs(baseline.bounds.height - current.bounds.height) > tolerance
    ) {
      changes.bounds = true;
    }
    
    // Compare text
    if (this.options.tolerance?.text !== false && baseline.text !== current.text) {
      changes.text = true;
    }
    
    // Compare visibility
    if (
      baseline.visibility.isVisible !== current.visibility.isVisible ||
      Math.abs(baseline.visibility.opacity - current.visibility.opacity) > 0.1
    ) {
      changes.visibility = true;
    }
    
    // Compare attributes
    if (this.compareAttributes(baseline.attributes, current.attributes)) {
      changes.attributes = true;
    }
    
    return Object.keys(changes).length > 0 ? changes : null;
  }
  
  private compareAttributes(
    baseline?: Record<string, string>,
    current?: Record<string, string>
  ): boolean {
    if (!baseline && !current) return false;
    if (!baseline || !current) return true;
    
    const ignoreAttrs = new Set(this.options.ignoreAttributes || []);
    
    const baselineKeys = Object.keys(baseline).filter(k => !ignoreAttrs.has(k));
    const currentKeys = Object.keys(current).filter(k => !ignoreAttrs.has(k));
    
    if (baselineKeys.length !== currentKeys.length) return true;
    
    return baselineKeys.some(key => baseline[key] !== current[key]);
  }
  
  private determineDiffType(changes: any): 'modified' | 'moved' {
    // If only position changed, consider it moved
    if (changes.bounds && !changes.text && !changes.visibility && !changes.attributes) {
      return 'moved';
    }
    return 'modified';
  }
}