/**
 * レイアウト抽出のコア機能
 */

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutElement {
  tagName: string;
  className: string;
  id: string;
  rect: LayoutRect;
  text?: string;
  role: string | null;
  ariaLabel: string | null;
  ariaAttributes: Record<string, string>;
  isInteractive: boolean;
  hasParentWithSameSize: boolean;
  computedStyle: {
    display: string;
    position: string;
    zIndex: string;
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontWeight: string;
  };
}

export interface SemanticGroup {
  id: string;
  type: 'section' | 'navigation' | 'container' | 'group' | 'interactive' | 'content';
  bounds: { x: number; y: number; width: number; height: number };
  elements: any[];
  children: SemanticGroup[];
  depth: number;
  label: string;
  importance: number;
}

export interface LayoutPattern {
  elements: any[];
  type: string;
  className: string;
  averageSize?: { width: number; height: number };
}

export interface LayoutAnalysisResult {
  url: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
    scrollX?: number;
    scrollY?: number;
  };
  elements?: LayoutElement[];
  semanticGroups?: SemanticGroup[];
  patterns?: LayoutPattern[];
  totalElements: number;
  statistics: {
    totalElements?: number;
    interactiveElements?: number;
    groupCount?: number;
    patternCount?: number;
    topLevelGroups?: number;
    accessibilityCount?: number;
    byType?: Record<string, number>;
  };
}

/**
 * セマンティックタイプを判定
 */
export function getSemanticType(element: HTMLElement): string {
  const tag = element.tagName.toLowerCase();
  const role = element.getAttribute('role');
  
  // ナビゲーション要素
  if (tag === 'nav' || role === 'navigation' || 
      element.classList.contains('nav') || element.classList.contains('navigation')) {
    return 'navigation';
  }
  
  // セクション要素
  if (['section', 'article', 'main', 'aside', 'header', 'footer'].includes(tag) ||
      ['main', 'complementary', 'banner', 'contentinfo'].includes(role || '')) {
    return 'section';
  }
  
  // インタラクティブ要素
  if (['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
      ['button', 'link', 'textbox'].includes(role || '') ||
      element.onclick || element.getAttribute('tabindex')) {
    return 'interactive';
  }
  
  // コンテナ要素（子要素が多い）
  const childElements = Array.from(element.children).filter(child => 
    child.nodeType === 1 && window.getComputedStyle(child).display !== 'none'
  );
  if (childElements.length >= 3) {
    return 'container';
  }
  
  // グループ要素（同種の要素を含む）
  if (childElements.length >= 2) {
    const firstTag = childElements[0]?.tagName;
    const isSameType = childElements.every(child => child.tagName === firstTag);
    if (isSameType) {
      return 'group';
    }
  }
  
  // その他はコンテンツ
  return 'content';
}

/**
 * 要素の重要度を計算
 */
export function calculateImportance(element: HTMLElement, rect: DOMRect | LayoutRect): number {
  let importance = 0;
  
  // サイズによる重要度
  const area = rect.width * rect.height;
  const viewportArea = window.innerWidth * window.innerHeight;
  importance += (area / viewportArea) * 30;
  
  // 位置による重要度（上部ほど重要）
  const verticalPosition = rect.top / window.innerHeight;
  importance += (1 - verticalPosition) * 20;
  
  // セマンティックタグによる重要度
  const importantTags = ['main', 'article', 'h1', 'h2', 'nav', 'header'];
  if (importantTags.includes(element.tagName.toLowerCase())) {
    importance += 20;
  }
  
  // インタラクティブ要素の重要度
  if (getSemanticType(element) === 'interactive') {
    importance += 15;
  }
  
  // 視覚的な強調（背景色、ボーダーなど）
  const style = window.getComputedStyle(element);
  if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
    importance += 10;
  }
  if (style.borderWidth !== '0px') {
    importance += 5;
  }
  
  return Math.min(100, importance);
}

/**
 * パターンを検出
 */
export function detectPatterns(elements: any[]): LayoutPattern[] {
  const patterns: LayoutPattern[] = [];
  const processed = new Set<number>();
  
  elements.forEach((el, i) => {
    if (processed.has(i)) return;
    
    const pattern: LayoutPattern = {
      elements: [el],
      type: el.tagName,
      className: el.className,
      averageSize: { width: el.rect.width, height: el.rect.height }
    };
    
    // 類似要素を探す
    elements.forEach((other, j) => {
      if (i === j || processed.has(j)) return;
      
      // 同じタグとクラス
      if (el.tagName === other.tagName && el.className === other.className) {
        // サイズが類似
        const widthRatio = Math.min(el.rect.width, other.rect.width) / Math.max(el.rect.width, other.rect.width);
        const heightRatio = Math.min(el.rect.height, other.rect.height) / Math.max(el.rect.height, other.rect.height);
        
        if (widthRatio > 0.8 && heightRatio > 0.8) {
          pattern.elements.push(other);
          processed.add(j);
        }
      }
    });
    
    if (pattern.elements.length >= 2) {
      patterns.push(pattern);
    }
  });
  
  return patterns;
}

/**
 * ブラウザで実行するレイアウト抽出コード
 */
export const extractLayoutScript = `
(() => {
  const getSemanticType = ${getSemanticType.toString()};
  const calculateImportance = ${calculateImportance.toString()};
  const detectPatterns = ${detectPatterns.toString()};
  
  // DOM要素を収集して分析
  const elements = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const element = node;
        const tagName = element.tagName;
        
        // 除外するタグ
        if (['SCRIPT', 'STYLE', 'META', 'LINK', 'NOSCRIPT'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // 表示されている要素のみ
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let node;
  while (node = walker.nextNode()) {
    const element = node;
    const rect = element.getBoundingClientRect();
    
    if (rect.width > 0 && rect.height > 0) {
      // 親要素の情報を取得
      const parent = element.parentElement;
      const parentRect = parent ? parent.getBoundingClientRect() : null;
      
      // アクセシビリティ関連の属性を収集
      const ariaAttributes = {};
      for (const attr of element.attributes) {
        if (attr.name.startsWith('aria-')) {
          ariaAttributes[attr.name] = attr.value;
        }
      }
      
      const computedStyle = window.getComputedStyle(element);
      
      elements.push({
        tagName: element.tagName,
        className: element.className,
        id: element.id,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        },
        text: element.textContent?.trim().substring(0, 100),
        role: element.getAttribute('role'),
        ariaLabel: element.getAttribute('aria-label'),
        ariaAttributes: ariaAttributes,
        isInteractive: ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) || 
                      element.getAttribute('onclick') !== null ||
                      element.getAttribute('role') === 'button',
        hasParentWithSameSize: parentRect && 
                              Math.abs(rect.width - parentRect.width) < 1 && 
                              Math.abs(rect.height - parentRect.height) < 1,
        computedStyle: {
          display: computedStyle.display,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          backgroundColor: computedStyle.backgroundColor,
          color: computedStyle.color,
          fontSize: computedStyle.fontSize,
          fontWeight: computedStyle.fontWeight
        }
      });
    }
  }
  
  // 要素をグループ化（簡易版）
  const groups = [];
  const processed = new Set();
  
  for (let i = 0; i < elements.length; i++) {
    if (processed.has(i)) continue;
    
    const group = {
      elements: [elements[i]],
      representative: elements[i]
    };
    
    // 類似要素を探す
    for (let j = i + 1; j < elements.length; j++) {
      if (processed.has(j)) continue;
      
      const el1 = elements[i];
      const el2 = elements[j];
      
      // 同じタグで、サイズが似ている要素をグループ化
      if (el1.tagName === el2.tagName &&
          Math.abs(el1.rect.width - el2.rect.width) < 10 &&
          Math.abs(el1.rect.height - el2.rect.height) < 10) {
        group.elements.push(el2);
        processed.add(j);
      }
    }
    
    if (group.elements.length > 1) {
      groups.push(group);
    }
  }
  
  // アクセシビリティ要素を分類
  const accessibilityElements = elements.filter(el => {
    return el.isInteractive || 
           el.role !== null || 
           Object.keys(el.ariaAttributes).length > 0;
  });
  
  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    },
    elements: elements,
    groups: groups,
    accessibilityElements: accessibilityElements,
    statistics: {
      totalElements: elements.length,
      interactiveElements: elements.filter(el => el.isInteractive).length,
      groupCount: groups.length,
      accessibilityCount: accessibilityElements.length
    }
  };
})();
`;