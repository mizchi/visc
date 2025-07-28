import { Driver } from '../driver/types.js';

export interface SemanticElement {
  type: string;
  tagName: string;
  text?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  x: number;
  y: number;
  width: number;
  height: number;
  isVisible: boolean;
  id?: string;
  className?: string;
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
      'p', 'ul', 'ol', 'li', 'a', 'button', 'form', 'input', 'textarea', 'select',
      'div', 'span', 'img', 'svg', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
    ];

    function isSemanticElement(element: Element): boolean {
      const tagName = element.tagName.toLowerCase();
      
      // セマンティックタグの場合
      if (semanticTags.includes(tagName)) {
        return true;
      }
      
      // role属性がある場合
      if (element.getAttribute('role') !== null) {
        return true;
      }
      
      // 重要なクラスを持つ要素
      const importantClasses = [
        'container', 'wrapper', 'content', 'card', 'list',
        'header', 'footer', 'nav', 'menu', 'sidebar',
        'article', 'post', 'item', 'row', 'col'
      ];
      
      for (const className of importantClasses) {
        if (element.className && element.className.toString().toLowerCase().includes(className)) {
          return true;
        }
      }
      
      // ID属性がある重要な要素
      if (element.id && (tagName === 'div' || tagName === 'section')) {
        return true;
      }
      
      return false;
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

      const tagName = element.tagName.toLowerCase();
      const x = rect.left + window.scrollX;
      const y = rect.top + window.scrollY;
      
      const result: SemanticElement = {
        type: tagName,
        tagName: tagName,
        bounds: {
          x: x,
          y: y,
          width: rect.width,
          height: rect.height
        },
        x: x,
        y: y,
        width: rect.width,
        height: rect.height,
        isVisible: true
      };
      
      // ID とクラス名を追加
      if (element.id) {
        result.id = element.id;
      }
      if (element.className) {
        result.className = element.className;
      }

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
    
    // 全てのセマンティック要素を再帰的に探索
    function collectElements(container: Element) {
      for (const element of container.children) {
        if (isSemanticElement(element)) {
          const extracted = extractElement(element);
          if (extracted) {
            elements.push(extracted);
            // 深さ制限を設けて子要素も探索（最大100要素）
            if (elements.length < 100) {
              collectElements(element);
            }
          }
        } else {
          // セマンティック要素でなくても子要素は探索
          if (elements.length < 100) {
            collectElements(element);
          }
        }
      }
    }
    
    collectElements(document.body);
    
    console.log(`Extracted ${elements.length} semantic elements`);
    return elements;
  });
}