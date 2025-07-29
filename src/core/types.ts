/**
 * Core types for Visual Checker
 * 最も基本的な型定義
 */

export interface ScreenshotOptions {
  /**
   * キャプチャするURL
   */
  url: string;
  
  /**
   * 出力ファイルパス（オプション）
   */
  outputPath?: string;
  
  /**
   * フルページキャプチャ（デフォルト: true）
   */
  fullPage?: boolean;
  
  /**
   * ビューポートサイズ
   */
  viewport?: {
    width: number;
    height: number;
  };
}

export interface CompareOptions {
  /**
   * 差分の許容しきい値（0-1）
   */
  threshold?: number;
  
  /**
   * 差分画像を生成するか
   */
  generateDiff?: boolean;
  
  /**
   * 差分画像の出力パス
   */
  diffPath?: string;
}

export interface CompareResult {
  /**
   * 画像が一致するか
   */
  match: boolean;
  
  /**
   * 差分の割合（0-1）
   */
  difference: number;
  
  /**
   * 差分ピクセル数
   */
  diffPixels: number;
  
  /**
   * 差分画像のパス（生成された場合）
   */
  diffPath?: string;
}

export interface ScreenshotResult {
  /**
   * キャプチャしたURL
   */
  url: string;
  
  /**
   * スクリーンショットのパス
   */
  path: string;
  
  /**
   * キャプチャ日時
   */
  timestamp: Date;
  
  /**
   * ビューポートサイズ
   */
  viewport: {
    width: number;
    height: number;
  };
}

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