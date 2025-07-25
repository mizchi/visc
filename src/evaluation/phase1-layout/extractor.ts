/**
 * Phase 1: Layout Extraction Service
 */

import { Page } from 'playwright';
import { BaselineLayout, LayoutElement } from './types';

export class LayoutExtractor {
  constructor(private readonly options: {
    ignoreSelectors?: string[];
    includeInvisible?: boolean;
    maxDepth?: number;
  } = {}) {}

  async extractLayout(page: Page, url: string): Promise<BaselineLayout> {
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    
    const elements = await page.evaluate(
      ({ ignoreSelectors, includeInvisible, maxDepth }) => {
        const extractElement = (
          element: Element,
          depth: number = 0
        ): LayoutElement | null => {
          if (maxDepth && depth > maxDepth) return null;
          
          const rect = element.getBoundingClientRect();
          const styles = window.getComputedStyle(element);
          
          // Skip ignored selectors
          if (ignoreSelectors) {
            for (const selector of ignoreSelectors) {
              if (element.matches(selector)) return null;
            }
          }
          
          const isVisible = styles.visibility !== 'hidden' && 
                          styles.display !== 'none' && 
                          rect.width > 0 && 
                          rect.height > 0;
          
          if (!includeInvisible && !isVisible) return null;
          
          const layoutElement: LayoutElement = {
            selector: element.tagName.toLowerCase(),
            tagName: element.tagName,
            bounds: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            },
            visibility: {
              isVisible,
              opacity: parseFloat(styles.opacity),
              zIndex: styles.zIndex !== 'auto' ? parseInt(styles.zIndex) : undefined
            }
          };
          
          // Extract text content
          if (element.textContent) {
            const text = element.textContent.trim();
            if (text && text.length > 0) {
              layoutElement.text = text.substring(0, 100); // Limit text length
            }
          }
          
          // Extract key attributes
          const attributes: Record<string, string> = {};
          ['id', 'class', 'role', 'aria-label'].forEach(attr => {
            const value = element.getAttribute(attr);
            if (value) attributes[attr] = value;
          });
          
          if (Object.keys(attributes).length > 0) {
            layoutElement.attributes = attributes;
          }
          
          // Extract children
          const children: LayoutElement[] = [];
          for (const child of Array.from(element.children)) {
            const childLayout = extractElement(child, depth + 1);
            if (childLayout) children.push(childLayout);
          }
          
          if (children.length > 0) {
            layoutElement.children = children;
          }
          
          return layoutElement;
        };
        
        const body = document.body;
        const rootElement = extractElement(body);
        return rootElement ? [rootElement] : [];
      },
      {
        ignoreSelectors: this.options.ignoreSelectors,
        includeInvisible: this.options.includeInvisible,
        maxDepth: this.options.maxDepth
      }
    );
    
    return {
      id: `layout-${Date.now()}`,
      url,
      timestamp: Date.now(),
      viewport,
      elements
    };
  }
}