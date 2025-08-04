/**
 * レイアウト抽出のコア機能
 */

import type { 
  LayoutRect, 
  LayoutElement, 
  SemanticGroup, 
  LayoutPattern, 
  LayoutAnalysisResult 
} from '../types.js';

export type {
  LayoutRect,
  LayoutElement,
  SemanticGroup,
  LayoutPattern,
  LayoutAnalysisResult
};

/**
 * ブラウザで実行するレイアウト抽出コードを取得
 */
export function getExtractLayoutScript(): string {
  return `
(() => {
  const getSemanticType = ${getSemanticType.toString()};
  const calculateImportance = ${calculateImportance.toString()};
  
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
          x: Math.max(0, rect.x),
          y: Math.max(0, rect.y),
          width: rect.width,
          height: rect.height,
          top: Math.max(0, rect.top),
          right: rect.right,
          bottom: rect.bottom,
          left: Math.max(0, rect.left)
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
        },
        semanticType: getSemanticType(element),
        importance: calculateImportance(element, rect),
      });
    }
  }
  
  // デバッグ: 高さ情報を確認
  const maxY = Math.max(...elements.map(el => el.rect.y + el.rect.height));
  const elementsBelow2000 = elements.filter(el => el.rect.y > 2000).length;
  console.log('Layout extraction debug:', {
    totalElements: elements.length,
    maxY: maxY,
    elementsBelow2000: elementsBelow2000,
    bodyScrollHeight: document.body.scrollHeight,
    documentHeight: document.documentElement.scrollHeight
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
    statistics: {
      totalElements: elements.length,
      interactiveElements: elements.filter(el => el.isInteractive).length,
    }
  };
})();
`;
}

/**
 * 抽出されたレイアウトデータをセマンティックグループに整理
 */
export function organizeIntoSemanticGroups(
  elements: LayoutElement[],
  options: {
    groupingThreshold?: number; // グループ化の閾値
    importanceThreshold?: number; // 重要度の閾値
    viewport?: { width: number; height: number }; // ビューポートによるフィルタリング
  } = {}
): SemanticGroup[] {
  const { groupingThreshold = 20, importanceThreshold = 3, viewport } = options;
  
  // ビューポートが指定されている場合、ビューポート外の要素をフィルタリング
  let filteredElements = elements;
  if (viewport) {
    filteredElements = elements.filter(element => {
      // 要素がビューポート内に少しでも表示されているかチェック
      const elementBottom = element.rect.y + element.rect.height;
      const elementRight = element.rect.x + element.rect.width;
      
      // 完全にビューポート外の要素を除外
      if (element.rect.y >= viewport.height || elementBottom <= 0) {
        return false;
      }
      if (element.rect.x >= viewport.width || elementRight <= 0) {
        return false;
      }
      
      return true;
    });
  }
  const root: SemanticGroup = {
    type: 'root',
    label: 'Page Root',
    bounds: { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 },
    importance: 100,
    children: [],
  };

  // ページ全体のバウンディングボックスを計算
  if (filteredElements.length > 0) {
    const xs = filteredElements.map(e => e.rect.x);
    const ys = filteredElements.map(e => e.rect.y);
    const rights = filteredElements.map(e => e.rect.right);
    const bottoms = filteredElements.map(e => e.rect.bottom);
    root.bounds.x = Math.max(0, Math.min(...xs));
    root.bounds.y = Math.max(0, Math.min(...ys));
    root.bounds.width = Math.max(...rights) - root.bounds.x;
    root.bounds.height = Math.max(...bottoms) - root.bounds.y;
  }

  // 重要度で要素をソート
  const sortedElements = filteredElements
    .sort((a, b) => (b.importance || 0) - (a.importance || 0));

  // グループ化処理
  const groups: SemanticGroup[] = [];
  const assignedToGroup = new Set<LayoutElement>();

  sortedElements.forEach(element => {
    if (assignedToGroup.has(element) || (element.importance || 0) < importanceThreshold) {
      return;
    }
    
    // ページ全体を覆う要素はスキップ（より具体的なグループを優先）
    const pageArea = viewport 
      ? viewport.width * viewport.height
      : (filteredElements[0]?.rect.width || 1280) * (filteredElements[0]?.rect.height || 800);
    const elementArea = element.rect.width * element.rect.height;
    if (elementArea > pageArea * 0.8) {
      return;
    }

    let bestGroup: SemanticGroup | null = null;
    let minDistance = Infinity;

    // 既存のグループに所属できるか探す
    groups.forEach(group => {
      const distance = Math.hypot(
        group.bounds.x - element.rect.x,
        group.bounds.y - element.rect.y
      );
      if (distance < minDistance && distance < groupingThreshold * 5) {
        bestGroup = group;
        minDistance = distance;
      }
    });

    if (bestGroup !== null) {
      const group = bestGroup as SemanticGroup;
      // 既存グループに追加
      group.children.push(element as (LayoutElement | SemanticGroup));
      assignedToGroup.add(element);
      // グループの境界を更新
      const newX = Math.min(group.bounds.x, element.rect.x);
      const newY = Math.min(group.bounds.y, element.rect.y);
      group.bounds.width = Math.max(1, Math.max(group.bounds.x + group.bounds.width, element.rect.right) - newX);
      group.bounds.height = Math.max(1, Math.max(group.bounds.y + group.bounds.height, element.rect.bottom) - newY);
      group.bounds.x = newX;
      group.bounds.y = newY;
    } else {
      // 新規グループを作成
      const newGroup: SemanticGroup = {
        type: element.semanticType || 'content',
        label: element.text?.substring(0, 30) || element.tagName,
        bounds: { ...element.rect },
        importance: element.importance || 0,
        children: [element as (LayoutElement | SemanticGroup)],
      };
      groups.push(newGroup);
      assignedToGroup.add(element);
    }
  });

  // グループの階層化（簡易版）
  const topLevelGroups: SemanticGroup[] = [];
  groups.sort((a, b) => b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height);

  groups.forEach(group => {
    let parentFound = false;
    topLevelGroups.forEach(parent => {
      if (
        parent.bounds.x <= group.bounds.x &&
        parent.bounds.y <= group.bounds.y &&
        parent.bounds.x + parent.bounds.width >= group.bounds.x + group.bounds.width &&
        parent.bounds.y + parent.bounds.height >= group.bounds.y + group.bounds.height
      ) {
        parent.children.push(group as (LayoutElement | SemanticGroup));
        parentFound = true;
      }
    });
    if (!parentFound) {
      topLevelGroups.push(group);
    }
  });

  // デバッグ: セマンティックグループの統計情報
  const groupStats = topLevelGroups.map(g => ({
    type: g.type,
    y: g.bounds.y,
    height: g.bounds.height,
    bottom: g.bounds.y + g.bounds.height,
    childCount: g.children.length
  }));
  
  const maxGroupY = Math.max(...groupStats.map(g => g.bottom));
  const groupsBelow2000 = groupStats.filter(g => g.y > 2000).length;
  
  console.log('Semantic group debug:', {
    totalTopLevelGroups: topLevelGroups.length,
    totalGroups: groups.length,
    maxGroupY: maxGroupY,
    groupsBelow2000: groupsBelow2000,
    groupsAbove2000: groupStats.filter(g => g.y <= 2000).length
  });
  
  return topLevelGroups;
}

/**
 * レイアウト分析を実行
 */
export async function analyzeLayout(
  page: any, // Playwright Page object
  options: {
    groupingThreshold?: number;
    importanceThreshold?: number;
    viewportOnly?: boolean;
  } = {}
): Promise<LayoutAnalysisResult> {
  // ブラウザでスクリプトを実行してデータを取得
  const rawData = await page.evaluate(getExtractLayoutScript());

  // セマンティックグループに整理
  const semanticGroups = organizeIntoSemanticGroups(rawData.elements, {
    ...options,
    viewport: options.viewportOnly ? rawData.viewport : undefined
  });

  // パターン検出
  const patterns = detectPatterns(rawData.elements);

  return {
    ...rawData,
    semanticGroups,
    patterns,
    statistics: {
      ...rawData.statistics,
      semanticGroupCount: semanticGroups.length,
      patternCount: patterns.length,
    },
  };
}

function getSemanticType(element) {
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

function calculateImportance(element, rect) {
  let importance = 0;
  
  // サイズによる重要度
  const area = rect.width * rect.height;
  const viewportArea = window.innerWidth * window.innerHeight;
  importance += (area / viewportArea) * 30;
  
  // 位置による重要度（上部ほど重要だが、下部も最低限の重要度を保証）
  const verticalPosition = rect.top / window.innerHeight;
  const positionScore = Math.max(0, 1 - verticalPosition);
  importance += positionScore * 20;
  
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
  
  // 最低限の重要度を保証（小さくても表示されている要素は重要）
  if (area > 100) { // 100px²以上の要素
    importance = Math.max(importance, 5);
  }
  
  return Math.min(100, importance);
}

function detectPatterns(elements: any[]): LayoutPattern[] {
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
