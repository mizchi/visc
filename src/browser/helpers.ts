import puppeteer from "puppeteer";
import { fetchRawLayoutData, extractLayoutTree } from "./puppeteer.js";
import type { VisualTreeAnalysis } from "../layout/extractor.js";

/**
 * ブラウザインスタンスを作成し、管理するためのヘルパー
 */
export async function withBrowser<T>(
  callback: (browser: any) => Promise<T>,
  options: { headless?: boolean } = {}
): Promise<T> {
  const browser = await puppeteer.launch({
    headless: options.headless ?? true,
  });
  try {
    return await callback(browser);
  } finally {
    await browser.close();
  }
}

/**
 * ページインスタンスを作成し、管理するためのヘルパー
 */
export async function withPage<T>(
  browser: any,
  url: string,
  callback: (page: any) => Promise<T>,
  options: {
    viewport?: { width: number; height: number };
    waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
  } = {}
): Promise<T> {
  const page = await browser.newPage();
  const {
    viewport = { width: 1280, height: 800 },
    waitUntil = "networkidle0",
  } = options;

  await page.setViewport(viewport);
  await page.goto(url, { waitUntil });

  try {
    return await callback(page);
  } finally {
    await page.close();
  }
}

/**
 * 複数のURLからレイアウトを並列で取得
 */
export async function getLayoutsParallel(
  urls: string[],
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    groupingThreshold?: number;
    importanceThreshold?: number;
    waitForContent?: boolean;
    captureFullPage?: boolean;
  } = {}
): Promise<VisualTreeAnalysis[]> {
  return withBrowser(
    async (browser) => {
      const promises = urls.map((url) =>
        withPage(
          browser,
          url,
          async (page) => {
            const rawData = await fetchRawLayoutData(page, {
              waitForContent: options.waitForContent,
              captureFullPage: options.captureFullPage,
            });
            return extractLayoutTree(rawData, {
              groupingThreshold: options.groupingThreshold,
              importanceThreshold: options.importanceThreshold,
              viewportOnly: !options.captureFullPage,
            });
          },
          { viewport: options.viewport }
        )
      );

      return Promise.all(promises);
    },
    { headless: options.headless }
  );
}

/**
 * 単一URLから複数回レイアウトを取得（安定性チェック用）
 */
export async function getLayoutsSamples(
  url: string,
  sampleCount: number,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    groupingThreshold?: number;
    importanceThreshold?: number;
    waitForContent?: boolean;
    captureFullPage?: boolean;
    delay?: number;
  } = {}
): Promise<VisualTreeAnalysis[]> {
  const samples: VisualTreeAnalysis[] = [];
  const { delay = 1000, ...layoutOptions } = options;

  return withBrowser(
    async (browser) => {
      for (let i = 0; i < sampleCount; i++) {
        const layout = await withPage(
          browser,
          url,
          async (page) => {
            const rawData = await fetchRawLayoutData(page, {
              waitForContent: layoutOptions.waitForContent,
              captureFullPage: layoutOptions.captureFullPage,
            });
            return extractLayoutTree(rawData, {
              groupingThreshold: layoutOptions.groupingThreshold,
              importanceThreshold: layoutOptions.importanceThreshold,
              viewportOnly: !layoutOptions.captureFullPage,
            });
          },
          { viewport: layoutOptions.viewport }
        );

        samples.push(layout);

        if (i < sampleCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      return samples;
    },
    { headless: layoutOptions.headless }
  );
}
