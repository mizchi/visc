import puppeteer from 'puppeteer';
import { analyzeLayout } from '../layout/extractor.js';
import type { LayoutAnalysisResult } from '../layout/extractor.js';

// 遅延ロードされる要素を待つためのシンプルな待機戦略
async function waitForLazyContent(page: any): Promise<void> {
  // 少し待つ
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // ページの下部までスクロールして遅延ロードコンテンツをトリガー
  const scrollInfo = await page.evaluate(() => {
    return new Promise((resolve) => {
      const initialHeight = document.body.scrollHeight;
      let totalHeight = 0;
      const distance = 100;
      let scrollCount = 0;
      const maxScrolls = 50; // 最大スクロール回数
      
      const timer = setInterval(() => {
        const currentScrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        scrollCount++;
        
        // スクロールが完了したか、最大回数に達したか
        if (totalHeight >= currentScrollHeight - window.innerHeight || scrollCount >= maxScrolls) {
          clearInterval(timer);
          // スクロール完了後、少し待つ
          setTimeout(() => {
            window.scrollTo(0, 0); // トップに戻る
            resolve({
              initialHeight,
              finalHeight: document.body.scrollHeight,
              scrollCount,
              totalScrolled: totalHeight
            });
          }, 2000); // 2秒待つ
        }
      }, 200); // スクロール間隔を200msに
    });
  });
  
  console.log('Scroll info:', scrollInfo);
  
  // 追加の待機時間を設けて、動的コンテンツの読み込みを確実に待つ
  await new Promise(resolve => setTimeout(resolve, 2000));
}

export async function fetchLayoutAnalysis(
  url: string,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    groupingThreshold?: number;
    importanceThreshold?: number;
    waitForContent?: boolean;
  } = {},
): Promise<LayoutAnalysisResult> {
  const { 
    viewport = { width: 1280, height: 800 }, 
    headless = true,
    groupingThreshold,
    importanceThreshold,
    waitForContent = true
  } = options;
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // 遅延ロードされる要素を確実に取得
    if (waitForContent) {
      console.log('Waiting for content to load...');
      await waitForLazyContent(page);
      console.log('Content loading complete');
    }
    
    const layoutData = await analyzeLayout(page, {
      groupingThreshold,
      importanceThreshold
    });
    return layoutData;
  } finally {
    await browser.close();
  }
}
