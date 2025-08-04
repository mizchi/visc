import puppeteer from 'puppeteer';
import { getExtractLayoutScript } from '../layout/extractor.js';
import type { LayoutAnalysisResult } from '../layout/extractor.js';

export async function fetchLayoutAnalysis(
  url: string,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
  } = {},
): Promise<LayoutAnalysisResult> {
  const { viewport = { width: 1280, height: 800 }, headless = true } = options;
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    const layoutScript = getExtractLayoutScript();
    const layoutData = await page.evaluate(layoutScript);
    return layoutData as LayoutAnalysisResult;
  } finally {
    await browser.close();
  }
}
