/**
 * Browser control types
 * ブラウザ制御の型定義
 */

import type { ViewportSize } from '../../types.js';

export interface BrowserConfig {
  /**
   * ブラウザタイプ
   */
  browser?: 'chromium' | 'firefox' | 'webkit';
  
  /**
   * ヘッドレスモード
   */
  headless?: boolean;
  
  /**
   * デフォルトのビューポート
   */
  viewport?: ViewportSize;
  
  /**
   * デバイスエミュレーション
   */
  device?: string;
  
  /**
   * タイムアウト（ミリ秒）
   */
  timeout?: number;
}

export interface PageOptions {
  /**
   * URL
   */
  url: string;
  
  /**
   * ページ名（ファイル名に使用）
   */
  name?: string;
  
  /**
   * 待機条件
   */
  waitFor?: {
    /**
     * セレクタ
     */
    selector?: string;
    
    /**
     * ネットワークアイドル待機
     */
    networkIdle?: boolean;
    
    /**
     * タイムアウト（ミリ秒）
     */
    timeout?: number;
  };
  
  /**
   * スクリーンショット前の処理
   */
  beforeScreenshot?: {
    /**
     * 実行するJavaScript
     */
    script?: string;
    
    /**
     * クリックするセレクタ
     */
    click?: string[];
    
    /**
     * 非表示にするセレクタ
     */
    hide?: string[];
    
    /**
     * スクロール位置
     */
    scrollTo?: { x: number; y: number };
  };
  
  /**
   * スクリーンショットオプション
   */
  screenshot?: {
    /**
     * フルページキャプチャ
     */
    fullPage?: boolean;
    
    /**
     * 特定要素のキャプチャ
     */
    selector?: string;
    
    /**
     * クリップ領域
     */
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}