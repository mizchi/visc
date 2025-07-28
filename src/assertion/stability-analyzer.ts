import { SemanticElement } from '../layout/semantic-layout.js';

export interface NodeVariation {
  nodeId: string;
  tagName: string;
  selector: string;
  variations: Array<{
    attribute: string;
    values: Array<{ iteration: number; value: any }>;
    variationType: 'position' | 'size' | 'text' | 'visibility' | 'style';
  }>;
  variationScore: number; // 0-1: 変動の激しさ
}

export interface StabilityAnalysis {
  totalIterations: number;
  totalNodes: number;
  stableNodes: number;
  unstableNodes: NodeVariation[];
  overallStabilityScore: number; // 0-100
  recommendations: {
    pixelTolerance: number;
    percentageTolerance: number;
    ignoreSelectors: string[];
    ignoreAttributes: string[];
    confidenceLevel: number; // 0-1: 推奨設定の信頼度
  };
}

/**
 * 複数回のセマンティックレイアウトから安定性を分析
 */
export function analyzeStability(
  iterations: Array<{ 
    iteration: number; 
    elements: SemanticElement[] 
  }>
): StabilityAnalysis {
  if (iterations.length < 2) {
    return {
      totalIterations: iterations.length,
      totalNodes: iterations[0]?.elements.length || 0,
      stableNodes: iterations[0]?.elements.length || 0,
      unstableNodes: [],
      overallStabilityScore: 100,
      recommendations: {
        pixelTolerance: 0,
        percentageTolerance: 0,
        ignoreSelectors: [],
        ignoreAttributes: [],
        confidenceLevel: 0
      }
    };
  }

  const nodeVariations = new Map<string, NodeVariation>();
  const baseElements = iterations[0].elements;
  
  // 各ノードの変動を追跡
  baseElements.forEach((baseElement, index) => {
    const nodeId = generateNodeId(baseElement, index);
    const variations: NodeVariation['variations'] = [];
    
    // 位置の変動を追跡
    const positions = iterations.map(it => ({
      iteration: it.iteration,
      x: it.elements[index]?.x || 0,
      y: it.elements[index]?.y || 0
    }));
    
    if (hasVariation(positions, 'x') || hasVariation(positions, 'y')) {
      variations.push({
        attribute: 'position',
        values: positions.map(p => ({ 
          iteration: p.iteration, 
          value: { x: p.x, y: p.y } 
        })),
        variationType: 'position'
      });
    }
    
    // サイズの変動を追跡
    const sizes = iterations.map(it => ({
      iteration: it.iteration,
      width: it.elements[index]?.width || 0,
      height: it.elements[index]?.height || 0
    }));
    
    if (hasVariation(sizes, 'width') || hasVariation(sizes, 'height')) {
      variations.push({
        attribute: 'size',
        values: sizes.map(s => ({ 
          iteration: s.iteration, 
          value: { width: s.width, height: s.height } 
        })),
        variationType: 'size'
      });
    }
    
    // テキストの変動を追跡
    const texts = iterations.map(it => ({
      iteration: it.iteration,
      text: it.elements[index]?.text || ''
    }));
    
    if (hasVariation(texts, 'text')) {
      variations.push({
        attribute: 'text',
        values: texts.map(t => ({ 
          iteration: t.iteration, 
          value: t.text 
        })),
        variationType: 'text'
      });
    }
    
    // 可視性の変動を追跡
    const visibilities = iterations.map(it => ({
      iteration: it.iteration,
      isVisible: it.elements[index]?.isVisible ?? true
    }));
    
    if (hasVariation(visibilities, 'isVisible')) {
      variations.push({
        attribute: 'visibility',
        values: visibilities.map(v => ({ 
          iteration: v.iteration, 
          value: v.isVisible 
        })),
        variationType: 'visibility'
      });
    }
    
    if (variations.length > 0) {
      const variationScore = calculateVariationScore(variations);
      nodeVariations.set(nodeId, {
        nodeId,
        tagName: baseElement.tagName,
        selector: generateSelector(baseElement, index),
        variations,
        variationScore
      });
    }
  });

  const unstableNodes = Array.from(nodeVariations.values());
  const stableNodes = baseElements.length - unstableNodes.length;
  const overallStabilityScore = (stableNodes / baseElements.length) * 100;
  
  const recommendations = generateRecommendations(unstableNodes, iterations.length);

  return {
    totalIterations: iterations.length,
    totalNodes: baseElements.length,
    stableNodes,
    unstableNodes,
    overallStabilityScore,
    recommendations
  };
}

/**
 * ノードの一意なIDを生成
 */
function generateNodeId(element: SemanticElement, index: number): string {
  return `${element.tagName}-${index}-${element.x}-${element.y}`;
}

/**
 * CSSセレクタを生成
 */
function generateSelector(element: SemanticElement, index: number): string {
  // 実際のセレクタ生成ロジックを実装
  // ここでは簡易版
  if (element.className) {
    return `${element.tagName}.${element.className.split(' ')[0]}`;
  }
  if (element.id) {
    return `#${element.id}`;
  }
  return `${element.tagName}:nth-of-type(${index + 1})`;
}

/**
 * 値に変動があるかチェック
 */
function hasVariation(values: any[], key: string): boolean {
  const firstValue = values[0][key];
  return values.some(v => v[key] !== firstValue);
}

/**
 * 変動スコアを計算（0-1）
 */
function calculateVariationScore(variations: NodeVariation['variations']): number {
  let totalScore = 0;
  
  variations.forEach(variation => {
    switch (variation.variationType) {
      case 'position':
        // 位置の変動は重要度高
        const positionVariance = calculatePositionVariance(variation.values);
        totalScore += positionVariance * 0.4;
        break;
      case 'size':
        // サイズの変動も重要
        const sizeVariance = calculateSizeVariance(variation.values);
        totalScore += sizeVariance * 0.3;
        break;
      case 'text':
        // テキストの変動は中程度
        totalScore += 0.2;
        break;
      case 'visibility':
        // 可視性の変動は重要
        totalScore += 0.5;
        break;
    }
  });
  
  return Math.min(totalScore, 1);
}

/**
 * 位置の分散を計算
 */
function calculatePositionVariance(values: Array<{ iteration: number; value: any }>): number {
  const positions = values.map(v => v.value);
  const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
  const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
  
  const variance = positions.reduce((sum, p) => {
    return sum + Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2);
  }, 0) / positions.length;
  
  // 正規化（10ピクセルの変動を最大とする）
  return Math.min(Math.sqrt(variance) / 10, 1);
}

/**
 * サイズの分散を計算
 */
function calculateSizeVariance(values: Array<{ iteration: number; value: any }>): number {
  const sizes = values.map(v => v.value);
  const avgWidth = sizes.reduce((sum, s) => sum + s.width, 0) / sizes.length;
  const avgHeight = sizes.reduce((sum, s) => sum + s.height, 0) / sizes.length;
  
  const variance = sizes.reduce((sum, s) => {
    return sum + Math.pow(s.width - avgWidth, 2) + Math.pow(s.height - avgHeight, 2);
  }, 0) / sizes.length;
  
  // 正規化（20ピクセルの変動を最大とする）
  return Math.min(Math.sqrt(variance) / 20, 1);
}

/**
 * 推奨設定を生成
 */
function generateRecommendations(
  unstableNodes: NodeVariation[],
  iterations: number
): StabilityAnalysis['recommendations'] {
  // 変動の統計を収集
  let maxPositionVariation = 0;
  let maxSizeVariation = 0;
  const unstableSelectors = new Set<string>();
  const variationTypes = new Set<string>();
  
  unstableNodes.forEach(node => {
    if (node.variationScore > 0.7) {
      unstableSelectors.add(node.selector);
    }
    
    node.variations.forEach(variation => {
      variationTypes.add(variation.variationType);
      
      if (variation.variationType === 'position') {
        const positions = variation.values.map(v => v.value);
        const maxDiff = Math.max(
          ...positions.map(p => Math.abs(p.x - positions[0].x)),
          ...positions.map(p => Math.abs(p.y - positions[0].y))
        );
        maxPositionVariation = Math.max(maxPositionVariation, maxDiff);
      }
      
      if (variation.variationType === 'size') {
        const sizes = variation.values.map(v => v.value);
        const maxDiff = Math.max(
          ...sizes.map(s => Math.abs(s.width - sizes[0].width)),
          ...sizes.map(s => Math.abs(s.height - sizes[0].height))
        );
        maxSizeVariation = Math.max(maxSizeVariation, maxDiff);
      }
    });
  });
  
  // 推奨設定を計算
  const pixelTolerance = Math.ceil(Math.max(maxPositionVariation, maxSizeVariation, 5));
  const percentageTolerance = Math.min(unstableNodes.length / 100, 5); // 最大5%
  
  const ignoreAttributes: string[] = [];
  if (variationTypes.has('text')) {
    ignoreAttributes.push('text');
  }
  if (variationTypes.has('visibility') && unstableNodes.filter(n => 
    n.variations.some(v => v.variationType === 'visibility')
  ).length > 5) {
    ignoreAttributes.push('visibility');
  }
  
  // 信頼度を計算（反復回数が多いほど高い）
  const confidenceLevel = Math.min(iterations / 10, 1);
  
  return {
    pixelTolerance,
    percentageTolerance,
    ignoreSelectors: Array.from(unstableSelectors),
    ignoreAttributes,
    confidenceLevel
  };
}