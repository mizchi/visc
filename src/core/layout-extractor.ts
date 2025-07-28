import { Driver } from '../driver/types.js';

export interface AccessibilityInfo {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaHidden?: boolean;
  ariaExpanded?: boolean;
  ariaSelected?: boolean;
  ariaChecked?: boolean;
  ariaDisabled?: boolean;
  ariaValueNow?: number;
  ariaValueMin?: number;
  ariaValueMax?: number;
  ariaValueText?: string;
  tabIndex?: number;
}

export interface ExtractedElement {
  // 基本情報
  tagName: string;
  id?: string;
  className?: string;
  text?: string;
  
  // 位置とサイズ
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // 可視性
  isVisible: boolean;
  opacity: number;
  
  // アクセシビリティ
  accessibility: AccessibilityInfo;
  
  // 属性
  attributes: Record<string, string>;
  
  // 子要素
  children?: ExtractedElement[];
}

export interface ExtractedLayout {
  elements: ExtractedElement[];
  viewport: {
    width: number;
    height: number;
  };
  documentInfo: {
    title: string;
    url: string;
    lang?: string;
  };
}

/**
 * ドライバーからレイアウトを抽出
 */
export async function extractLayout(driver: Driver): Promise<ExtractedLayout> {
  const viewport = driver.getViewport();
  
  const result = await driver.evaluate(() => {
    // アクセシビリティ情報を抽出
    function extractAccessibility(element: Element): AccessibilityInfo {
      const info: AccessibilityInfo = {};
      
      // ARIA属性
      const role = element.getAttribute('role');
      if (role) info.role = role;
      
      const ariaLabel = element.getAttribute('aria-label');
      if (ariaLabel) info.ariaLabel = ariaLabel;
      
      const ariaLabelledBy = element.getAttribute('aria-labelledby');
      if (ariaLabelledBy) info.ariaLabelledBy = ariaLabelledBy;
      
      const ariaDescribedBy = element.getAttribute('aria-describedby');
      if (ariaDescribedBy) info.ariaDescribedBy = ariaDescribedBy;
      
      const ariaHidden = element.getAttribute('aria-hidden');
      if (ariaHidden) info.ariaHidden = ariaHidden === 'true';
      
      const ariaExpanded = element.getAttribute('aria-expanded');
      if (ariaExpanded) info.ariaExpanded = ariaExpanded === 'true';
      
      const ariaSelected = element.getAttribute('aria-selected');
      if (ariaSelected) info.ariaSelected = ariaSelected === 'true';
      
      const ariaChecked = element.getAttribute('aria-checked');
      if (ariaChecked) info.ariaChecked = ariaChecked === 'true';
      
      const ariaDisabled = element.getAttribute('aria-disabled');
      if (ariaDisabled) info.ariaDisabled = ariaDisabled === 'true';
      
      // ARIA値
      const ariaValueNow = element.getAttribute('aria-valuenow');
      if (ariaValueNow) info.ariaValueNow = parseFloat(ariaValueNow);
      
      const ariaValueMin = element.getAttribute('aria-valuemin');
      if (ariaValueMin) info.ariaValueMin = parseFloat(ariaValueMin);
      
      const ariaValueMax = element.getAttribute('aria-valuemax');
      if (ariaValueMax) info.ariaValueMax = parseFloat(ariaValueMax);
      
      const ariaValueText = element.getAttribute('aria-valuetext');
      if (ariaValueText) info.ariaValueText = ariaValueText;
      
      // tabIndex
      const tabIndex = element.getAttribute('tabindex');
      if (tabIndex) info.tabIndex = parseInt(tabIndex);
      
      // ネイティブHTMLロールの推定
      if (!info.role) {
        const tagName = element.tagName.toLowerCase();
        const implicitRoles: Record<string, string> = {
          'a': 'link',
          'button': 'button',
          'input': element.getAttribute('type') === 'checkbox' ? 'checkbox' : 
                   element.getAttribute('type') === 'radio' ? 'radio' : 'textbox',
          'nav': 'navigation',
          'main': 'main',
          'header': 'banner',
          'footer': 'contentinfo',
          'aside': 'complementary',
          'article': 'article',
          'section': 'region',
          'img': 'img',
          'ul': 'list',
          'ol': 'list',
          'li': 'listitem',
          'table': 'table',
          'form': 'form'
        };
        
        if (implicitRoles[tagName]) {
          info.role = implicitRoles[tagName];
        }
      }
      
      return info;
    }
    
    // 要素の属性を抽出
    function extractAttributes(element: Element): Record<string, string> {
      const attrs: Record<string, string> = {};
      for (const attr of element.attributes) {
        // アクセシビリティ属性は別途処理するのでスキップ
        if (!attr.name.startsWith('aria-') && attr.name !== 'role' && attr.name !== 'tabindex') {
          attrs[attr.name] = attr.value;
        }
      }
      return attrs;
    }
    
    // 要素を抽出
    function extractElement(element: Element, depth: number = 0): ExtractedElement | null {
      // 深さ制限
      if (depth > 50) return null;
      
      const rect = element.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(element);
      
      // 非表示要素はスキップ（ただしaria-hiddenは含める）
      if (computedStyle.display === 'none') {
        return null;
      }
      
      const opacity = parseFloat(computedStyle.opacity);
      const isVisible = computedStyle.visibility !== 'hidden' && opacity > 0;
      
      // テキストコンテンツを取得（子要素を除く）
      const textNodes = Array.from(element.childNodes)
        .filter(node => node.nodeType === Node.TEXT_NODE)
        .map(node => node.textContent?.trim())
        .filter(text => text && text.length > 0);
      
      const result: ExtractedElement = {
        tagName: element.tagName.toLowerCase(),
        bounds: {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height
        },
        isVisible,
        opacity,
        accessibility: extractAccessibility(element),
        attributes: extractAttributes(element)
      };
      
      // ID、クラス名、テキスト
      if (element.id) result.id = element.id;
      if (element.className && typeof element.className === 'string') {
        result.className = element.className;
      }
      if (textNodes.length > 0) {
        result.text = textNodes.join(' ').substring(0, 200); // 最大200文字
      }
      
      // 子要素を再帰的に処理
      const children: ExtractedElement[] = [];
      for (const child of element.children) {
        const childElement = extractElement(child, depth + 1);
        if (childElement) {
          children.push(childElement);
        }
      }
      
      if (children.length > 0) {
        result.children = children;
      }
      
      return result;
    }
    
    // すべての要素を抽出
    const bodyElement = extractElement(document.body, 0);
    const elements = bodyElement ? [bodyElement] : [];
    
    // ドキュメント情報
    const documentInfo = {
      title: document.title,
      url: window.location.href,
      lang: document.documentElement.lang || undefined
    };
    
    return {
      elements,
      documentInfo
    };
  });
  
  return {
    elements: result.elements,
    viewport,
    documentInfo: result.documentInfo
  };
}