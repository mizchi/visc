/**
 * CSS selector generator for Visual Node Groups
 * Generates unique and reliable selectors to identify root elements
 */

import type { VisualNode, VisualNodeGroup } from '../types.js';

/**
 * Generate a CSS selector for the root element of a Visual Node Group
 */
export function generateRootSelector(group: VisualNodeGroup): string {
  // Find the root element (first VisualNode in children)
  const rootNode = findRootNode(group);
  if (!rootNode) {
    return '';
  }

  return generateNodeSelector(rootNode, group);
}

/**
 * Find the root VisualNode in a group
 */
function findRootNode(group: VisualNodeGroup): VisualNode | null {
  for (const child of group.children) {
    if ('tagName' in child) {
      return child as VisualNode;
    }
    // If it's a nested group, recurse
    if ('children' in child && child.children) {
      const found = findRootNode(child as VisualNodeGroup);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Generate a unique selector for a VisualNode
 * Priority order:
 * 1. ID selector
 * 2. Data attributes (data-testid, data-id, etc.)
 * 3. Aria attributes with specific values
 * 4. Semantic tag + unique class combination
 * 5. Tag + position-based selector
 */
export function generateNodeSelector(node: VisualNode, context?: VisualNodeGroup): string {
  const selectors: string[] = [];

  // 1. ID selector (most specific)
  if (node.id) {
    return `#${CSS.escape(node.id)}`;
  }

  // 2. Data attributes (often used for testing)
  if (node.ariaAttributes) {
    const dataTestId = findDataAttribute(node.ariaAttributes, ['data-testid', 'data-test-id', 'data-id']);
    if (dataTestId) {
      return `[${dataTestId.key}="${CSS.escape(dataTestId.value)}"]`;
    }
  }

  // 3. Aria-label or aria-labelledby (unique identifiers)
  if (node.ariaLabel) {
    selectors.push(`[aria-label="${CSS.escape(node.ariaLabel)}"]`);
  } else if (node.ariaAttributes?.['aria-labelledby']) {
    selectors.push(`[aria-labelledby="${CSS.escape(node.ariaAttributes['aria-labelledby'])}"]`);
  }

  // 4. Build tag + class selector
  const tagName = node.tagName.toLowerCase();
  
  // Semantic HTML5 tags that are often unique
  const semanticTags = ['main', 'header', 'footer', 'nav', 'aside', 'article', 'section'];
  const isSemanticTag = semanticTags.includes(tagName);

  // Start with tag name
  let selector = tagName;

  // Add role if present and meaningful
  if (node.role && node.role !== 'none' && node.role !== 'presentation') {
    selector += `[role="${node.role}"]`;
    
    // If we have a semantic tag with role, that's often unique enough
    if (isSemanticTag) {
      return selector;
    }
  }

  // Add classes for specificity
  if (node.className && typeof node.className === 'string') {
    const classes = node.className.split(' ').filter(c => c && !c.startsWith('js-'));
    
    // Look for BEM root classes or component classes
    const componentClass = classes.find(c => 
      /^[A-Z]/.test(c) || // PascalCase
      (c.includes('__') === false && c.includes('--') === false) // BEM root
    );
    
    if (componentClass) {
      selector += `.${CSS.escape(componentClass)}`;
      
      // Add additional unique classes if needed
      const uniqueClasses = classes.filter(c => 
        c !== componentClass && 
        (c.includes('--') || // BEM modifiers
         /^(is-|has-|with-)/.test(c)) // State classes
      );
      
      if (uniqueClasses.length > 0) {
        selector += `.${CSS.escape(uniqueClasses[0])}`;
      }
    } else if (classes.length > 0) {
      // Use first two classes for specificity
      selector += classes.slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
    }
  }

  // 5. Add position hint if selector might not be unique
  if (!isSemanticTag && !node.role && context) {
    // Try to add contextual information
    const position = getPositionInContext(node, context);
    if (position.index !== -1) {
      // Only add :nth-of-type if there are multiple similar elements
      if (position.total > 1) {
        selector += `:nth-of-type(${position.index + 1})`;
      }
    }
  }

  // Combine with aria selector if we have both
  if (selectors.length > 0 && selector !== tagName) {
    // Prefer the more specific selector
    return selector;
  } else if (selectors.length > 0) {
    return selectors[0];
  }

  return selector;
}

/**
 * Find data attributes commonly used for testing
 */
function findDataAttribute(
  attributes: Record<string, string>,
  keys: string[]
): { key: string; value: string } | null {
  for (const key of keys) {
    if (attributes[key]) {
      return { key, value: attributes[key] };
    }
  }
  
  // Also check for any data- attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('data-') && value) {
      return { key, value };
    }
  }
  
  return null;
}

/**
 * Get position of node within its group context
 */
function getPositionInContext(
  node: VisualNode,
  group: VisualNodeGroup
): { index: number; total: number } {
  const sameTagNodes = group.children.filter(child => 
    'tagName' in child && 
    (child as VisualNode).tagName === node.tagName
  );
  
  const index = sameTagNodes.findIndex(child => 
    child === node || 
    ('rect' in child && child.rect.x === node.rect.x && child.rect.y === node.rect.y)
  );
  
  return {
    index,
    total: sameTagNodes.length
  };
}

/**
 * Validate if a selector would uniquely identify an element
 * This is a heuristic check based on selector specificity
 */
export function isSelectorLikelyUnique(selector: string): boolean {
  // ID selectors are always unique
  if (selector.startsWith('#')) {
    return true;
  }
  
  // Data attribute selectors are usually unique
  if (selector.includes('[data-')) {
    return true;
  }
  
  // Aria-label selectors are often unique
  if (selector.includes('[aria-label=')) {
    return true;
  }
  
  // Semantic tags with roles are often unique
  const semanticWithRole = /^(main|header|footer|nav|aside)\[role=/;
  if (semanticWithRole.test(selector)) {
    return true;
  }
  
  // Multiple classes or nth-of-type make it more specific
  const classCount = (selector.match(/\./g) || []).length;
  if (classCount >= 2 || selector.includes(':nth-of-type')) {
    return true;
  }
  
  return false;
}

/**
 * Generate a more robust selector by combining multiple strategies
 */
export function generateRobustSelector(node: VisualNode, context?: VisualNodeGroup): string {
  const primarySelector = generateNodeSelector(node, context);
  
  // If the primary selector is likely unique, use it
  if (isSelectorLikelyUnique(primarySelector)) {
    return primarySelector;
  }
  
  // Otherwise, try to make it more specific
  const selectors: string[] = [primarySelector];
  
  // Add parent context if available
  if (context && context.children.length > 1) {
    const parentNode = findParentNode(node, context);
    if (parentNode) {
      const parentSelector = generateNodeSelector(parentNode);
      if (parentSelector && parentSelector !== primarySelector) {
        return `${parentSelector} ${primarySelector}`;
      }
    }
  }
  
  // Add size constraints for very specific matching
  if (node.rect.width > 0 && node.rect.height > 0) {
    // This is a last resort for debugging
    selectors.push(`/* dimensions: ${node.rect.width}x${node.rect.height} */`);
  }
  
  return selectors[0];
}

/**
 * Find the parent node of a given node in the group
 */
function findParentNode(target: VisualNode, group: VisualNodeGroup): VisualNode | null {
  // This is a simplified version - in a real implementation,
  // we'd need the full DOM tree structure
  
  // For now, try to find a containing element based on bounds
  for (const child of group.children) {
    if ('tagName' in child && child !== target) {
      const candidate = child as VisualNode;
      if (
        candidate.rect.x <= target.rect.x &&
        candidate.rect.y <= target.rect.y &&
        candidate.rect.right >= target.rect.right &&
        candidate.rect.bottom >= target.rect.bottom
      ) {
        return candidate;
      }
    }
  }
  
  return null;
}

/**
 * CSS.escape polyfill for older environments
 */
if (typeof CSS === 'undefined' || !CSS.escape) {
  (globalThis as any).CSS = (globalThis as any).CSS || {};
  (globalThis as any).CSS.escape = function(value: string): string {
    if (arguments.length === 0) {
      throw new TypeError('`CSS.escape` requires an argument.');
    }
    const string = String(value);
    const length = string.length;
    let index = -1;
    let codeUnit;
    let result = '';
    const firstCodeUnit = string.charCodeAt(0);
    while (++index < length) {
      codeUnit = string.charCodeAt(index);
      // Note: there's no need to special-case astral symbols, surrogate
      // pairs, or lone surrogates.

      // If the character is NULL (U+0000), use U+FFFD (REPLACEMENT CHARACTER)
      if (codeUnit === 0x0000) {
        result += '\uFFFD';
        continue;
      }

      if (
        // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
        // U+007F
        (codeUnit >= 0x0001 && codeUnit <= 0x001F) || codeUnit === 0x007F ||
        // If the character is the first character and is in the range [0-9]
        // (U+0030 to U+0039)
        (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
        // If the character is the second character and is in the range [0-9]
        // (U+0030 to U+0039) and the first character is a `-` (U+002D)
        (
          index === 1 &&
          codeUnit >= 0x0030 && codeUnit <= 0x0039 &&
          firstCodeUnit === 0x002D
        )
      ) {
        // https://drafts.csswg.org/cssom/#escape-a-character-as-code-point
        result += '\\' + codeUnit.toString(16) + ' ';
        continue;
      }

      // If the character is not handled by one of the above cases, but is
      // greater than or equal to U+0080, is `-` (U+002D) or `_` (U+005F), or
      // is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to
      // U+005A), or [a-z] (U+0061 to U+007A)
      if (
        codeUnit >= 0x0080 ||
        codeUnit === 0x002D ||
        codeUnit === 0x005F ||
        codeUnit >= 0x0030 && codeUnit <= 0x0039 ||
        codeUnit >= 0x0041 && codeUnit <= 0x005A ||
        codeUnit >= 0x0061 && codeUnit <= 0x007A
      ) {
        // the character itself
        result += string.charAt(index);
        continue;
      }

      // Otherwise, escape the character
      result += '\\' + string.charAt(index);
    }
    return result;
  };
}