/**
 * V2 Layout Summarizer - レイアウト要約機能
 */

import { 
  ExtractedLayout, 
  ExtractedElement, 
  LayoutSummary, 
  SummarizedNode, 
  NodeGroup,
  SemanticType 
} from '../types/index.js';

/**
 * レイアウトを要約
 */
export function summarizeLayout(layout: ExtractedLayout): LayoutSummary {
  const nodes: SummarizedNode[] = [];
  const nodeMap = new Map<string, SummarizedNode>();
  
  // 要素をフラットに展開して要約
  const processElement = (element: ExtractedElement, depth: number = 0) => {
    const semanticType = determineSemanticType(element);
    const importance = calculateImportance(element, semanticType, depth);
    
    const node: SummarizedNode = {
      id: `node_${nodes.length}`,
      type: element.tagName,
      semanticType,
      tagName: element.tagName,
      className: element.className,
      text: element.textContent,
      position: element.position,
      accessibility: {
        role: element.accessibility.role,
        label: element.accessibility.ariaLabel || element.textContent?.substring(0, 100),
        interactive: isInteractive(element),
        focusable: isFocusable(element),
        hidden: element.accessibility.ariaHidden || false,
        state: collectAccessibilityState(element.accessibility)
      },
      importance,
      childCount: element.children.length
    };
    
    nodes.push(node);
    nodeMap.set(node.id, node);
    
    // 子要素も処理
    for (const child of element.children) {
      processElement(child, depth + 1);
    }
  };
  
  for (const element of layout.elements) {
    processElement(element);
  }
  
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
function determineSemanticType(element: ExtractedElement): SemanticType {
  const tag = element.tagName;
  const role = element.accessibility.role;
  
  // ヘッディング
  if (/^h[1-6]$/.test(tag) || role === 'heading') {
    return 'heading';
  }
  
  // ナビゲーション
  if (tag === 'nav' || role === 'navigation' || 
      element.className?.includes('nav') || 
      element.className?.includes('menu')) {
    return 'navigation';
  }
  
  // インタラクティブ
  if (['a', 'button', 'input', 'select', 'textarea'].includes(tag) ||
      role === 'button' || role === 'link' || role === 'textbox') {
    return 'interactive';
  }
  
  // メディア
  if (['img', 'video', 'audio', 'picture', 'svg'].includes(tag) ||
      role === 'img') {
    return 'media';
  }
  
  // リスト
  if (['ul', 'ol', 'dl'].includes(tag) || role === 'list') {
    return 'list';
  }
  
  // テーブル
  if (tag === 'table' || role === 'table') {
    return 'table';
  }
  
  // フォーム
  if (tag === 'form' || role === 'form') {
    return 'form';
  }
  
  // コンテンツ
  if (['p', 'article', 'section', 'main'].includes(tag) ||
      role === 'article' || role === 'main') {
    return 'content';
  }
  
  // その他は構造的要素
  return 'structural';
}

/**
 * 重要度を計算
 */
function calculateImportance(
  element: ExtractedElement, 
  semanticType: SemanticType,
  depth: number
): number {
  let importance = 50; // 基本スコア
  
  // セマンティックタイプによる重み
  const typeWeights: Record<SemanticType, number> = {
    heading: 30,
    navigation: 20,
    interactive: 15,
    content: 10,
    media: 10,
    form: 15,
    list: 5,
    table: 5,
    structural: 0
  };
  importance += typeWeights[semanticType];
  
  // サイズによる重み（大きいほど重要）
  const area = element.position.width * element.position.height;
  const viewportArea = 1280 * 720; // 仮定のビューポートサイズ
  const sizeRatio = Math.min(area / viewportArea, 1);
  importance += sizeRatio * 20;
  
  // 位置による重み（上部ほど重要）
  const positionScore = Math.max(0, 1 - element.position.y / 720);
  importance += positionScore * 10;
  
  // 深さによる減点（深いほど重要度が下がる）
  importance -= Math.min(depth * 2, 20);
  
  // アクセシビリティ情報がある場合は加点
  if (element.accessibility.role || element.accessibility.ariaLabel) {
    importance += 5;
  }
  
  // テキストがある場合は加点
  if (element.textContent && element.textContent.length > 0) {
    importance += Math.min(element.textContent.length / 10, 10);
  }
  
  return Math.max(0, Math.min(100, Math.round(importance)));
}

/**
 * インタラクティブかどうかを判定
 */
function isInteractive(element: ExtractedElement): boolean {
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
  const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio'];
  
  return interactiveTags.includes(element.tagName) ||
         (element.accessibility.role && interactiveRoles.includes(element.accessibility.role)) ||
         element.accessibility.tabIndex !== undefined;
}

/**
 * フォーカス可能かどうかを判定
 */
function isFocusable(element: ExtractedElement): boolean {
  if (element.accessibility.tabIndex !== undefined) {
    return element.accessibility.tabIndex >= 0;
  }
  
  const focusableTags = ['a', 'button', 'input', 'select', 'textarea'];
  return focusableTags.includes(element.tagName);
}

/**
 * アクセシビリティ状態を収集
 */
function collectAccessibilityState(accessibility: ExtractedElement['accessibility']): Record<string, any> {
  const state: Record<string, any> = {};
  
  if (accessibility.ariaExpanded !== undefined) {
    state.expanded = accessibility.ariaExpanded;
  }
  if (accessibility.ariaSelected !== undefined) {
    state.selected = accessibility.ariaSelected;
  }
  if (accessibility.ariaChecked !== undefined) {
    state.checked = accessibility.ariaChecked;
  }
  if (accessibility.ariaDisabled !== undefined) {
    state.disabled = accessibility.ariaDisabled;
  }
  if (accessibility.ariaValueNow !== undefined) {
    state.value = {
      now: accessibility.ariaValueNow,
      min: accessibility.ariaValueMin,
      max: accessibility.ariaValueMax,
      text: accessibility.ariaValueText
    };
  }
  
  return Object.keys(state).length > 0 ? state : {};
}

/**
 * グループを生成
 */
function generateGroups(nodes: SummarizedNode[]): NodeGroup[] {
  const groups: NodeGroup[] = [];
  const typeGroups = new Map<string, SummarizedNode[]>();
  
  // セマンティックタイプでグループ化
  for (const node of nodes) {
    const key = `${node.semanticType}_${Math.floor(node.position.y / 100)}`;
    if (!typeGroups.has(key)) {
      typeGroups.set(key, []);
    }
    typeGroups.get(key)!.push(node);
  }
  
  // グループを作成
  for (const [key, groupNodes] of typeGroups) {
    if (groupNodes.length < 2) continue;
    
    const [type] = key.split('_');
    const bounds = calculateBounds(groupNodes.map(n => n.position));
    
    groups.push({
      id: `group_${groups.length}`,
      type,
      nodeIds: groupNodes.map(n => n.id),
      bounds,
      semanticRole: type
    });
  }
  
  return groups;
}

/**
 * 境界を計算
 */
function calculateBounds(positions: SummarizedNode['position'][]): NodeGroup['bounds'] {
  if (positions.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const pos of positions) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  }
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
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