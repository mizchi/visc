/**
 * レイアウト比較結果のSVG描画
 */

import type {
  VisualComparisonResult,
  VisualDifference,
} from "../layout/comparator.js";
import { generateElementId } from "../layout/comparator.js";
import type {
  VisualTreeAnalysis,
  VisualNode,
  VisualNodeGroup,
} from "../layout/extractor.js";
import { escapeXml } from "./layout-renderer.js";

export interface DiffRenderOptions {
  showUnchanged?: boolean;
  showLabels?: boolean;
  highlightLevel?: "subtle" | "moderate" | "strong";
  viewport?: { width: number; height: number; scrollX?: number; scrollY?: number };
  viewportMode?: 'viewportOnly' | 'full' | 'fullScroll'; // SVG rendering range
}

/**
 * 比較結果をSVGに描画
 */
export function renderComparisonToSvg(
  comparison: VisualComparisonResult,
  baseline: VisualTreeAnalysis,
  current: VisualTreeAnalysis,
  options: DiffRenderOptions = {}
): string {
  const {
    showUnchanged = true,
    showLabels = true,
    highlightLevel = "moderate",
    viewport = baseline.viewport,
  } = options;

  // コンテンツの実際の高さを計算
  const calculateContentHeight = (layout: VisualTreeAnalysis): number => {
    let maxHeight = viewport.height;

    // ビジュアルノードグループモードの場合
    if (layout.visualNodeGroups && layout.visualNodeGroups.length > 0) {
      layout.visualNodeGroups.forEach((group) => {
        const groupBottom = group.bounds.y + group.bounds.height;
        maxHeight = Math.max(maxHeight, groupBottom);
      });
    } else {
      // 個別要素モードの場合のみelementsを見る
      layout.elements.forEach((element) => {
        const elementBottom = element.rect.y + element.rect.height;
        maxHeight = Math.max(maxHeight, elementBottom);
      });
    }

    return maxHeight;
  };

  const svgHeight = Math.max(
    calculateContentHeight(baseline),
    calculateContentHeight(current)
  );

  const elements: string[] = [];

  // SVGヘッダー
  elements.push(
    `<svg width="${viewport.width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`
  );

  // スタイル定義
  elements.push(generateStyles(highlightLevel));

  // 凡例
  elements.push(generateLegend());

  // 背景
  elements.push(
    `<rect width="${viewport.width}" height="${svgHeight}" fill="#f8f9fa" />`
  );

  // 差分要素のマップを作成
  const diffMap = new Map<string, VisualDifference>();
  comparison.differences.forEach((diff) => {
    diffMap.set(diff.elementId, diff);
  });

  // ベースラインの要素を描画
  if (baseline.visualNodeGroups && baseline.visualNodeGroups.length > 0) {
    // セマンティックグループモード
    baseline.visualNodeGroups.forEach((group) => {
      renderGroupDiff(elements, group, diffMap, showUnchanged, showLabels);
    });
  } else {
    // 個別要素モード
    baseline.elements.forEach((element) => {
      renderElementDiff(elements, element, diffMap, showUnchanged, showLabels);
    });

    // 個別要素モードでのみ、新規追加・削除要素を描画
    // 新規追加された要素を描画
    comparison.addedElements.forEach((elementId) => {
      const element = findElement(current, elementId);
      if (element) {
        renderAddedElement(elements, element, showLabels);
      }
    });

    // 削除された要素を描画
    comparison.removedElements.forEach((elementId) => {
      const element = findElement(baseline, elementId);
      if (element) {
        renderRemovedElement(elements, element, showLabels);
      }
    });
  }

  // サマリー情報
  elements.push(generateSummary(comparison, viewport));

  elements.push("</svg>");

  return elements.join("\n");
}

function generateStyles(
  highlightLevel: "subtle" | "moderate" | "strong"
): string {
  const opacity = {
    subtle: 0.3,
    moderate: 0.5,
    strong: 0.7,
  }[highlightLevel];

  return `
    <defs>
      <style>
        .unchanged { fill: #e9ecef; stroke: #6c757d; stroke-width: 1; opacity: 0.3; }
        .changed-position { fill: #ffd43b; stroke: #ff0000; stroke-width: 2; opacity: ${opacity}; }
        .changed-size { fill: #ff8787; stroke: #ff0000; stroke-width: 2; opacity: ${opacity}; }
        .changed-both { fill: #ff6b6b; stroke: #ff0000; stroke-width: 3; opacity: ${opacity}; }
        .added { fill: #ff4444; stroke: #ff0000; stroke-width: 3; opacity: ${opacity}; }
        .removed { fill: #ff6666; stroke: #ff0000; stroke-width: 3; opacity: ${opacity}; stroke-dasharray: 5,5; }
        .diff-highlight { fill: none; stroke: #ff0000; stroke-width: 4; stroke-opacity: 0.9; }
        .label { font-family: monospace; font-size: 10px; fill: #212529; }
        .selector-label { font-family: monospace; font-size: 9px; fill: #ff0000; font-weight: bold; }
        .diff-arrow { stroke: #ff0000; stroke-width: 2; fill: none; marker-end: url(#arrowhead); opacity: 0.7; }
        .summary-panel { fill: white; fill-opacity: 0.85; stroke: #dee2e6; stroke-width: 1; }
        .summary-text { font-family: monospace; font-size: 11px; fill: #495057; }
      </style>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#ff0000" />
      </marker>
    </defs>
  `;
}

function generateLegend(): string {
  const legendItems = [
    { class: "unchanged", label: "Unchanged" },
    { class: "changed-position", label: "Position Changed" },
    { class: "changed-size", label: "Size Changed" },
    { class: "changed-both", label: "Position & Size Changed" },
    { class: "added", label: "Added" },
    { class: "removed", label: "Removed" },
  ];

  const legend: string[] = ['<g id="legend" transform="translate(10, 10)">'];
  legend.push(
    '<rect x="0" y="0" width="200" height="160" fill="white" stroke="#dee2e6" stroke-width="1" rx="5" />'
  );
  legend.push(
    '<text x="10" y="20" class="label" font-weight="bold">Legend</text>'
  );

  legendItems.forEach((item, i) => {
    const y = 35 + i * 20;
    legend.push(
      `<rect x="10" y="${y}" width="15" height="15" class="${item.class}" />`
    );
    legend.push(
      `<text x="30" y="${y + 11}" class="label">${escapeXml(item.label)}</text>`
    );
  });

  legend.push("</g>");
  return legend.join("\n");
}

function renderGroupDiff(
  elements: string[],
  group: VisualNodeGroup,
  diffMap: Map<string, VisualDifference>,
  showUnchanged: boolean,
  showLabels: boolean
): void {
  // グループの境界を描画
  const groupClass = getGroupDiffClass(group, diffMap);
  if (showUnchanged || groupClass !== "unchanged") {
    // If there's a change, add red highlight border
    if (groupClass !== "unchanged") {
      elements.push(`
        <rect x="${group.bounds.x - 2}" y="${group.bounds.y - 2}" 
              width="${group.bounds.width + 4}" height="${group.bounds.height + 4}"
              class="diff-highlight" rx="7" />
      `);
    }

    elements.push(`
      <g class="visual-group">
        <rect x="${group.bounds.x}" y="${group.bounds.y}" 
              width="${group.bounds.width}" height="${group.bounds.height}"
              class="${groupClass}" rx="5" />
    `);

    if (showLabels) {
      // Add root selector if available and group has changes
      if (groupClass !== "unchanged" && group.rootSelector) {
        elements.push(`
          <text x="${group.bounds.x}" y="${group.bounds.y - 3}" class="selector-label">
            ${escapeXml(group.rootSelector)}
          </text>
        `);
      }

      elements.push(`
        <text x="${group.bounds.x + 5}" y="${
        group.bounds.y + 15
      }" class="label">
          ${escapeXml(group.type + ": " + group.label)}
        </text>
      `);
    }

    elements.push("</g>");
  }

  // 子要素を再帰的に描画（セマンティックグループのみ、個別要素は描画しない）
  group.children.forEach((child) => {
    if ("children" in child) {
      renderGroupDiff(
        elements,
        child as VisualNodeGroup,
        diffMap,
        showUnchanged,
        showLabels
      );
    }
    // 個別要素（VisualNode）は描画しない - グループで既に表現されている
  });
}

function renderElementDiff(
  elements: string[],
  element: VisualNode,
  diffMap: Map<string, VisualDifference>,
  showUnchanged: boolean,
  showLabels: boolean
): void {
  const elementId = generateElementId(element);
  const diff = diffMap.get(elementId);

  if (!showUnchanged && !diff) return;

  const className = diff ? getDiffClass(diff) : "unchanged";

  // If there's a diff, add a red highlight border
  if (diff) {
    elements.push(`
      <rect x="${element.rect.x - 2}" y="${element.rect.y - 2}" 
            width="${element.rect.width + 4}" height="${element.rect.height + 4}"
            class="diff-highlight" rx="2" />
    `);
  }

  elements.push(`
    <rect x="${element.rect.x}" y="${element.rect.y}" 
          width="${element.rect.width}" height="${element.rect.height}"
          class="${className}" />
  `);

  // 変更がある場合、矢印で移動を表示
  if (diff && (diff.type === "position" || diff.type === "both")) {
    const oldX = element.rect.x - (diff.changes.rect?.x || 0);
    const oldY = element.rect.y - (diff.changes.rect?.y || 0);
    elements.push(`
      <line x1="${oldX + element.rect.width / 2}" y1="${
      oldY + element.rect.height / 2
    }"
            x2="${element.rect.x + element.rect.width / 2}" y2="${
      element.rect.y + element.rect.height / 2
    }"
            class="diff-arrow" />
    `);
  }

  // Add selector label for changed elements
  if (diff && showLabels) {
    const selector = generateSelector(element);
    if (selector) {
      elements.push(`
        <text x="${element.rect.x}" y="${element.rect.y - 3}" class="selector-label">
          ${escapeXml(selector)}
        </text>
      `);
    }
  }

  if (showLabels && element.text) {
    elements.push(`
      <text x="${element.rect.x + 5}" y="${element.rect.y + 15}" class="label">
        ${escapeXml(element.text.substring(0, 20))}
      </text>
    `);
  }
}

// Generate CSS selector for element
function generateSelector(element: VisualNode): string {
  const parts: string[] = [];
  
  if (element.tagName) {
    parts.push(element.tagName.toLowerCase());
  }
  
  if (element.id) {
    parts.push(`#${element.id}`);
  } else if (element.className) {
    const classes = element.className.split(' ').filter(c => c).slice(0, 2);
    if (classes.length > 0) {
      parts.push(`.${classes.join('.')}`);
    }
  }
  
  return parts.join('');
}

function renderAddedElement(
  elements: string[],
  element: VisualNode,
  showLabels: boolean
): void {
  // Outer highlight border
  elements.push(`
    <rect x="${element.rect.x - 2}" y="${element.rect.y - 2}" 
          width="${element.rect.width + 4}" height="${element.rect.height + 4}"
          fill="none" stroke="#ff0000" stroke-width="3" />
  `);
  
  elements.push(`
    <rect x="${element.rect.x}" y="${element.rect.y}" 
          width="${element.rect.width}" height="${element.rect.height}"
          class="added" />
  `);

  if (showLabels) {
    elements.push(`
      <text x="${element.rect.x + 5}" y="${element.rect.y + 15}" class="label" fill="#ff0000" font-weight="bold">
        + ${escapeXml(element.tagName)}
      </text>
    `);
  }
}

function renderRemovedElement(
  elements: string[],
  element: VisualNode,
  showLabels: boolean
): void {
  // Outer highlight border with dashed line
  elements.push(`
    <rect x="${element.rect.x - 2}" y="${element.rect.y - 2}" 
          width="${element.rect.width + 4}" height="${element.rect.height + 4}"
          fill="none" stroke="#ff0000" stroke-width="3" stroke-dasharray="8,4" />
  `);
  
  elements.push(`
    <rect x="${element.rect.x}" y="${element.rect.y}" 
          width="${element.rect.width}" height="${element.rect.height}"
          class="removed" />
  `);

  if (showLabels) {
    elements.push(`
      <text x="${element.rect.x + 5}" y="${element.rect.y + 15}" class="label" fill="#ff0000" font-weight="bold">
        - ${escapeXml(element.tagName)}
      </text>
    `);
  }
}

function generateSummary(
  comparison: VisualComparisonResult,
  viewport: { width: number; height: number }
): string {
  const summary = comparison.summary;
  const x = viewport.width - 250;
  const y = 10;

  return `
    <g id="summary" transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="240" height="120" class="summary-panel" rx="5" />
      <text x="10" y="20" class="summary-text" font-weight="bold">Comparison Summary</text>
      <text x="10" y="40" class="summary-text">Total Elements: ${
        summary.totalElements
      }</text>
      <text x="10" y="55" class="summary-text">Changed: ${summary.totalChanged}</text>
      <text x="10" y="70" class="summary-text">Added: ${summary.totalAdded}</text>
      <text x="10" y="85" class="summary-text">Removed: ${summary.totalRemoved}</text>
      <text x="10" y="100" class="summary-text">Similarity: ${Math.round(
        comparison.similarity
      )}%</text>
    </g>
  `;
}

// ヘルパー関数

function getDiffClass(diff: VisualDifference): string {
  switch (diff.type) {
    case "position":
      return "changed-position";
    case "size":
      return "changed-size";
    case "both":
      return "changed-both";
    default:
      return "unchanged";
  }
}

function getGroupDiffClass(
  group: VisualNodeGroup,
  diffMap: Map<string, VisualDifference>
): string {
  let hasPositionChange = false;
  let hasSizeChange = false;

  // グループ内の全要素の変更を集計
  const checkChildren = (children: (VisualNode | VisualNodeGroup)[]): void => {
    children.forEach((child) => {
      if ("children" in child) {
        checkChildren((child as VisualNodeGroup).children);
      } else {
        const elementId = generateElementId(child as VisualNode);
        const diff = diffMap.get(elementId);
        if (diff) {
          if (diff.type === "position" || diff.type === "both")
            hasPositionChange = true;
          if (diff.type === "size" || diff.type === "both")
            hasSizeChange = true;
        }
      }
    });
  };

  checkChildren(group.children);

  if (hasPositionChange && hasSizeChange) return "changed-both";
  if (hasPositionChange) return "changed-position";
  if (hasSizeChange) return "changed-size";
  return "unchanged";
}

function findElement(
  layout: VisualTreeAnalysis,
  elementId: string
): VisualNode | undefined {
  return layout.elements.find((el) => generateElementId(el) === elementId);
}
