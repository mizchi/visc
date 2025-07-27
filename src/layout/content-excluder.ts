import { Readability } from '@mizchi/readability';

/**
 * Readabilityを使用して本文を抽出し、レイアウト比較のために除外する
 */

export interface ContentExcludeOptions {
  /**
   * Readabilityのオプション
   */
  readabilityOptions?: {
    debug?: boolean;
    maxEagerCacheSize?: number;
    nbTopCandidates?: number;
    charThreshold?: number;
    classesToPreserve?: string[];
  };
  
  /**
   * 除外方法
   */
  method?: 'hide' | 'remove';
}

/**
 * ページから本文コンテンツを抽出するスクリプト
 */
export const extractMainContentScript = (options: ContentExcludeOptions = {}) => `
(() => {
  try {
    // Readabilityライブラリがグローバルに存在するかチェック
    if (typeof Readability === 'undefined') {
      console.error('Readability library is not loaded');
      return { success: false, error: 'Readability library not found' };
    }
    
    // ドキュメントのクローンを作成
    const documentClone = document.cloneNode(true);
    
    // Readabilityインスタンスを作成
    const reader = new Readability(documentClone, ${JSON.stringify(options.readabilityOptions || {})});
    
    // 記事を解析
    const article = reader.parse();
    
    if (!article) {
      console.warn('No article content found by Readability');
      return { 
        success: false, 
        error: 'No article content found',
        stats: {
          totalElements: document.querySelectorAll('*').length,
          textLength: document.body.textContent?.length || 0
        }
      };
    }
    
    // 本文コンテンツのセレクタを特定
    const contentSelectors = [];
    
    // Readabilityが抽出したコンテンツからセレクタを推定
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content;
    
    // 本文に含まれるテキストの断片を収集
    const textFragments = [];
    const walker = document.createTreeWalker(
      tempDiv,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const text = node.textContent?.trim();
          if (text && text.length > 20) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    let textNode;
    while (textNode = walker.nextNode()) {
      const fragment = textNode.textContent.trim().substring(0, 50);
      if (fragment) {
        textFragments.push(fragment);
      }
    }
    
    // DOM内で本文要素を特定
    const mainContentElements = new Set();
    textFragments.forEach(fragment => {
      const xpath = \`//*[contains(text(), "\${fragment.replace(/"/g, '\\\\"')}")]\`;
      try {
        const result = document.evaluate(
          xpath, 
          document, 
          null, 
          XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, 
          null
        );
        
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);
          if (node && node.parentElement) {
            let parent = node.parentElement;
            // 記事のコンテナを見つける
            while (parent && parent !== document.body) {
              const role = parent.getAttribute('role');
              const tagName = parent.tagName.toLowerCase();
              
              if (role === 'main' || role === 'article' || 
                  tagName === 'main' || tagName === 'article' ||
                  parent.classList.contains('content') || 
                  parent.classList.contains('article') ||
                  parent.classList.contains('post') ||
                  parent.classList.contains('entry')) {
                mainContentElements.add(parent);
                break;
              }
              
              // 十分なテキストコンテンツを含む要素
              const textLength = parent.textContent?.length || 0;
              if (textLength > 500) {
                mainContentElements.add(parent);
                break;
              }
              
              parent = parent.parentElement;
            }
          }
        }
      } catch (e) {
        // XPath評価エラーを無視
      }
    });
    
    // セレクタを生成
    mainContentElements.forEach(element => {
      const selector = generateSelector(element);
      if (selector) {
        contentSelectors.push(selector);
      }
    });
    
    // 追加の本文候補セレクタ
    const commonContentSelectors = [
      'main', 
      'article', 
      '[role="main"]', 
      '[role="article"]',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main-content',
      '.content-area',
      '.site-content'
    ];
    
    commonContentSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && element.textContent && element.textContent.length > 200) {
        contentSelectors.push(selector);
      }
    });
    
    return {
      success: true,
      article: {
        title: article.title,
        byline: article.byline,
        excerpt: article.excerpt,
        textContent: article.textContent?.substring(0, 500) + '...',
        length: article.length
      },
      contentSelectors: [...new Set(contentSelectors)],
      stats: {
        totalElements: document.querySelectorAll('*').length,
        identifiedContentElements: mainContentElements.size,
        textLength: document.body.textContent?.length || 0,
        articleLength: article.length
      }
    };
    
    // セレクタ生成ヘルパー関数
    function generateSelector(element) {
      if (element.id) {
        return '#' + element.id;
      }
      
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.trim().split(/\\s+/).filter(c => c);
        if (classes.length > 0) {
          return '.' + classes.join('.');
        }
      }
      
      // タグ名とインデックスによるセレクタ
      const tagName = element.tagName.toLowerCase();
      const parent = element.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => 
          el.tagName.toLowerCase() === tagName
        );
        const index = siblings.indexOf(element);
        if (index >= 0) {
          const parentSelector = generateSelector(parent);
          if (parentSelector) {
            return \`\${parentSelector} > \${tagName}:nth-of-type(\${index + 1})\`;
          }
        }
      }
      
      return null;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
})()
`;

/**
 * 本文コンテンツを除外するスクリプト
 */
export const excludeMainContentScript = (contentSelectors: string[], method: 'hide' | 'remove' = 'hide') => `
(() => {
  const selectors = ${JSON.stringify(contentSelectors)};
  const method = '${method}';
  let excludedCount = 0;
  
  selectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (method === 'hide') {
          // 要素を非表示にする（レイアウトは保持）
          element.style.visibility = 'hidden';
          element.style.opacity = '0';
          // テキストを透明にして選択不可にする
          element.style.color = 'transparent';
          element.style.userSelect = 'none';
          // 背景も透明に
          element.style.backgroundColor = 'transparent';
          
          // 子要素の画像も非表示
          element.querySelectorAll('img').forEach(img => {
            img.style.visibility = 'hidden';
            img.style.opacity = '0';
          });
        } else if (method === 'remove') {
          // 要素を完全に削除（レイアウトが変わる可能性あり）
          element.remove();
        }
        excludedCount++;
      });
    } catch (e) {
      console.error('Error excluding content with selector:', selector, e);
    }
  });
  
  return {
    success: true,
    excludedCount,
    method
  };
})()
`;

/**
 * Readabilityライブラリを注入するスクリプト
 */
export const injectReadabilityScript = () => {
  // @mizchi/readabilityのブラウザ用ビルドを使用
  // 実際の実装では、node_modulesからReadability.jsを読み込む必要があります
  return `
    if (typeof Readability === 'undefined') {
      ${getReadabilitySource()}
    }
  `;
};

/**
 * Readabilityのソースコードを取得
 * 注: 実際の実装では、fs.readFileSyncなどを使用して
 * node_modules/@mizchi/readability/Readability.js を読み込む
 */
function getReadabilitySource(): string {
  // プレースホルダー - 実際にはファイルから読み込む
  return `
    // Readability library will be injected here
    console.warn('Readability library injection not implemented');
  `;
}

/**
 * コンテンツ除外の結果
 */
export interface ContentExcludeResult {
  success: boolean;
  article?: {
    title: string;
    byline: string;
    excerpt: string;
    textContent: string;
    length: number;
  };
  contentSelectors?: string[];
  excludedCount?: number;
  error?: string;
  stats?: {
    totalElements: number;
    identifiedContentElements?: number;
    textLength: number;
    articleLength?: number;
  };
}