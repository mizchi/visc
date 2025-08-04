import type { LayoutAnalysisResult, SemanticGroup, LayoutElement } from '../types.js';

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

function getElementColor(element: SemanticGroup | LayoutElement): string {
  if ('type' in element && element.type) {
    return typeColorMap[element.type] || typeColorMap.default;
  }
  if ('tagName' in element) {
    // A simple heuristic for layout elements if they don't have a semantic type
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

export function renderLayoutToSvg(analysisResult: LayoutAnalysisResult): string {
  const { viewport, semanticGroups, elements } = analysisResult;
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

  // Render semantic groups first as background areas
  if (semanticGroups) {
    const traverse = (group: SemanticGroup | LayoutElement) => {
      const color = getElementColor(group);
      if ('bounds' in group) {
        updateBounds(group.bounds);
        svgElements.push(createRectElement(group.bounds, color));
        const label = `${group.type}: ${group.label || ''}`;
        svgElements.push(createTextElement(label, group.bounds, color));
      }
      if (group.children) {
        group.children.forEach((child: SemanticGroup | LayoutElement) => traverse(child));
      }
    };
    semanticGroups.forEach(traverse);
  } else if (elements) {
    // Fallback to rendering individual elements if no semantic groups
    elements.forEach((element: LayoutElement) => {
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
