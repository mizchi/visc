import { SemanticElement } from './semantic-layout.js';

export interface SummaryNode {
  id: string;
  type: string;
  role?: string;
  className?: string;
  ariaLabel?: string;
  text?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  semanticType: 'heading' | 'navigation' | 'content' | 'interactive' | 'structural' | 'media' | 'list' | 'table';
  importance: number;
  childCount: number;
}

export interface SemanticSummary {
  nodes: SummaryNode[];
  groups: SummaryGroup[];
  totalElements: number;
  viewport: {
    width: number;
    height: number;
  };
}

export interface SummaryGroup {
  id: string;
  type: string;
  nodeIds: string[];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  semanticRole: string;
}

/**
 * セマンティック要素を要約されたノードに変換
 */
export function summarizeSemanticLayout(elements: SemanticElement[], viewport?: { width: number; height: number }): SemanticSummary {
  const nodes: SummaryNode[] = [];
  let nodeId = 0;

  // セマンティックタイプを判定
  function getSemanticType(element: SemanticElement): SummaryNode['semanticType'] {
    const tag = element.tagName.toLowerCase();
    
    // ヘッディング
    if (/^h[1-6]$/.test(tag)) return 'heading';
    
    // ナビゲーション
    const classStr = typeof element.className === 'string' ? element.className : '';
    if (tag === 'nav' || classStr.includes('nav') || classStr.includes('menu')) {
      return 'navigation';
    }
    
    // インタラクティブ要素
    if (['button', 'a', 'input', 'textarea', 'select', 'form'].includes(tag)) {
      return 'interactive';
    }
    
    // メディア
    if (['img', 'video', 'audio', 'svg', 'picture'].includes(tag)) {
      return 'media';
    }
    
    // リスト
    if (['ul', 'ol', 'li'].includes(tag)) {
      return 'list';
    }
    
    // テーブル
    if (['table', 'thead', 'tbody', 'tr', 'td', 'th'].includes(tag)) {
      return 'table';
    }
    
    // コンテンツ
    if (['p', 'article', 'section', 'main'].includes(tag) || element.text) {
      return 'content';
    }
    
    // 構造的要素
    return 'structural';
  }

  // 重要度を計算
  function calculateImportance(element: SemanticElement, semanticType: SummaryNode['semanticType']): number {
    const classStr = typeof element.className === 'string' ? element.className : '';
    let importance = 0;
    
    // セマンティックタイプによる基本スコア
    const typeScores = {
      heading: 80,
      navigation: 70,
      interactive: 60,
      content: 50,
      media: 40,
      list: 30,
      table: 30,
      structural: 20
    };
    importance += typeScores[semanticType];
    
    // サイズによるスコア（大きい要素ほど重要）
    const area = element.width * element.height;
    const viewportArea = (viewport?.width || 1280) * (viewport?.height || 720);
    const sizeRatio = area / viewportArea;
    importance += Math.min(sizeRatio * 100, 20);
    
    // 位置によるスコア（上部にある要素ほど重要）
    const yRatio = element.y / (viewport?.height || 720);
    importance += Math.max(0, 10 - yRatio * 10);
    
    // ID/クラス名による加点
    if (element.id) importance += 5;
    if (classStr.includes('primary')) importance += 5;
    if (classStr.includes('main')) importance += 5;
    
    return Math.min(100, Math.round(importance));
  }

  // 要素をフラットに展開して処理
  function processElement(element: SemanticElement) {
    const semanticType = getSemanticType(element);
    const importance = calculateImportance(element, semanticType);
    
    const node: SummaryNode = {
      id: `node_${nodeId++}`,
      type: element.tagName,
      className: element.className,
      text: element.text,
      position: {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height
      },
      semanticType,
      importance,
      childCount: element.children?.length || 0
    };
    
    nodes.push(node);
    
    // 子要素も再帰的に処理
    if (element.children) {
      for (const child of element.children) {
        processElement(child);
      }
    }
  }

  // 全要素を処理
  for (const element of elements) {
    processElement(element);
  }

  // 重要度でソート
  nodes.sort((a, b) => b.importance - a.importance);

  // グループを生成（近接する同種の要素をグループ化）
  const groups = generateGroups(nodes);

  return {
    nodes,
    groups,
    totalElements: nodes.length,
    viewport: viewport || { width: 1280, height: 720 }
  };
}

/**
 * 近接する同種の要素をグループ化
 */
function generateGroups(nodes: SummaryNode[]): SummaryGroup[] {
  const groups: SummaryGroup[] = [];
  const processedNodes = new Set<string>();
  let groupId = 0;

  // 同じセマンティックタイプで近接するノードをグループ化
  for (const node of nodes) {
    if (processedNodes.has(node.id)) continue;

    const group: SummaryGroup = {
      id: `group_${groupId++}`,
      type: node.semanticType,
      nodeIds: [node.id],
      bounds: { ...node.position },
      semanticRole: node.semanticType
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
 * 要約データの比較
 */
export function compareSummaries(summary1: SemanticSummary, summary2: SemanticSummary): {
  matched: number;
  added: number;
  removed: number;
  moved: number;
  similarity: number;
} {
  const nodes1 = new Map(summary1.nodes.map(n => [`${n.type}_${n.className || ''}_${n.text?.substring(0, 20) || ''}`, n]));
  const nodes2 = new Map(summary2.nodes.map(n => [`${n.type}_${n.className || ''}_${n.text?.substring(0, 20) || ''}`, n]));

  let matched = 0;
  let moved = 0;

  // マッチングを確認
  for (const [key, node1] of nodes1) {
    const node2 = nodes2.get(key);
    if (node2) {
      // 位置の差分を確認
      const positionDiff = Math.abs(node1.position.x - node2.position.x) +
                          Math.abs(node1.position.y - node2.position.y);
      
      if (positionDiff < 10) {
        matched++;
      } else {
        moved++;
      }
    }
  }

  const added = nodes2.size - matched - moved;
  const removed = nodes1.size - matched - moved;
  const total = Math.max(nodes1.size, nodes2.size);
  const similarity = total > 0 ? (matched / total) * 100 : 100;

  return {
    matched,
    added,
    removed,
    moved,
    similarity
  };
}