import puppeteer from "puppeteer";
import { analyzeLayout } from "../layout/extractor.js";
import type { LayoutAnalysisResult } from "../layout/extractor.js";

// 遅延ロードされる要素を待つためのシンプルな待機戦略
async function waitForLazyContent(page: any): Promise<void> {
  // 少し待つ
  await new Promise((resolve) => setTimeout(resolve, 1000));

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
        if (
          totalHeight >= currentScrollHeight - window.innerHeight ||
          scrollCount >= maxScrolls
        ) {
          clearInterval(timer);
          // スクロール完了後、少し待つ
          setTimeout(() => {
            window.scrollTo(0, 0); // トップに戻る
            resolve({
              initialHeight,
              finalHeight: document.body.scrollHeight,
              scrollCount,
              totalScrolled: totalHeight,
            });
          }, 2000); // 2秒待つ
        }
      }, 200); // スクロール間隔を200msに
    });
  });

  console.log("Scroll info:", scrollInfo);

  // 追加の待機時間を設けて、動的コンテンツの読み込みを確実に待つ
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * ページから生のレイアウトデータを取得
 */
export async function fetchRawLayoutData(
  page: any,
  options: {
    waitForContent?: boolean;
    captureFullPage?: boolean;
  } = {}
): Promise<any> {
  const { waitForContent = false } = options;

  // 遅延ロードされる要素を確実に取得
  if (waitForContent) {
    console.log("Waiting for content to load...");
    await waitForLazyContent(page);
    console.log("Content loading complete");
  }

  // ブラウザでスクリプトを実行してデータを取得
  const { getExtractLayoutScript } = await import("../layout/extractor.js");
  const rawData = await page.evaluate(getExtractLayoutScript());
  return rawData;
}

/**
 * 生データからレイアウトツリーを抽出
 */
export async function extractLayoutTree(
  rawData: any,
  options: {
    groupingThreshold?: number;
    importanceThreshold?: number;
    viewportOnly?: boolean;
  } = {}
): Promise<LayoutAnalysisResult> {
  const { organizeIntoSemanticGroups } = await import("../layout/extractor.js");

  // セマンティックグループに整理
  const semanticGroups = organizeIntoSemanticGroups(rawData.elements, {
    ...options,
    viewport: options.viewportOnly ? rawData.viewport : undefined,
  });

  // パターン検出
  const patterns = detectPatterns(rawData.elements);

  return {
    ...rawData,
    semanticGroups,
    patterns,
    statistics: {
      ...rawData.statistics,
      semanticGroupCount: semanticGroups.length,
      patternCount: patterns.length,
    },
  };
}

// パターン検出のヘルパー関数
function detectPatterns(elements: any[]): any[] {
  const patterns: any[] = [];
  const processed = new Set<number>();

  elements.forEach((el, i) => {
    if (processed.has(i)) return;

    const pattern = {
      elements: [el],
      type: el.tagName,
      className: el.className,
      averageSize: { width: el.rect.width, height: el.rect.height },
    };

    // 類似要素を探す
    elements.forEach((other, j) => {
      if (i === j || processed.has(j)) return;

      // 同じタグとクラス
      if (el.tagName === other.tagName && el.className === other.className) {
        // サイズが類似
        const widthRatio =
          Math.min(el.rect.width, other.rect.width) /
          Math.max(el.rect.width, other.rect.width);
        const heightRatio =
          Math.min(el.rect.height, other.rect.height) /
          Math.max(el.rect.height, other.rect.height);

        if (widthRatio > 0.8 && heightRatio > 0.8) {
          pattern.elements.push(other);
          processed.add(j);
        }
      }
    });

    if (pattern.elements.length >= 2) {
      patterns.push(pattern);
    }
  });

  return patterns;
}
