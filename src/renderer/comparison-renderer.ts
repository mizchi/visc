/**
 * レイアウト比較結果のSVG描画
 */

import type {
  LayoutComparisonResult,
  LayoutDifference,
} from "../layout/comparator.js";
import { generateElementId } from "../layout/comparator.js";
import type {
  LayoutAnalysisResult,
  LayoutElement,
  SemanticGroup,
} from "../layout/extractor.js";
import { escapeXml } from "./layout-renderer.js";

interface DiffRenderOptions {
  showUnchanged?: boolean;
  showLabels?: boolean;
  highlightLevel?: "subtle" | "moderate" | "strong";
  viewport?: { width: number; height: number };
}

/**
 * 比較結果をSVGに描画
 */
export function renderComparisonToSvg(
  comparison: LayoutComparisonResult,
  baseline: LayoutAnalysisResult,
  current: LayoutAnalysisResult,
  options: DiffRenderOptions = {}
): string {
  const {
    showUnchanged = true,
    showLabels = true,
    highlightLevel = "moderate",
    viewport = baseline.viewport,
  } = options;

  // コンテンツの実際の高さを計算
  const calculateContentHeight = (layout: LayoutAnalysisResult): number => {
    let maxHeight = viewport.height;

    // セマンティックグループモードの場合
    if (layout.semanticGroups && layout.semanticGroups.length > 0) {
      layout.semanticGroups.forEach((group) => {
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
  const diffMap = new Map<string, LayoutDifference>();
  comparison.differences.forEach((diff) => {
    diffMap.set(diff.elementId, diff);
  });

  // ベースラインの要素を描画
  if (baseline.semanticGroups && baseline.semanticGroups.length > 0) {
    // セマンティックグループモード
    baseline.semanticGroups.forEach((group) => {
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
        .unchanged { fill: #e9ecef; stroke: #6c757d; stroke-width: 1; opacity: 0.5; }
        .changed-position { fill: #ffd43b; stroke: #fab005; stroke-width: 2; opacity: ${opacity}; }
        .changed-size { fill: #ff8787; stroke: #fa5252; stroke-width: 2; opacity: ${opacity}; }
        .changed-both { fill: #ff6b6b; stroke: #c92a2a; stroke-width: 3; opacity: ${opacity}; }
        .added { fill: #8ce99a; stroke: #51cf66; stroke-width: 2; opacity: ${opacity}; }
        .removed { fill: #ffa8a8; stroke: #ff6b6b; stroke-width: 2; opacity: ${opacity}; stroke-dasharray: 5,5; }
        .label { font-family: monospace; font-size: 10px; fill: #212529; }
        .diff-arrow { stroke: #495057; stroke-width: 2; fill: none; marker-end: url(#arrowhead); }
      </style>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#495057" />
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
  group: SemanticGroup,
  diffMap: Map<string, LayoutDifference>,
  showUnchanged: boolean,
  showLabels: boolean
): void {
  // グループの境界を描画
  const groupClass = getGroupDiffClass(group, diffMap);
  if (showUnchanged || groupClass !== "unchanged") {
    elements.push(`
      <g class="semantic-group">
        <rect x="${group.bounds.x}" y="${group.bounds.y}" 
              width="${group.bounds.width}" height="${group.bounds.height}"
              class="${groupClass}" rx="5" />
    `);

    if (showLabels) {
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
        child as SemanticGroup,
        diffMap,
        showUnchanged,
        showLabels
      );
    }
    // 個別要素（LayoutElement）は描画しない - グループで既に表現されている
  });
}

function renderElementDiff(
  elements: string[],
  element: LayoutElement,
  diffMap: Map<string, LayoutDifference>,
  showUnchanged: boolean,
  showLabels: boolean
): void {
  const elementId = generateElementId(element);
  const diff = diffMap.get(elementId);

  if (!showUnchanged && !diff) return;

  const className = diff ? getDiffClass(diff) : "unchanged";

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

  if (showLabels && element.text) {
    elements.push(`
      <text x="${element.rect.x + 5}" y="${element.rect.y + 15}" class="label">
        ${escapeXml(element.text.substring(0, 20))}
      </text>
    `);
  }
}

function renderAddedElement(
  elements: string[],
  element: LayoutElement,
  showLabels: boolean
): void {
  elements.push(`
    <rect x="${element.rect.x}" y="${element.rect.y}" 
          width="${element.rect.width}" height="${element.rect.height}"
          class="added" />
  `);

  if (showLabels) {
    elements.push(`
      <text x="${element.rect.x + 5}" y="${element.rect.y + 15}" class="label">
        + ${escapeXml(element.tagName)}
      </text>
    `);
  }
}

function renderRemovedElement(
  elements: string[],
  element: LayoutElement,
  showLabels: boolean
): void {
  elements.push(`
    <rect x="${element.rect.x}" y="${element.rect.y}" 
          width="${element.rect.width}" height="${element.rect.height}"
          class="removed" />
  `);

  if (showLabels) {
    elements.push(`
      <text x="${element.rect.x + 5}" y="${element.rect.y + 15}" class="label">
        - ${escapeXml(element.tagName)}
      </text>
    `);
  }
}

function generateSummary(
  comparison: LayoutComparisonResult,
  viewport: { width: number; height: number }
): string {
  const summary = comparison.summary;
  const x = viewport.width - 250;
  const y = 10;

  return `
    <g id="summary" transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="240" height="120" fill="white" stroke="#dee2e6" stroke-width="1" rx="5" />
      <text x="10" y="20" class="label" font-weight="bold">Comparison Summary</text>
      <text x="10" y="40" class="label">Total Elements: ${
        summary.totalElements
      }</text>
      <text x="10" y="55" class="label">Changed: ${summary.totalChanged}</text>
      <text x="10" y="70" class="label">Added: ${summary.totalAdded}</text>
      <text x="10" y="85" class="label">Removed: ${summary.totalRemoved}</text>
      <text x="10" y="100" class="label">Similarity: ${Math.round(
        comparison.similarity
      )}%</text>
    </g>
  `;
}

// ヘルパー関数

function getDiffClass(diff: LayoutDifference): string {
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
  group: SemanticGroup,
  diffMap: Map<string, LayoutDifference>
): string {
  let hasPositionChange = false;
  let hasSizeChange = false;

  // グループ内の全要素の変更を集計
  const checkChildren = (children: (LayoutElement | SemanticGroup)[]): void => {
    children.forEach((child) => {
      if ("children" in child) {
        checkChildren((child as SemanticGroup).children);
      } else {
        const elementId = generateElementId(child as LayoutElement);
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
  layout: LayoutAnalysisResult,
  elementId: string
): LayoutElement | undefined {
  return layout.elements.find((el) => generateElementId(el) === elementId);
}
