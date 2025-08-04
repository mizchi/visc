import puppeteer from 'puppeteer';
import { analyzeLayout } from '../layout/extractor.js';
import type { LayoutAnalysisResult } from '../layout/extractor.js';

export async function fetchLayoutAnalysis(
  url: string,
  options: {
    viewport?: { width: number; height: number };
    headless?: boolean;
    groupingThreshold?: number;
    importanceThreshold?: number;
  } = {},
): Promise<LayoutAnalysisResult> {
  const { 
    viewport = { width: 1280, height: 800 }, 
    headless = true,
    groupingThreshold,
    importanceThreshold 
  } = options;
  const browser = await puppeteer.launch({ headless });
  const page = await browser.newPage();
  await page.setViewport(viewport);

  try {
    await page.goto(url, { waitUntil: 'networkidle0' });
    const layoutData = await analyzeLayout(page, {
      groupingThreshold,
      importanceThreshold
    });
    return layoutData;
  } finally {
    await browser.close();
  }
}
