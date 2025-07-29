/**
 * セマンティックレイアウト分析
 */

import { getSemanticType, calculateImportance, detectPatterns } from './extractor.js';
import type { SemanticGroup, LayoutAnalysisResult } from './extractor.js';

interface HierarchyNode {
  element: HTMLElement;
  rect: DOMRect;
  role: string;
  depth: number;
  children: HierarchyNode[];
  semanticType: string;
  importance: number;
}

/**
 * 視覚的に意味のあるグループを検出
 */
export function detectSemanticGroups(elements: HTMLElement[]): SemanticGroup[] {
  const groups: SemanticGroup[] = [];
  
  // 親子関係を解析
  function buildHierarchy(element: HTMLElement, depth = 0): HierarchyNode | null {
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    
    const semanticType = getSemanticType(element);
    const importance = calculateImportance(element, rect);
    
    // 重要度が低すぎる要素はスキップ
    if (importance < 10 && semanticType === 'content') return null;
    
    const node: HierarchyNode = {
      element,
      rect,
      role: semanticType,
      depth,
      children: [],
      semanticType,
      importance
    };
    
    // 子要素を処理
    const children = Array.from(element.children)
      .filter(child => {
        const style = window.getComputedStyle(child);
        return style.display !== 'none' && style.visibility !== 'hidden';
      })
      .map(child => buildHierarchy(child as HTMLElement, depth + 1))
      .filter(child => child !== null) as HierarchyNode[];
    
    node.children = children;
    
    return node;
  }
  
  // 意味のあるグループを抽出
  function extractGroups(node: HierarchyNode | null, parentGroup: SemanticGroup | null = null): void {
    if (!node) return;
    
    const bounds = {
      x: node.rect.x,
      y: node.rect.y,
      width: node.rect.width,
      height: node.rect.height
    };
    
    // グループ化の条件
    const shouldCreateGroup = 
      node.semanticType === 'section' ||
      node.semanticType === 'navigation' ||
      node.semanticType === 'container' ||
      node.semanticType === 'group' ||
      node.importance > 30 ||
      node.children.length >= 3;
    
    if (shouldCreateGroup) {
      const group: SemanticGroup = {
        id: 'group-' + groups.length,
        type: node.semanticType as any,
        bounds,
        elements: [node.element],
        children: [],
        depth: node.depth,
        label: node.element.tagName + (node.element.className ? '.' + node.element.className.split(' ')[0] : ''),
        importance: node.importance
      };
      
      groups.push(group);
      
      // 子要素を処理
      node.children.forEach(child => {
        extractGroups(child, group);
      });
      
      if (parentGroup) {
        parentGroup.children.push(group);
      }
    } else {
      // グループ化しない場合は親グループに追加
      if (parentGroup) {
        parentGroup.elements.push(node.element);
        // 親グループの境界を更新
        parentGroup.bounds.x = Math.min(parentGroup.bounds.x, bounds.x);
        parentGroup.bounds.y = Math.min(parentGroup.bounds.y, bounds.y);
        const maxX = Math.max(parentGroup.bounds.x + parentGroup.bounds.width, bounds.x + bounds.width);
        const maxY = Math.max(parentGroup.bounds.y + parentGroup.bounds.height, bounds.y + bounds.height);
        parentGroup.bounds.width = maxX - parentGroup.bounds.x;
        parentGroup.bounds.height = maxY - parentGroup.bounds.y;
      }
      
      // 子要素を処理
      node.children.forEach(child => {
        extractGroups(child, parentGroup);
      });
    }
  }
  
  // ルート要素から階層を構築
  const root = buildHierarchy(document.body);
  if (root) {
    extractGroups(root);
  }
  
  // 重要度でソート
  groups.sort((a, b) => b.importance - a.importance);
  
  return groups;
}

/**
 * ブラウザで実行するセマンティック分析コードを取得
 */
export function getExtractSemanticLayoutScript(): string {
  return `
(() => {
  // getSemanticType関数をインライン化
  function getSemanticType(element) {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    const className = element.className.toLowerCase();
    
    // セマンティックHTML要素のマッピング
    const semanticTags = {
      nav: 'navigation',
      header: 'navigation',
      footer: 'navigation',
      main: 'content',
      article: 'content',
      section: 'section',
      aside: 'section',
      form: 'interactive',
      button: 'interactive',
      input: 'interactive',
      select: 'interactive',
      textarea: 'interactive',
      dialog: 'interactive',
      details: 'interactive',
      summary: 'interactive'
    };
    
    // タグ名でチェック
    if (semanticTags[tagName]) {
      return semanticTags[tagName];
    }
    
    // ロール属性でチェック
    if (role) {
      if (['navigation', 'search', 'banner'].includes(role)) return 'navigation';
      if (['main', 'article', 'contentinfo'].includes(role)) return 'content';
      if (['form', 'button', 'link'].includes(role)) return 'interactive';
      if (['region', 'complementary'].includes(role)) return 'section';
    }
    
    // クラス名でチェック
    if (className.includes('nav') || className.includes('menu')) return 'navigation';
    if (className.includes('content') || className.includes('article')) return 'content';
    if (className.includes('sidebar') || className.includes('aside')) return 'section';
    if (className.includes('container') || className.includes('wrapper')) return 'container';
    
    // インタラクティブ要素の追加チェック
    if (element.onclick || element.href || element.type === 'submit') {
      return 'interactive';
    }
    
    // デフォルト
    return 'group';
  }

  // calculateImportance関数をインライン化
  function calculateImportance(element, rect) {
    let score = 0;
    
    // 位置による重要度（上部ほど重要）
    const viewportHeight = window.innerHeight;
    if (rect.top < viewportHeight * 0.2) score += 30;
    else if (rect.top < viewportHeight * 0.5) score += 20;
    else if (rect.top < viewportHeight) score += 10;
    
    // サイズによる重要度
    const area = rect.width * rect.height;
    const viewportArea = window.innerWidth * window.innerHeight;
    const areaRatio = area / viewportArea;
    
    if (areaRatio > 0.5) score += 30;
    else if (areaRatio > 0.3) score += 20;
    else if (areaRatio > 0.1) score += 10;
    else if (areaRatio > 0.05) score += 5;
    
    // セマンティックタイプによる重要度
    const semanticType = getSemanticType(element);
    const typeScores = {
      navigation: 25,
      content: 20,
      interactive: 15,
      section: 10,
      container: 5,
      group: 0
    };
    score += typeScores[semanticType] || 0;
    
    // 子要素の数による重要度
    const childCount = element.children.length;
    if (childCount > 10) score += 10;
    else if (childCount > 5) score += 5;
    
    // アクセシビリティ属性
    if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')) {
      score += 5;
    }
    
    return Math.min(100, score);
  }

  // detectPatterns関数をインライン化
  function detectPatterns(elements) {
    const patterns = [];
    const classGroups = {};
    
    // クラス名でグループ化
    elements.forEach(el => {
      if (el.className) {
        const classes = el.className.split(' ').filter(c => c.length > 0);
        classes.forEach(className => {
          if (!classGroups[className]) {
            classGroups[className] = [];
          }
          classGroups[className].push(el);
        });
      }
    });
    
    // パターンを検出
    Object.entries(classGroups).forEach(([className, els]) => {
      if (els.length >= 3) {
        // 同じクラスを持つ要素が3つ以上あればパターンとみなす
        const rects = els.map(el => el.rect || el.getBoundingClientRect());
        
        // 平均サイズを計算
        const avgWidth = rects.reduce((sum, r) => sum + r.width, 0) / rects.length;
        const avgHeight = rects.reduce((sum, r) => sum + r.height, 0) / rects.length;
        
        patterns.push({
          type: 'repeated',
          className: className,
          elements: els,
          averageSize: {
            width: avgWidth,
            height: avgHeight
          }
        });
      }
    });
    
    return patterns;
  }

  // detectSemanticGroups関数をインライン化
  function detectSemanticGroups(elements) {
    const groups = [];
    
    // 親子関係を解析
    function buildHierarchy(element, depth = 0) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      
      const semanticType = getSemanticType(element);
      const importance = calculateImportance(element, rect);
      
      // 重要度が低すぎる要素はスキップ
      if (importance < 10 && semanticType === 'content') return null;
      
      const node = {
        element,
        rect,
        role: semanticType,
        depth,
        children: [],
        semanticType,
        importance
      };
      
      // 子要素を処理
      const children = Array.from(element.children)
        .filter(child => {
          const style = window.getComputedStyle(child);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map(child => buildHierarchy(child, depth + 1))
        .filter(child => child !== null);
      
      node.children = children;
      
      return node;
    }
    
    // 意味のあるグループを抽出
    function extractGroups(node, parentGroup = null) {
      if (!node) return;
      
      const bounds = {
        x: node.rect.x,
        y: node.rect.y,
        width: node.rect.width,
        height: node.rect.height
      };
      
      // グループ化の条件
      const shouldCreateGroup = 
        node.semanticType === 'section' ||
        node.semanticType === 'navigation' ||
        node.semanticType === 'container' ||
        node.semanticType === 'group' ||
        node.importance > 30 ||
        node.children.length >= 3;
      
      if (shouldCreateGroup) {
        const group = {
          id: 'group-' + groups.length,
          type: node.semanticType,
          bounds,
          elements: [node.element],
          children: [],
          depth: node.depth,
          label: node.element.tagName + (node.element.className ? '.' + node.element.className.split(' ')[0] : ''),
          importance: node.importance
        };
        
        groups.push(group);
        
        // 子要素を処理
        node.children.forEach(child => {
          extractGroups(child, group);
        });
        
        if (parentGroup) {
          parentGroup.children.push(group);
        }
      } else {
        // グループ化しない場合は親グループに追加
        if (parentGroup) {
          parentGroup.elements.push(node.element);
          // 親グループの境界を更新
          parentGroup.bounds.x = Math.min(parentGroup.bounds.x, bounds.x);
          parentGroup.bounds.y = Math.min(parentGroup.bounds.y, bounds.y);
          const maxX = Math.max(parentGroup.bounds.x + parentGroup.bounds.width, bounds.x + bounds.width);
          const maxY = Math.max(parentGroup.bounds.y + parentGroup.bounds.height, bounds.y + bounds.height);
          parentGroup.bounds.width = maxX - parentGroup.bounds.x;
          parentGroup.bounds.height = maxY - parentGroup.bounds.y;
        }
        
        // 子要素を処理
        node.children.forEach(child => {
          extractGroups(child, parentGroup);
        });
      }
    }
    
    // ルート要素から階層を構築
    const root = buildHierarchy(document.body);
    if (root) {
      extractGroups(root);
    }
    
    // 重要度でソート
    groups.sort((a, b) => b.importance - a.importance);
    
    return groups;
  }
  
  // メイン処理
  const allElements = Array.from(document.querySelectorAll('*'))
    .filter(el => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && 
             style.visibility !== 'hidden' &&
             rect.width > 0 && 
             rect.height > 0;
    })
    .map(el => ({
      element: el,
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      rect: el.getBoundingClientRect(),
      text: el.textContent?.trim().substring(0, 50)
    }));
  
  const semanticGroups = detectSemanticGroups(allElements.map(el => el.element));
  const patterns = detectPatterns(allElements);
  
  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    },
    semanticGroups,
    patterns,
    totalElements: allElements.length,
    statistics: {
      groupCount: semanticGroups.length,
      patternCount: patterns.length,
      topLevelGroups: semanticGroups.filter(g => g.depth === 0).length
    }
  };
})()
`;
}