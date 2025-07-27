/**
 * Configuration types
 * 設定の型定義
 */

import type { BrowserConfig, PageOptions } from '../browser/types.js';

/**
 * Visual Checker の基本設定
 */
export interface BasicConfig {
  /**
   * ベースURL
   */
  baseUrl?: string;
  
  /**
   * スナップショットディレクトリ
   */
  snapshotDir?: string;
  
  /**
   * ブラウザ設定
   */
  browser?: BrowserConfig;
  
  /**
   * 比較設定
   */
  comparison?: {
    /**
     * 差分の許容しきい値
     */
    threshold?: number;
    
    /**
     * 差分画像を生成するか
     */
    generateDiff?: boolean;
    
    /**
     * 差分画像の保存先
     */
    diffDir?: string;
  };
  
  /**
   * テストするURLのリスト
   */
  urls?: Array<PageOptions & { name: string }>;
}

/**
 * 設定ファイルの検証結果
 */
export interface ValidationResult {
  /**
   * 検証が成功したか
   */
  valid: boolean;
  
  /**
   * エラーメッセージ
   */
  errors: string[];
  
  /**
   * 警告メッセージ
   */
  warnings: string[];
}