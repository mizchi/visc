import type { VisualTreeAnalysis, VisualNodeGroup, VisualNode } from '../types.js';

const typeColorMap: Record<string, string> = {
  navigation: '#4A90E2', // Blue
  interactive: '#F5A623', // Orange
  section: '#50E3C2',     // Teal
  container: '#BD10E0',   // Purple
  group: '#9013FE',       // Violet
  content: '#B8E986',     // Light Green
  root: '#E8E8E8',        // Light Gray
  default: '#9B9B9B',      // Gray
};

function getElementColor(element: VisualNodeGroup | VisualNode): string {
  if ('type' in element && element.type) {
    return typeColorMap[element.type] || typeColorMap.default;
  }
  if ('tagName' in element) {
    // A simple heuristic for visual nodes if they don't have a node type
    const tagName = element.tagName.toLowerCase();
    if (['nav', 'header', 'footer'].includes(tagName)) return typeColorMap.navigation;
    if (['button', 'a', 'input'].includes(tagName)) return typeColorMap.interactive;
    if (['main', 'section', 'article'].includes(tagName)) return typeColorMap.section;
  }
  return typeColorMap.default;
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function createRectElement(rect: { x: number; y: number; width: number; height: number; }, color: string): string {
  // 負の高さ・幅を防ぐ
  const safeRect = {
    x: rect.x,
    y: rect.y,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height)
  };
  return `<rect x="${safeRect.x}" y="${safeRect.y}" width="${safeRect.width}" height="${safeRect.height}" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2" />`;
}

function createTextElement(text: string, rect: { x: number; y: number; width: number; height: number; }, color: string): string {
  const fontSize = Math.max(8, Math.min(14, rect.height * 0.5));
  const yPos = rect.y + fontSize;
  return `<text x="${rect.x + 5}" y="${yPos}" font-family="sans-serif" font-size="${fontSize}" fill="${color}" dy=".3em">${escapeXml(text)}</text>`;
}

export interface RenderOptions {
  ignoreElements?: string[];
  showLabels?: boolean;
}

/**
 * 要素が無視リストにマッチするかチェック
 */
function shouldIgnoreElement(element: VisualNode, ignoreSelectors: string[]): boolean {
  if (!ignoreSelectors || ignoreSelectors.length === 0) return false;
  
  for (const selector of ignoreSelectors) {
    // IDセレクタ
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      if (element.id === id) return true;
    }
    // クラスセレクタ
    else if (selector.startsWith('.')) {
      const className = selector.substring(1);
      if (element.className && element.className.includes(className)) return true;
    }
    // タグセレクタ
    else if (!selector.includes('#') && !selector.includes('.')) {
      if (element.tagName && element.tagName.toLowerCase() === selector.toLowerCase()) return true;
    }
    // 複合セレクタ（簡易的な実装）
    else {
      const parts = selector.match(/^(\w+)?(#[\w-]+)?(\.[\w-]+)?$/);
      if (parts) {
        const [, tag, id, className] = parts;
        let matches = true;
        
        if (tag && element.tagName?.toLowerCase() !== tag.toLowerCase()) matches = false;
        if (id && element.id !== id.substring(1)) matches = false;
        if (className && (!element.className || !element.className.includes(className.substring(1)))) matches = false;
        
        if (matches) return true;
      }
    }
  }
  
  return false;
}

export function renderLayoutToSvg(analysisResult: VisualTreeAnalysis, options: RenderOptions = {}): string {
  const { viewport, visualNodeGroups, elements } = analysisResult;
  const viewportWidth = viewport.width || 1280;
  const viewportHeight = viewport.height || 800;

  let svgElements: string[] = [];
  
  // Calculate actual content bounds
  let minX = 0, minY = 0, maxX = viewportWidth, maxY = viewportHeight;
  
  const updateBounds = (rect: { x: number; y: number; width: number; height: number; }) => {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  };

  // Render visual node groups first as background areas
  if (visualNodeGroups) {
    const traverse = (group: VisualNodeGroup | VisualNode) => {
      // VisualNodeの場合、無視チェック
      if ('tagName' in group && options.ignoreElements && shouldIgnoreElement(group as VisualNode, options.ignoreElements)) {
        return;
      }
      
      // VisualNodeGroupの場合、ラベルベースの無視チェック
      if ('type' in group && 'label' in group && options.ignoreElements) {
        const labelSelector = `[data-visual-label="${group.label}"]`;
        if (options.ignoreElements.includes(labelSelector)) {
          return;
        }
      }
      
      const color = getElementColor(group);
      if ('bounds' in group) {
        updateBounds(group.bounds);
        svgElements.push(createRectElement(group.bounds, color));
        const label = `${group.type}: ${group.label || ''}`;
        svgElements.push(createTextElement(label, group.bounds, color));
      }
      if (group.children) {
        group.children.forEach((child: VisualNodeGroup | VisualNode) => traverse(child));
      }
    };
    visualNodeGroups.forEach(traverse);
  } else if (elements) {
    // Fallback to rendering individual elements if no visual node groups
    elements.forEach((element: VisualNode) => {
      // 無視要素はスキップ
      if (options.ignoreElements && shouldIgnoreElement(element, options.ignoreElements)) {
        return;
      }
      
      const color = getElementColor(element);
      updateBounds(element.rect);
      svgElements.push(createRectElement(element.rect, color));
      const label = element.text || element.tagName;
      if (label) {
        svgElements.push(createTextElement(label.substring(0, 50), element.rect, color));
      }
    });
  }
  
  // Calculate viewBox to show all content
  const contentWidth = Math.max(viewportWidth, maxX - minX);
  const contentHeight = Math.max(viewportHeight, maxY - minY);
  const viewBox = `${minX} ${minY} ${contentWidth} ${contentHeight}`;
  
  // SVGの実際のサイズを計算（アスペクト比を保持）
  // コンテンツが大きい場合は、最大幅1280pxに制限し、高さは比例して調整
  const maxSvgWidth = 1280;
  const aspectRatio = contentHeight / contentWidth;
  const svgWidth = Math.min(maxSvgWidth, contentWidth);
  const svgHeight = svgWidth * aspectRatio;

  return `
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
      <style>
        rect { transition: all 0.3s ease; }
        text { transition: all 0.3s ease; }
        .viewport-indicator { fill: none; stroke: #FF0000; stroke-width: 3; stroke-dasharray: 10,5; opacity: 0.5; }
      </style>
      <rect x="${minX}" y="${minY}" width="${contentWidth}" height="${contentHeight}" fill="#FFFFFF" />
      ${svgElements.join(`
      `)}
      <!-- ビューポート範囲を示す赤い破線の矩形 -->
      <rect class="viewport-indicator" x="0" y="0" width="${viewportWidth}" height="${viewportHeight}" />
    </svg>
  `.trim();
}
