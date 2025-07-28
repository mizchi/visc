import puppeteer from 'puppeteer';
import { createPuppeteerDriver } from '../dist/driver/puppeteer-driver.js';

export async function createPuppeteerDriverWithPage(options?: { headless?: boolean }) {
  const browser = await puppeteer.launch({
    headless: options?.headless ?? true
  });
  
  const page = await browser.newPage();
  
  const driver = createPuppeteerDriver({
    page,
    browser,
    viewport: { width: 1280, height: 720 }
  });
  
  // クリーンアップ関数を追加
  const originalClose = driver.close;
  driver.close = async () => {
    await originalClose();
    await browser.close();
  };
  
  return driver;
}