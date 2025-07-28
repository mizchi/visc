import { SemanticElement } from '../layout/semantic-layout.js';

// Re-export for backward compatibility
export type { SemanticElement } from '../layout/semantic-layout.js';

/**
 * セマンティックレイアウトをSVGに変換
 */
export function renderSemanticLayoutToSVG(
  elements: SemanticElement[], 
  viewportWidth: number = 1280, 
  viewportHeight: number = 720
): string {
  // 全要素のバウンディングボックスを計算
  let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
  
  function updateBounds(el: SemanticElement) {
    minX = Math.min(minX, el.bounds.x);
    minY = Math.min(minY, el.bounds.y);
    maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
    maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
    
    if (el.children) {
      el.children.forEach(updateBounds);
    }
  }
  
  elements.forEach(updateBounds);
  
  const padding = 20;
  const svgWidth = Math.max(viewportWidth, maxX - minX + padding * 2);
  const svgHeight = Math.max(viewportHeight, maxY - minY + padding * 2);

  const colors = {
    header: '#e3f2fd',
    nav: '#f3e5f5',
    main: '#e8f5e9',
    article: '#fff3e0',
    section: '#fce4ec',
    aside: '#f1f8e9',
    footer: '#efebe9',
    h1: '#1976d2',
    h2: '#388e3c',
    h3: '#f57c00',
    h4: '#d32f2f',
    h5: '#7b1fa2',
    h6: '#0288d1',
    p: '#424242',
    a: '#1565c0',
    button: '#00796b',
    form: '#5d4037',
    input: '#4527a0',
    default: '#9e9e9e'
  };

  function renderElement(el: SemanticElement, depth: number = 0): string {
    const color = colors[el.type as keyof typeof colors] || colors.default;
    const opacity = depth === 0 ? 0.3 : 0.2;
    
    let svg = `
      <g>
        <rect 
          x="${el.bounds.x - minX + padding}" 
          y="${el.bounds.y - minY + padding}" 
          width="${el.bounds.width}" 
          height="${el.bounds.height}"
          fill="${color}" 
          fill-opacity="${opacity}"
          stroke="${color}"
          stroke-width="2"
          stroke-opacity="0.8"
          rx="4"
        />`;
    
    // ラベルを追加
    const labelY = el.bounds.y - minY + padding + 20;
    svg += `
        <text 
          x="${el.bounds.x - minX + padding + 5}" 
          y="${labelY}"
          font-family="Arial, sans-serif"
          font-size="12"
          fill="${color}"
          fill-opacity="1"
          font-weight="bold"
        >${el.type.toUpperCase()}</text>`;
    
    // テキストがある場合は表示
    if (el.text) {
      const textY = labelY + 15;
      svg += `
        <text 
          x="${el.bounds.x - minX + padding + 5}" 
          y="${textY}"
          font-family="Arial, sans-serif"
          font-size="10"
          fill="#666"
          fill-opacity="0.8"
        >${escapeXML(el.text)}</text>`;
    }
    
    svg += '</g>';
    
    // 子要素を再帰的にレンダリング
    if (el.children) {
      for (const child of el.children) {
        svg += renderElement(child, depth + 1);
      }
    }
    
    return svg;
  }

  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${svgWidth}" 
     height="${svgHeight}"
     viewBox="0 0 ${svgWidth} ${svgHeight}">
  <rect width="100%" height="100%" fill="white"/>
  <g id="semantic-layout">`;

  for (const element of elements) {
    svgContent += renderElement(element);
  }

  svgContent += `
  </g>
  
  <!-- Legend -->
  <g id="legend" transform="translate(${svgWidth - 150}, 20)">
    <rect x="0" y="0" width="130" height="${Object.keys(colors).length * 20 + 20}" 
          fill="white" stroke="#ccc" stroke-width="1" opacity="0.9"/>
    <text x="10" y="15" font-family="Arial" font-size="12" font-weight="bold">Elements</text>`;

  let legendY = 35;
  for (const [type, color] of Object.entries(colors)) {
    if (type !== 'default') {
      svgContent += `
    <rect x="10" y="${legendY - 10}" width="15" height="15" fill="${color}" opacity="0.5"/>
    <text x="30" y="${legendY}" font-family="Arial" font-size="10">${type}</text>`;
      legendY += 20;
    }
  }

  svgContent += `
  </g>
</svg>`;

  return svgContent;
}

function escapeXML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}