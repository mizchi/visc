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
  
  /**
   * レイアウト分析設定
   */
  layoutAnalysis?: {
    /**
     * レイアウト分析を有効にするか
     */
    enabled?: boolean;
    
    /**
     * 類似度閾値（0-1）
     */
    similarityThreshold?: number;
    
    /**
     * グループ化閾値（0-1）
     */
    groupingThreshold?: number;
    
    /**
     * 除外するタグ
     */
    excludeTags?: string[];
    
    /**
     * レイアウト変更の許容閾値
     */
    layoutChangeThreshold?: number;
    
    /**
     * 本文除外設定
     */
    excludeContent?: {
      /**
       * 本文除外を有効にするか
       */
      enabled?: boolean;
      
      /**
       * Readabilityのオプション
       */
      readabilityOptions?: {
        /**
         * ログレベル
         */
        debug?: boolean;
        
        /**
         * 最大Eagerサイズ
         */
        maxEagerCacheSize?: number;
        
        /**
         * nbTopCandidates
         */
        nbTopCandidates?: number;
        
        /**
         * charThreshold
         */
        charThreshold?: number;
        
        /**
         * classesToPreserve
         */
        classesToPreserve?: string[];
      };
      
      /**
       * 本文要素を非表示にするか、削除するか
       */
      method?: 'hide' | 'remove';
    };
  };
  
  /**
   * プロキシ設定
   */
  proxy?: {
    /**
     * プロキシを有効にするか
     */
    enabled?: boolean;
    
    /**
     * プロキシURL
     */
    url?: string;
    
    /**
     * リクエスト/レスポンスのオーバーライド設定
     */
    overrides?: ProxyOverride[];
  };
  
  /**
   * レスポンシブマトリクステスト設定
   */
  responsiveMatrix?: {
    /**
     * マトリクステストを有効にするか
     */
    enabled?: boolean;
    
    /**
     * テストするビューポート幅のリスト
     */
    viewports?: ViewportSize[];
    
    /**
     * メディアクエリのブレークポイント
     */
    breakpoints?: {
      name: string;
      minWidth?: number;
      maxWidth?: number;
    }[];
    
    /**
     * レスポンシブ検証の厳密度
     */
    strictness?: 'loose' | 'normal' | 'strict';
    
    /**
     * CSS類似度の閾値（0-1）
     */
    cssSimilarityThreshold?: number;
  };
}

export interface ViewportSize {
  /**
   * ビューポート名（例: mobile, tablet, desktop）
   */
  name: string;
  
  /**
   * 幅
   */
  width: number;
  
  /**
   * 高さ
   */
  height: number;
  
  /**
   * デバイスピクセル比
   */
  deviceScaleFactor?: number;
  
  /**
   * ユーザーエージェント（オプション）
   */
  userAgent?: string;
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
  
  /**
   * レイアウト分析結果
   */
  layoutAnalysis?: {
    /**
     * レイアウトスナップショット
     */
    snapshot?: any;
    
    /**
     * レイアウト差分
     */
    diff?: any;
    
    /**
     * レイアウト変更数
     */
    layoutChanges?: number;
    
    /**
     * アクセシビリティ問題
     */
    accessibilityIssues?: number;
  };
}

export interface ResponsiveMatrixResult {
  /**
   * URL設定
   */
  url: UrlConfig;
  
  /**
   * テスト実行時刻
   */
  timestamp: string;
  
  /**
   * ビューポートごとの結果
   */
  viewportResults: ViewportTestResult[];
  
  /**
   * メディアクエリの一貫性
   */
  mediaQueryConsistency: MediaQueryConsistency[];
  
  /**
   * 全体的な成功フラグ
   */
  passed: boolean;
  
  /**
   * サマリー
   */
  summary: {
    totalViewports: number;
    passedViewports: number;
    failedViewports: number;
    mediaQueryIssues: number;
    layoutInconsistencies: number;
  };
}

export interface ViewportTestResult {
  /**
   * ビューポート設定
   */
  viewport: ViewportSize;
  
  /**
   * スナップショットパス
   */
  snapshotPath: string;
  
  /**
   * 適用されたメディアクエリ
   */
  appliedMediaQueries: string[];
  
  /**
   * CSS計算値のハッシュ
   */
  cssFingerprint: string;
  
  /**
   * レイアウト構造
   */
  layoutStructure: any;
  
  /**
   * エラー情報
   */
  error?: string;
}

export interface MediaQueryConsistency {
  /**
   * メディアクエリ
   */
  query: string;
  
  /**
   * 期待されるビューポート
   */
  expectedViewports: string[];
  
  /**
   * 実際に適用されたビューポート
   */
  actualViewports: string[];
  
  /**
   * 一貫性があるか
   */
  isConsistent: boolean;
  
  /**
   * 不整合の詳細
   */
  inconsistencies?: string[];
}

/**
 * プロキシオーバーライド設定
 */
export interface ProxyOverride {
  /**
   * マッチング条件
   */
  match: {
    /**
     * URLパターン（正規表現または文字列）
     */
    url?: string | RegExp;
    
    /**
     * HTTPメソッド
     */
    method?: string | string[];
    
    /**
     * ヘッダー条件
     */
    headers?: Record<string, string | RegExp>;
  };
  
  /**
   * リクエストの書き換え
   */
  request?: {
    /**
     * URLの書き換え
     */
    url?: string | ((originalUrl: string) => string);
    
    /**
     * ヘッダーの追加/変更
     */
    headers?: Record<string, string | ((originalValue?: string) => string)>;
    
    /**
     * ボディの書き換え
     */
    body?: string | Buffer | ((originalBody: string | Buffer) => string | Buffer);
  };
  
  /**
   * レスポンスの書き換え
   */
  response?: {
    /**
     * ステータスコード
     */
    status?: number;
    
    /**
     * ヘッダーの追加/変更
     */
    headers?: Record<string, string | ((originalValue?: string) => string)>;
    
    /**
     * ボディの書き換え
     */
    body?: string | Buffer | ((originalBody: string | Buffer) => string | Buffer);
    
    /**
     * レスポンス全体を置き換える
     */
    replace?: {
      status: number;
      headers: Record<string, string>;
      body: string | Buffer;
    };
  };
  
  /**
   * オーバーライドを有効にする条件
   */
  enabled?: boolean | (() => boolean);
  
  /**
   * 優先度（大きい数値が優先）
   */
  priority?: number;
}