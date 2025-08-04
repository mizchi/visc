import puppeteer from 'puppeteer';
import { analyzeLayout } from '../layout/extractor.js';
import type { LayoutAnalysisResult } from '../layout/extractor.js';

// ページを自動的にスクロールして遅延ロードコンテンツを読み込む
async function autoScroll(page: any): Promise<void> {
  await page.evaluate(`(async () => {
    const distance = 500;
    const delay = 300;
    const maxScrolls = 50; // 無限ループを防ぐ
    let scrollCount = 0;
    
    while (
      document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight &&
      scrollCount < maxScrolls
    ) {
      document.scrollingElement.scrollBy(0, distance);
      scrollCount++;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // 最後まで到達したら、もう一度上部に戻る
    document.scrollingElement.scrollTop = 0;
    await new Promise(resolve => setTimeout(resolve, 500));
  })()`)
}

export async function fetchLayoutAnalysis(
  url: string,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    groupingThreshold?: number;
    importanceThreshold?: number;
    scrollToBottom?: boolean;
  } = {},
): Promise<LayoutAnalysisResult> {
  const { 
    viewport = { width: 1280, height: 800 }, 
    headless = true,
    groupingThreshold,
    importanceThreshold,
    scrollToBottom = true
  } = options;
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    
    // ページの下部までスクロールして遅延マウントされる要素を読み込む
    if (scrollToBottom) {
      await autoScroll(page);
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
