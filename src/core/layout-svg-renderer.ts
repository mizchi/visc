import { LayoutSummary, SummarizedNode, NodeGroup } from './layout-summarizer.js';

export interface SVGRenderOptions {
  width?: number;
  height?: number;
  showLabels?: boolean;
  showImportance?: boolean;
  showGroups?: boolean;
  colorScheme?: 'semantic' | 'importance' | 'monochrome';
  fontSize?: number;
  strokeWidth?: number;
  padding?: number;
}

/**
 * レイアウトサマリーをSVGとしてレンダリング
 */
export function renderLayoutToSVG(
  summary: LayoutSummary,
  options: SVGRenderOptions = {}
): string {
  const {
    width = summary.viewport.width,
    height = summary.viewport.height,
    showLabels = true,
    showImportance = true,
    showGroups = true,
    colorScheme = 'semantic',
    fontSize = 12,
    strokeWidth = 1,
    padding = 20
  } = options;

  const svgWidth = width + padding * 2;
  const svgHeight = height + padding * 2;

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .node-rect { fill-opacity: 0.3; stroke-opacity: 0.8; }
    .node-label { font-family: Arial, sans-serif; font-size: ${fontSize}px; }
    .importance-label { font-size: ${fontSize * 0.8}px; fill: #666; }
    .group-rect { fill: none; stroke-dasharray: 5,5; stroke-opacity: 0.5; }
    .group-label { font-size: ${fontSize * 0.9}px; fill: #999; }
  </style>
  <defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f0f0" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${svgWidth}" height="${svgHeight}" fill="white"/>
  <rect x="${padding}" y="${padding}" width="${width}" height="${height}" fill="url(#grid)"/>
`;

  // グループを描画
  if (showGroups && summary.groups.length > 0) {
    svg += '\n  <!-- Groups -->\n';
    svg += `  <g class="groups">\n`;
    for (const group of summary.groups) {
      const color = getGroupColor(group.type);
      svg += renderGroup(group, color, padding);
    }
    svg += `  </g>\n`;
  }

  // ノードを重要度順に描画（重要度が低いものから）
  svg += '\n  <!-- Nodes -->\n';
  svg += `  <g class="nodes">\n`;
  const sortedNodes = [...summary.nodes].sort((a, b) => a.importance - b.importance);
  
  for (const node of sortedNodes) {
    const color = getNodeColor(node, colorScheme);
    svg += renderNode(node, color, {
      showLabels,
      showImportance,
      fontSize,
      strokeWidth,
      padding
    });
  }
  svg += `  </g>\n`;

  // 統計情報を表示
  svg += renderStatistics(summary, padding, svgHeight - padding - 100);

  svg += '</svg>';

  return svg;
}

/**
 * ノードを描画
 */
function renderNode(
  node: SummarizedNode,
  color: string,
  options: {
    showLabels: boolean;
    showImportance: boolean;
    fontSize: number;
    strokeWidth: number;
    padding: number;
  }
): string {
  const { showLabels, showImportance, fontSize, strokeWidth, padding } = options;
  const x = node.position.x + padding;
  const y = node.position.y + padding;
  const { width, height } = node.position;

  let svg = `    <g class="node" data-id="${node.id}">\n`;
  
  // 矩形を描画
  svg += `      <rect class="node-rect" x="${x}" y="${y}" width="${width}" height="${height}" `;
  svg += `fill="${color}" stroke="${color}" stroke-width="${strokeWidth}" `;
  
  // アクセシビリティ情報をツールチップとして追加
  const tooltip = createTooltip(node);
  svg += `>\n        <title>${escapeXML(tooltip)}</title>\n      </rect>\n`;

  // ラベルを描画
  if (showLabels && (width > 30 && height > 20)) {
    const label = createLabel(node);
    const labelX = x + width / 2;
    const labelY = y + height / 2;
    
    svg += `      <text class="node-label" x="${labelX}" y="${labelY}" `;
    svg += `text-anchor="middle" dominant-baseline="middle" fill="black">\n`;
    svg += `        ${escapeXML(label)}\n`;
    svg += `      </text>\n`;
  }

  // 重要度を表示
  if (showImportance && node.importance > 50 && width > 40) {
    const impX = x + width - 5;
    const impY = y + fontSize;
    svg += `      <text class="importance-label" x="${impX}" y="${impY}" `;
    svg += `text-anchor="end">${node.importance}</text>\n`;
  }

  svg += `    </g>\n`;
  
  return svg;
}

/**
 * グループを描画
 */
function renderGroup(group: NodeGroup, color: string, padding: number): string {
  const x = group.bounds.x + padding;
  const y = group.bounds.y + padding;
  const { width, height } = group.bounds;

  let svg = `    <g class="group" data-id="${group.id}">\n`;
  svg += `      <rect class="group-rect" x="${x}" y="${y}" width="${width}" height="${height}" `;
  svg += `stroke="${color}" stroke-width="2"/>\n`;
  
  // グループラベル
  const labelX = x + 5;
  const labelY = y - 5;
  svg += `      <text class="group-label" x="${labelX}" y="${labelY}">${group.type}</text>\n`;
  
  svg += `    </g>\n`;
  
  return svg;
}

/**
 * 統計情報を描画
 */
function renderStatistics(summary: LayoutSummary, x: number, y: number): string {
  let svg = '\n  <!-- Statistics -->\n';
  svg += `  <g class="statistics" transform="translate(${x}, ${y})">\n`;
  
  svg += `    <text y="0" font-size="14" font-weight="bold">Statistics</text>\n`;
  svg += `    <text y="20" font-size="12">Total Nodes: ${summary.statistics.totalNodes}</text>\n`;
  svg += `    <text y="35" font-size="12">Average Importance: ${summary.statistics.averageImportance.toFixed(1)}</text>\n`;
  
  // セマンティックタイプの分布
  let yOffset = 55;
  for (const [type, count] of Object.entries(summary.statistics.bySemanticType)) {
    const color = getSemanticTypeColor(type);
    svg += `    <rect x="0" y="${yOffset - 10}" width="10" height="10" fill="${color}"/>\n`;
    svg += `    <text x="15" y="${yOffset}" font-size="11">${type}: ${count}</text>\n`;
    yOffset += 15;
  }
  
  svg += `  </g>\n`;
  
  return svg;
}

/**
 * ノードの色を取得
 */
function getNodeColor(node: SummarizedNode, colorScheme: string): string {
  switch (colorScheme) {
    case 'semantic':
      return getSemanticTypeColor(node.semanticType);
    case 'importance':
      return getImportanceColor(node.importance);
    case 'monochrome':
      return '#666666';
    default:
      return '#999999';
  }
}

/**
 * セマンティックタイプに基づく色
 */
function getSemanticTypeColor(type: string): string {
  const colors: Record<string, string> = {
    heading: '#FF6B6B',
    navigation: '#4ECDC4',
    content: '#45B7D1',
    interactive: '#96CEB4',
    media: '#DDA0DD',
    list: '#FFD93D',
    table: '#F4A460',
    form: '#98D8C8',
    structural: '#CCCCCC'
  };
  return colors[type] || '#999999';
}

/**
 * グループタイプに基づく色
 */
function getGroupColor(type: string): string {
  return getSemanticTypeColor(type);
}

/**
 * 重要度に基づく色（グラデーション）
 */
function getImportanceColor(importance: number): string {
  // 0-100 を RGB グラデーションに変換
  const hue = (1 - importance / 100) * 240; // 240 (青) から 0 (赤) へ
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * ノードのラベルを作成
 */
function createLabel(node: SummarizedNode): string {
  if (node.text && node.text.length > 0) {
    return node.text.length > 20 ? node.text.substring(0, 17) + '...' : node.text;
  }
  
  if (node.accessibility.label) {
    const label = node.accessibility.label;
    return label.length > 20 ? label.substring(0, 17) + '...' : label;
  }
  
  if (node.className) {
    const className = node.className.split(' ')[0];
    return `.${className}`;
  }
  
  return node.tagName;
}

/**
 * ツールチップ用のテキストを作成
 */
function createTooltip(node: SummarizedNode): string {
  const lines: string[] = [];
  
  lines.push(`Type: ${node.semanticType}`);
  lines.push(`Tag: ${node.tagName}`);
  
  if (node.id) lines.push(`ID: ${node.id}`);
  if (node.className) lines.push(`Class: ${node.className}`);
  if (node.text) lines.push(`Text: ${node.text.substring(0, 50)}`);
  
  lines.push(`Position: ${node.position.x}, ${node.position.y}`);
  lines.push(`Size: ${node.position.width}x${node.position.height}`);
  lines.push(`Importance: ${node.importance}`);
  
  if (node.accessibility.role) {
    lines.push(`Role: ${node.accessibility.role}`);
  }
  if (node.accessibility.label) {
    lines.push(`Label: ${node.accessibility.label}`);
  }
  if (node.accessibility.interactive) {
    lines.push('Interactive: Yes');
  }
  
  return lines.join('\n');
}

/**
 * XMLエスケープ
 */
function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * インタラクティブなSVGを生成（クリック可能な要素）
 */
export function renderInteractiveSVG(
  summary: LayoutSummary,
  options: SVGRenderOptions & { 
    onClick?: (nodeId: string) => void;
    onHover?: (nodeId: string) => void;
  } = {}
): string {
  let svg = renderLayoutToSVG(summary, options);
  
  // インタラクティブなスタイルとスクリプトを追加
  const interactiveStyles = `
    .node { cursor: pointer; }
    .node:hover .node-rect { fill-opacity: 0.5; stroke-width: 2; }
    .selected .node-rect { stroke-width: 3; stroke: #FF0000; }
  `;
  
  const script = `
    <script>
      document.querySelectorAll('.node').forEach(node => {
        node.addEventListener('click', (e) => {
          const nodeId = node.getAttribute('data-id');
          console.log('Clicked node:', nodeId);
          document.querySelectorAll('.selected').forEach(n => n.classList.remove('selected'));
          node.classList.add('selected');
        });
      });
    </script>
  `;
  
  // スタイルとスクリプトを挿入
  svg = svg.replace('</style>', interactiveStyles + '</style>');
  svg = svg.replace('</svg>', script + '</svg>');
  
  return svg;
}