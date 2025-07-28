import { Driver } from '../driver/types.js';

export interface SemanticElement {
  type: string;
  text?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  children?: SemanticElement[];
}

/**
 * ドライバーからセマンティックレイアウトを取得
 */
export async function getSemanticLayout(driver: Driver): Promise<SemanticElement[]> {
  return await driver.evaluate(() => {
    const semanticTags = [
      'header', 'nav', 'main', 'article', 'section', 'aside', 'footer',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'ul', 'ol', 'li', 'a', 'button', 'form', 'input', 'textarea', 'select'
    ];

    function isSemanticElement(element: Element): boolean {
      return semanticTags.includes(element.tagName.toLowerCase()) ||
             element.getAttribute('role') !== null ||
             element.classList.contains('container') ||
             element.classList.contains('wrapper');
    }

    function extractElement(element: Element): SemanticElement | null {
      const rect = element.getBoundingClientRect();
      
      // 非表示または小さすぎる要素は除外
      if (rect.width === 0 || rect.height === 0 || 
          rect.width < 10 || rect.height < 10) {
        return null;
      }

      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === 'none' || 
          computedStyle.visibility === 'hidden' ||
          computedStyle.opacity === '0') {
        return null;
      }

      const result: SemanticElement = {
        type: element.tagName.toLowerCase(),
        bounds: {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height
        }
      };

      // テキストコンテンツを取得（子要素を除く）
      const textNodes = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(text => text && text.length > 0);
      
      if (textNodes.length > 0) {
        result.text = textNodes.join(' ').substring(0, 50); // 最大50文字
      }

      // 子要素を再帰的に処理
      const children: SemanticElement[] = [];
      for (const child of element.children) {
        if (isSemanticElement(child)) {
          const childElement = extractElement(child);
          if (childElement) {
            children.push(childElement);
          }
        }
      }

      if (children.length > 0) {
        result.children = children;
      }

      return result;
    }

    const elements: SemanticElement[] = [];
    
    // body直下から開始
    for (const element of document.body.children) {
      if (isSemanticElement(element)) {
        const extracted = extractElement(element);
        if (extracted) {
          elements.push(extracted);
        }
      }
    }

    return elements;
  });
}