/**
 * V2 Types - 共通の型定義
 */

/**
 * 位置情報
 */
export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * アクセシビリティ情報
 */
export interface AccessibilityInfo {
  role?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaHidden?: boolean;
  ariaExpanded?: boolean;
  ariaSelected?: boolean;
  ariaChecked?: boolean;
  ariaDisabled?: boolean;
  ariaValueNow?: number;
  ariaValueMin?: number;
  ariaValueMax?: number;
  ariaValueText?: string;
  tabIndex?: number;
}

/**
 * 抽出された要素
 */
export interface ExtractedElement {
  id: string;
  tagName: string;
  className?: string;
  textContent?: string;
  position: Position;
  accessibility: AccessibilityInfo;
  children: ExtractedElement[];
}

/**
 * 抽出されたレイアウト
 */
export interface ExtractedLayout {
  url: string;
  timestamp: number;
  viewport: { width: number; height: number };
  elements: ExtractedElement[];
}

/**
 * セマンティックタイプ
 */
export type SemanticType = 
  | 'heading' 
  | 'navigation' 
  | 'content' 
  | 'interactive' 
  | 'structural' 
  | 'media' 
  | 'list' 
  | 'table' 
  | 'form';

/**
 * 要約されたノード
 */
export interface SummarizedNode {
  id: string;
  type: string;
  semanticType: SemanticType;
  tagName: string;
  className?: string;
  text?: string;
  position: Position;
  accessibility: {
    role?: string;
    label?: string;
    interactive: boolean;
    focusable: boolean;
    hidden: boolean;
    state?: Record<string, any>;
  };
  importance: number;
  childCount: number;
}

/**
 * ノードグループ
 */
export interface NodeGroup {
  id: string;
  type: string;
  nodeIds: string[];
  bounds: Position;
  semanticRole?: string;
}

/**
 * レイアウトサマリー
 */
export interface LayoutSummary {
  nodes: SummarizedNode[];
  groups: NodeGroup[];
  statistics: {
    totalNodes: number;
    bySemanticType: Record<string, number>;
    byRole: Record<string, number>;
    averageImportance: number;
  };
  viewport: { width: number; height: number };
}

/**
 * 類似度計算の結果
 */
export interface SimilarityResult {
  overallSimilarity: number;
  coordinateSimilarity: number;      // レイアウトの座標の近似度
  accessibilitySimilarity: number;    // アクセシビリティの近似度
  textSimilarity: number;             // テキストの近似度
  textLengthSimilarity: number;       // テキスト長の近似度
  details: {
    coordinateDetails: CoordinateSimilarityDetails;
    accessibilityDetails: AccessibilitySimilarityDetails;
    textDetails: TextSimilarityDetails;
    textLengthDetails: TextLengthSimilarityDetails;
  };
}

/**
 * 座標類似度の詳細
 */
export interface CoordinateSimilarityDetails {
  matchedNodes: number;
  totalNodes: number;
  averagePositionDelta: {
    x: number;
    y: number;
  };
  averageSizeDelta: {
    width: number;
    height: number;
  };
}

/**
 * アクセシビリティ類似度の詳細
 */
export interface AccessibilitySimilarityDetails {
  matchedRoles: number;
  totalRoles: number;
  matchedLabels: number;
  totalLabels: number;
  matchedStates: number;
  totalStates: number;
}

/**
 * テキスト類似度の詳細
 */
export interface TextSimilarityDetails {
  exactMatches: number;
  partialMatches: number;
  totalTexts: number;
  averageLevenshteinDistance: number;
}

/**
 * テキスト長類似度の詳細
 */
export interface TextLengthSimilarityDetails {
  totalLength1: number;
  totalLength2: number;
  lengthRatio: number;
  averageLengthDifference: number;
}