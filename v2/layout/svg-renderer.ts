import type { LayoutAnalysisResult, SemanticGroup, LayoutElement } from './extractor.js';

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

function escapeXml(text: string): string {
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
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="2" />`;
}

function createTextElement(text: string, rect: { x: number; y: number; width: number; height: number; }, color: string): string {
  const fontSize = Math.max(8, Math.min(14, rect.height * 0.5));
  const yPos = rect.y + fontSize;
  return `<text x="${rect.x + 5}" y="${yPos}" font-family="sans-serif" font-size="${fontSize}" fill="${color}" dy=".3em">${escapeXml(text)}</text>`;
}

export function renderLayoutToSvg(analysisResult: LayoutAnalysisResult): string {
  const { viewport, semanticGroups, elements } = analysisResult;
  const width = viewport.width || 1280;
  const height = viewport.height || 800;

  let svgElements: string[] = [];

  // Render semantic groups first as background areas
  if (semanticGroups) {
    const traverse = (group: SemanticGroup) => {
      const color = getElementColor(group);
      svgElements.push(createRectElement(group.bounds, color));
      const label = `${group.type}: ${group.label || ''}`;
      svgElements.push(createTextElement(label, group.bounds, color));
      if (group.children) {
        group.children.forEach(traverse);
      }
    };
    semanticGroups.forEach(traverse);
  } else if (elements) {
    // Fallback to rendering individual elements if no semantic groups
    elements.forEach(element => {
      const color = getElementColor(element);
      svgElements.push(createRectElement(element.rect, color));
      const label = element.text || element.tagName;
      if (label) {
        svgElements.push(createTextElement(label.substring(0, 50), element.rect, color));
      }
    });
  }

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        rect { transition: all 0.3s ease; }
        text { transition: all 0.3s ease; }
      </style>
      <rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" />
      ${svgElements.join(`
      `)}
    </svg>
  `.trim();
}
