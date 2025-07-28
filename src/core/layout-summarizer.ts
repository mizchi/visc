import { ExtractedElement, ExtractedLayout, AccessibilityInfo } from './layout-extractor.js';

export interface SummarizedNode {
  id: string;
  type: string;
  semanticType: 'heading' | 'navigation' | 'content' | 'interactive' | 'structural' | 'media' | 'list' | 'table' | 'form';
  
  // 識別情報
  tagName: string;
  className?: string;
  text?: string;
  
  // 位置とサイズ
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // アクセシビリティ要約
  accessibility: {
    role?: string;
    label?: string; // aria-label, aria-labelledby, または text から生成
    interactive: boolean;
    focusable: boolean;
    hidden: boolean;
    state?: Record<string, any>; // expanded, selected, checked等
  };
  
  // 重要度スコア
  importance: number;
  
  // 子ノード数
  childCount: number;
}

export interface LayoutSummary {
  nodes: SummarizedNode[];
  groups: NodeGroup[];
  statistics: {
    totalNodes: number;
    bySemanticType: Record<string, number>;
    byRole: Record<string, number>;
    averageImportance: number;
  };
  viewport: {
    width: number;
    height: number;
  };
}

export interface NodeGroup {
  id: string;
  type: string;
  semanticRole: string;
  nodeIds: string[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * レイアウトを要約
 */
export function summarizeLayout(layout: ExtractedLayout): LayoutSummary {
  const nodes: SummarizedNode[] = [];
  let nodeId = 0;
  
  // ノードの処理
  function processElement(element: ExtractedElement, parentVisible: boolean = true): void {
    const isElementVisible = parentVisible && element.isVisible;
    
    // セマンティックタイプを判定
    const semanticType = getSemanticType(element);
    
    // アクセシビリティ要約を生成
    const accessibilitySummary = summarizeAccessibility(element);
    
    // 重要度を計算
    const importance = calculateImportance(element, semanticType, layout.viewport);
    
    const node: SummarizedNode = {
      id: `node_${nodeId++}`,
      type: element.tagName,
      semanticType,
      tagName: element.tagName,
      className: element.className,
      text: element.text,
      position: {
        x: element.bounds.x,
        y: element.bounds.y,
        width: element.bounds.width,
        height: element.bounds.height
      },
      accessibility: accessibilitySummary,
      importance,
      childCount: element.children?.length || 0
    };
    
    nodes.push(node);
    
    // 子要素を処理
    if (element.children) {
      for (const child of element.children) {
        processElement(child, isElementVisible);
      }
    }
  }
  
  // 全要素を処理
  for (const element of layout.elements) {
    processElement(element);
  }
  
  // 重要度でソート
  nodes.sort((a, b) => b.importance - a.importance);
  
  // グループを生成
  const groups = generateGroups(nodes);
  
  // 統計情報を計算
  const statistics = calculateStatistics(nodes);
  
  return {
    nodes,
    groups,
    statistics,
    viewport: layout.viewport
  };
}

/**
 * セマンティックタイプを判定
 */
function getSemanticType(element: ExtractedElement): SummarizedNode['semanticType'] {
  const tag = element.tagName.toLowerCase();
  const role = element.accessibility.role;
  const className = element.className?.toLowerCase() || '';
  
  // ヘッディング
  if (/^h[1-6]$/.test(tag) || role === 'heading') return 'heading';
  
  // ナビゲーション
  if (tag === 'nav' || role === 'navigation' || 
      className.includes('nav') || className.includes('menu')) {
    return 'navigation';
  }
  
  // フォーム
  if (tag === 'form' || role === 'form' || className.includes('form')) {
    return 'form';
  }
  
  // インタラクティブ要素
  if (['button', 'a', 'input', 'textarea', 'select'].includes(tag) ||
      ['button', 'link', 'textbox', 'checkbox', 'radio'].includes(role || '')) {
    return 'interactive';
  }
  
  // メディア
  if (['img', 'video', 'audio', 'svg', 'picture', 'canvas'].includes(tag) ||
      role === 'img') {
    return 'media';
  }
  
  // リスト
  if (['ul', 'ol', 'li', 'dl', 'dt', 'dd'].includes(tag) ||
      ['list', 'listitem'].includes(role || '')) {
    return 'list';
  }
  
  // テーブル
  if (['table', 'thead', 'tbody', 'tr', 'td', 'th'].includes(tag) ||
      role === 'table') {
    return 'table';
  }
  
  // コンテンツ
  if (['p', 'article', 'section', 'main'].includes(tag) || 
      element.text && element.text.length > 20) {
    return 'content';
  }
  
  // 構造的要素
  return 'structural';
}

/**
 * アクセシビリティ情報を要約
 */
function summarizeAccessibility(element: ExtractedElement): SummarizedNode['accessibility'] {
  const acc = element.accessibility;
  
  // ラベルの決定（優先順位: aria-label > aria-labelledby > text）
  let label: string | undefined;
  if (acc.ariaLabel) {
    label = acc.ariaLabel;
  } else if (acc.ariaLabelledBy) {
    label = `[labelledby: ${acc.ariaLabelledBy}]`;
  } else if (element.text) {
    label = element.text.substring(0, 100);
  }
  
  // インタラクティブかどうか
  const interactiveTags = ['button', 'a', 'input', 'textarea', 'select'];
  const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'];
  const interactive = interactiveTags.includes(element.tagName) ||
                     interactiveRoles.includes(acc.role || '');
  
  // フォーカス可能かどうか
  const focusable = interactive || (acc.tabIndex !== undefined && acc.tabIndex >= 0);
  
  // 状態情報
  const state: Record<string, any> = {};
  if (acc.ariaExpanded !== undefined) state.expanded = acc.ariaExpanded;
  if (acc.ariaSelected !== undefined) state.selected = acc.ariaSelected;
  if (acc.ariaChecked !== undefined) state.checked = acc.ariaChecked;
  if (acc.ariaDisabled !== undefined) state.disabled = acc.ariaDisabled;
  if (acc.ariaValueNow !== undefined) {
    state.value = {
      now: acc.ariaValueNow,
      min: acc.ariaValueMin,
      max: acc.ariaValueMax,
      text: acc.ariaValueText
    };
  }
  
  return {
    role: acc.role,
    label,
    interactive,
    focusable,
    hidden: acc.ariaHidden === true,
    state: Object.keys(state).length > 0 ? state : undefined
  };
}

/**
 * 重要度を計算
 */
function calculateImportance(
  element: ExtractedElement, 
  semanticType: SummarizedNode['semanticType'],
  viewport: { width: number; height: number }
): number {
  let importance = 0;
  
  // セマンティックタイプによる基本スコア
  const typeScores = {
    heading: 80,
    navigation: 70,
    form: 65,
    interactive: 60,
    content: 50,
    media: 40,
    list: 30,
    table: 30,
    structural: 20
  };
  importance += typeScores[semanticType];
  
  // サイズによるスコア
  const area = element.bounds.width * element.bounds.height;
  const viewportArea = viewport.width * viewport.height;
  const sizeRatio = area / viewportArea;
  importance += Math.min(sizeRatio * 100, 20);
  
  // 位置によるスコア（上部にある要素ほど重要）
  const yRatio = element.bounds.y / viewport.height;
  importance += Math.max(0, 10 - yRatio * 10);
  
  // アクセシビリティによる加点
  if (element.accessibility.role) importance += 5;
  if (element.accessibility.ariaLabel) importance += 5;
  if (element.accessibility.tabIndex === 0) importance += 10;
  
  // ID/クラス名による加点
  if (element.id) importance += 5;
  if (element.className?.includes('primary') || 
      element.className?.includes('main') ||
      element.className?.includes('hero')) {
    importance += 10;
  }
  
  // 可視性による調整
  if (!element.isVisible) importance *= 0.1;
  if (element.opacity < 1) importance *= element.opacity;
  
  return Math.min(100, Math.round(importance));
}

/**
 * 近接する同種の要素をグループ化
 */
function generateGroups(nodes: SummarizedNode[]): NodeGroup[] {
  const groups: NodeGroup[] = [];
  const processedNodes = new Set<string>();
  let groupId = 0;
  
  for (const node of nodes) {
    if (processedNodes.has(node.id)) continue;
    
    const group: NodeGroup = {
      id: `group_${groupId++}`,
      type: node.semanticType,
      semanticRole: node.accessibility.role || node.semanticType,
      nodeIds: [node.id],
      bounds: { ...node.position }
    };
    
    processedNodes.add(node.id);
    
    // 近接する同種のノードを探す
    for (const otherNode of nodes) {
      if (processedNodes.has(otherNode.id)) continue;
      if (otherNode.semanticType !== node.semanticType) continue;
      
      // 距離を計算
      const distance = Math.sqrt(
        Math.pow(otherNode.position.x - node.position.x, 2) +
        Math.pow(otherNode.position.y - node.position.y, 2)
      );
      
      // 近接している場合（100px以内）
      if (distance < 100) {
        group.nodeIds.push(otherNode.id);
        processedNodes.add(otherNode.id);
        
        // グループの境界を更新
        group.bounds.x = Math.min(group.bounds.x, otherNode.position.x);
        group.bounds.y = Math.min(group.bounds.y, otherNode.position.y);
        group.bounds.width = Math.max(
          group.bounds.x + group.bounds.width,
          otherNode.position.x + otherNode.position.width
        ) - group.bounds.x;
        group.bounds.height = Math.max(
          group.bounds.y + group.bounds.height,
          otherNode.position.y + otherNode.position.height
        ) - group.bounds.y;
      }
    }
    
    groups.push(group);
  }
  
  return groups;
}

/**
 * 統計情報を計算
 */
function calculateStatistics(nodes: SummarizedNode[]): LayoutSummary['statistics'] {
  const bySemanticType: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  let totalImportance = 0;
  
  for (const node of nodes) {
    // セマンティックタイプ別
    bySemanticType[node.semanticType] = (bySemanticType[node.semanticType] || 0) + 1;
    
    // ロール別
    if (node.accessibility.role) {
      byRole[node.accessibility.role] = (byRole[node.accessibility.role] || 0) + 1;
    }
    
    totalImportance += node.importance;
  }
  
  return {
    totalNodes: nodes.length,
    bySemanticType,
    byRole,
    averageImportance: nodes.length > 0 ? totalImportance / nodes.length : 0
  };
}