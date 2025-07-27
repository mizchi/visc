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