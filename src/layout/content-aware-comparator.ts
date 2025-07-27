import { Page } from 'playwright';
import { readable } from '@mizchi/readability';
import { extractLayoutScript } from './extractor.js';
import { compareLayouts } from './comparator.js';
import type { LayoutComparisonResult, LayoutAnalysisResult } from './comparator.js';

export interface ContentAwareComparisonOptions {
  /**
   * 本文除外を有効にするか
   */
  excludeContent?: boolean;
  
  /**
   * 除外方法
   */
  excludeMethod?: 'hide' | 'remove';
  
  /**
   * Readabilityのオプション
   */
  readabilityOptions?: {
    debug?: boolean;
    charThreshold?: number;
    classesToPreserve?: string[];
  };
  
  /**
   * レイアウト比較の閾値
   */
  similarityThreshold?: number;
}

export interface ContentAwareComparisonResult extends LayoutComparisonResult {
  /**
   * 本文抽出の結果
   */
  contentExtraction?: {
    baseline: ContentExtractionResult;
    current: ContentExtractionResult;
  };
  
  /**
   * 本文除外後の比較結果
   */
  excludedContentComparison?: LayoutComparisonResult;
}

export interface ContentExtractionResult {
  success: boolean;
  title?: string;
  byline?: string;
  textLength?: number;
  contentSelectors?: string[];
  error?: string;
}

/**
 * 本文を除外してレイアウトを比較
 */
export async function compareLayoutsWithContentExclusion(
  page1: Page,
  page2: Page,
  options: ContentAwareComparisonOptions = {}
): Promise<ContentAwareComparisonResult> {
  // まず通常のレイアウトを抽出して比較
  const baselineLayout = await page1.evaluate(extractLayoutScript) as LayoutAnalysisResult;
  const currentLayout = await page2.evaluate(extractLayoutScript) as LayoutAnalysisResult;
  
  const normalComparison = compareLayouts(baselineLayout, currentLayout);
  
  // 本文除外が無効な場合は通常の比較結果を返す
  if (!options.excludeContent) {
    return normalComparison as ContentAwareComparisonResult;
  }
  
  // 本文抽出と除外
  const baselineContent = await extractAndExcludeContent(page1, options);
  const currentContent = await extractAndExcludeContent(page2, options);
  
  // 本文除外後のレイアウトを再抽出
  const excludedBaselineLayout = await page1.evaluate(extractLayoutScript) as LayoutAnalysisResult;
  const excludedCurrentLayout = await page2.evaluate(extractLayoutScript) as LayoutAnalysisResult;
  
  // 本文除外後のレイアウトを比較
  const excludedComparison = compareLayouts(excludedBaselineLayout, excludedCurrentLayout);
  
  return {
    ...normalComparison,
    contentExtraction: {
      baseline: baselineContent,
      current: currentContent
    },
    excludedContentComparison: excludedComparison
  };
}

/**
 * ページから本文を抽出して除外
 */
async function extractAndExcludeContent(
  page: Page,
  options: ContentAwareComparisonOptions
): Promise<ContentExtractionResult> {
  try {
    // ページのHTMLを取得
    const html = await page.content();
    const url = page.url();
    
    // Readabilityで解析
    const readableInstance = readable(html, {
      url,
      ...options.readabilityOptions
    });
    
    const snapshot = readableInstance.snapshot;
    
    if (!snapshot || !snapshot.root) {
      return {
        success: false,
        error: 'No content found by Readability'
      };
    }
    
    // 本文のテキストを取得（Markdownに変換）
    const articleText = readableInstance.toMarkdown();
    
    // 本文要素を特定して除外
    const contentSelectors = await identifyContentSelectors(page, articleText);
    
    if (contentSelectors.length > 0) {
      await excludeContentElements(page, contentSelectors, options.excludeMethod || 'hide');
    }
    
    return {
      success: true,
      title: snapshot.metadata?.title,
      byline: undefined, // bylineは直接取得できない
      textLength: articleText.length,
      contentSelectors
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 本文要素のセレクタを特定
 */
async function identifyContentSelectors(
  page: Page,
  articleText: string
): Promise<string[]> {
  return await page.evaluate((text) => {
    const selectors: string[] = [];
    
    // テキストの断片を使って要素を検索
    const textFragments = text
      .split(/\s+/)
      .filter(word => word.length > 10)
      .slice(0, 10);
    
    const contentElements = new Set<Element>();
    
    // 各断片を含む要素を探す
    textFragments.forEach(fragment => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (node.textContent?.includes(fragment)) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_SKIP;
          }
        }
      );
      
      let textNode;
      while (textNode = walker.nextNode()) {
        let parent = textNode.parentElement;
        while (parent && parent !== document.body) {
          // 記事コンテナの可能性が高い要素を探す
          const role = parent.getAttribute('role');
          const tagName = parent.tagName.toLowerCase();
          const classList = Array.from(parent.classList);
          
          if (
            role === 'main' || 
            role === 'article' ||
            tagName === 'main' || 
            tagName === 'article' ||
            classList.some(cls => /content|article|post|entry|text/.test(cls))
          ) {
            contentElements.add(parent);
            break;
          }
          
          // 十分なテキストを含む要素
          if ((parent.textContent?.length || 0) > 500) {
            contentElements.add(parent);
            break;
          }
          
          parent = parent.parentElement;
        }
      }
    });
    
    // セレクタを生成
    contentElements.forEach(element => {
      if (element.id) {
        selectors.push(`#${element.id}`);
      } else if (element.className) {
        const classes = Array.from(element.classList).join('.');
        if (classes) {
          selectors.push(`.${classes}`);
        }
      }
    });
    
    // 一般的な記事セレクタも追加
    const commonSelectors = [
      'main', 
      'article', 
      '[role="main"]', 
      '[role="article"]',
      '.main-content',
      '.article-content',
      '.post-content',
      '.entry-content'
    ];
    
    commonSelectors.forEach(selector => {
      const element = document.querySelector(selector);
      if (element && (element.textContent?.length || 0) > 200) {
        selectors.push(selector);
      }
    });
    
    return [...new Set(selectors)];
  }, articleText);
}

/**
 * 指定されたセレクタの要素を除外
 */
async function excludeContentElements(
  page: Page,
  selectors: string[],
  method: 'hide' | 'remove'
): Promise<void> {
  await page.evaluate(({ selectors, method }) => {
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          if (element instanceof HTMLElement) {
            if (method === 'hide') {
              // 要素を非表示（レイアウトは保持）
              element.style.visibility = 'hidden';
              element.style.opacity = '0';
              element.style.color = 'transparent';
              element.style.userSelect = 'none';
              element.style.backgroundColor = 'transparent';
              
              // 画像も非表示
              element.querySelectorAll('img').forEach(img => {
                if (img instanceof HTMLElement) {
                  img.style.visibility = 'hidden';
                  img.style.opacity = '0';
                }
              });
            } else if (method === 'remove') {
              // 要素を完全に削除
              element.remove();
            }
          }
        });
      } catch (e) {
        console.error('Error excluding content:', selector, e);
      }
    });
  }, { selectors, method });
}

/**
 * 本文を考慮したレイアウト分析の実行
 */
export async function analyzeLayoutWithContentAwareness(
  url: string,
  page: Page,
  options: ContentAwareComparisonOptions = {}
): Promise<{
  layout: LayoutAnalysisResult;
  contentExtraction?: ContentExtractionResult;
  layoutWithoutContent?: LayoutAnalysisResult;
}> {
  // 通常のレイアウト分析
  const normalLayout = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
  
  if (!options.excludeContent) {
    return { layout: normalLayout };
  }
  
  // 本文抽出と除外
  const contentExtraction = await extractAndExcludeContent(page, options);
  
  // 本文除外後のレイアウト分析
  const layoutWithoutContent = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
  
  return {
    layout: normalLayout,
    contentExtraction,
    layoutWithoutContent
  };
}