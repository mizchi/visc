export interface VisualCheckConfig {
  /**
   * テスト対象のURLリスト
   */
  urls: UrlConfig[];
  
  /**
   * ベースURL（共通部分）
   */
  baseUrl?: string;
  
  /**
   * スナップショット保存ディレクトリ
   */
  snapshotDir?: string;
  
  /**
   * Playwrightの設定
   */
  playwright?: {
    /**
     * ブラウザタイプ
     */
    browser?: 'chromium' | 'firefox' | 'webkit';
    
    /**
     * ヘッドレスモード
     */
    headless?: boolean;
    
    /**
     * ビューポートサイズ
     */
    viewport?: {
      width: number;
      height: number;
    };
    
    /**
     * デバイス設定（mobile, tablet等）
     */
    device?: string;
  };
  
  /**
   * 比較設定
   */
  comparison?: {
    /**
     * 許容する差分のしきい値（0-1）
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
}

export interface UrlConfig {
  /**
   * URL識別子（ファイル名に使用）
   */
  name: string;
  
  /**
   * テスト対象のURL
   */
  url: string;
  
  /**
   * ページ読み込み後の待機設定
   */
  waitFor?: {
    /**
     * 待機時間（ミリ秒）
     */
    timeout?: number;
    
    /**
     * 待機するセレクタ
     */
    selector?: string;
    
    /**
     * ネットワークアイドル待機
     */
    networkIdle?: boolean;
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
    scrollTo?: {
      x: number;
      y: number;
    };
  };
  
  /**
   * スクリーンショット設定
   */
  screenshot?: {
    /**
     * フルページスクリーンショット
     */
    fullPage?: boolean;
    
    /**
     * 特定要素のスクリーンショット
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

export interface TestResult {
  /**
   * URL設定
   */
  url: UrlConfig;
  
  /**
   * テスト成功フラグ
   */
  passed: boolean;
  
  /**
   * エラーメッセージ
   */
  error?: string;
  
  /**
   * 差分の割合（0-1）
   */
  diffPercentage?: number;
  
  /**
   * 差分画像のパス
   */
  diffImagePath?: string;
  
  /**
   * スナップショットのパス
   */
  snapshotPath: string;
  
  /**
   * 実行時間（ミリ秒）
   */
  duration: number;
}