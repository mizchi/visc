import puppeteer, { Page, Browser } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export interface PuppeteerScreenshotOptions {
  url: string;
  viewport: {
    width: number;
    height: number;
    deviceScaleFactor?: number;
  };
  fullPage?: boolean;
  quality?: number; // JPEG quality 0-100
  format?: 'png' | 'jpeg';
  cacheDir?: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  userAgent?: string;
  headless?: boolean;
}

export interface ScreenshotResult {
  path: string;
  cached: boolean;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Generate cache key for screenshot
 */
function generateCacheKey(options: PuppeteerScreenshotOptions): string {
  const keyData = {
    url: options.url,
    viewport: options.viewport,
    fullPage: options.fullPage,
    format: options.format,
    quality: options.quality,
    userAgent: options.userAgent
  };
  
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(keyData));
  return hash.digest('hex').substring(0, 16);
}

/**
 * Take screenshot using Puppeteer
 */
export async function takePuppeteerScreenshot(
  options: PuppeteerScreenshotOptions
): Promise<ScreenshotResult> {
  const {
    url,
    viewport,
    fullPage = false,
    quality = 70, // Lower quality by default to reduce file size
    format = 'jpeg',
    cacheDir = '.visc/cache/screenshots',
    waitUntil = 'networkidle2',
    timeout = 30000,
    userAgent,
    headless = true
  } = options;

  // Generate cache key and file path
  const cacheKey = generateCacheKey(options);
  const fileName = `${cacheKey}.${format}`;
  const filePath = path.join(cacheDir, fileName);

  // Check if cached screenshot exists
  try {
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      // Get image dimensions from cached file
      return {
        path: filePath,
        cached: true,
        size: stats.size,
        dimensions: {
          width: viewport.width,
          height: viewport.height
        }
      };
    }
  } catch {
    // File doesn't exist, continue to take screenshot
  }

  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true });

  // Launch browser and take screenshot
  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor || 1
    });
    
    // Set user agent if provided
    if (userAgent) {
      await page.setUserAgent(userAgent);
    }
    
    // Navigate to URL
    await page.goto(url, {
      waitUntil: waitUntil as any,
      timeout
    });
    
    // Wait for any lazy-loaded content
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take screenshot
    const screenshotOptions: any = {
      path: filePath,
      fullPage,
      type: format
    };
    
    if (format === 'jpeg') {
      screenshotOptions.quality = quality;
    }
    
    await page.screenshot(screenshotOptions);
    
    // Get file stats
    const stats = await fs.stat(filePath);
    
    // Get actual dimensions
    let dimensions = { width: viewport.width, height: viewport.height };
    if (fullPage) {
      // For full page screenshots, get the actual page dimensions
      const pageHeight = await page.evaluate(() => {
        return Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
      });
      dimensions.height = pageHeight;
    }
    
    return {
      path: filePath,
      cached: false,
      size: stats.size,
      dimensions
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Take multiple screenshots for different viewports
 */
export async function takeMultipleScreenshots(
  url: string,
  viewports: Array<{
    id: string;
    width: number;
    height: number;
    deviceScaleFactor?: number;
  }>,
  options: Partial<PuppeteerScreenshotOptions> = {}
): Promise<Map<string, ScreenshotResult>> {
  const results = new Map<string, ScreenshotResult>();
  
  // Launch browser once for all screenshots
  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage();
      
      try {
        // Set viewport
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: viewport.deviceScaleFactor || 1
        });
        
        // Navigate and screenshot
        const result = await takePuppeteerScreenshotWithPage(page, {
          url,
          viewport: {
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: viewport.deviceScaleFactor
          },
          ...options
        });
        
        results.set(viewport.id, result);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  
  return results;
}

/**
 * Take screenshot with existing page instance
 */
async function takePuppeteerScreenshotWithPage(
  page: Page,
  options: PuppeteerScreenshotOptions
): Promise<ScreenshotResult> {
  const {
    url,
    viewport,
    fullPage = false,
    quality = 70,
    format = 'jpeg',
    cacheDir = '.visc/cache/screenshots',
    waitUntil = 'networkidle2',
    timeout = 30000,
    userAgent
  } = options;

  // Generate cache key and file path
  const cacheKey = generateCacheKey(options);
  const fileName = `${cacheKey}.${format}`;
  const filePath = path.join(cacheDir, fileName);

  // Check if cached screenshot exists
  try {
    const stats = await fs.stat(filePath);
    if (stats.isFile()) {
      return {
        path: filePath,
        cached: true,
        size: stats.size,
        dimensions: {
          width: viewport.width,
          height: viewport.height
        }
      };
    }
  } catch {
    // File doesn't exist, continue
  }

  // Ensure cache directory exists
  await fs.mkdir(cacheDir, { recursive: true });

  // Set user agent if provided
  if (userAgent) {
    await page.setUserAgent(userAgent);
  }
  
  // Navigate to URL
  await page.goto(url, {
    waitUntil: waitUntil as any,
    timeout
  });
  
  // Wait for any lazy-loaded content
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Take screenshot
  const screenshotOptions: any = {
    path: filePath,
    fullPage,
    type: format
  };
  
  if (format === 'jpeg') {
    screenshotOptions.quality = quality;
  }
  
  await page.screenshot(screenshotOptions);
  
  // Get file stats
  const stats = await fs.stat(filePath);
  
  // Get actual dimensions
  let dimensions = { width: viewport.width, height: viewport.height };
  if (fullPage) {
    const pageHeight = await page.evaluate(() => {
      return Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.clientHeight,
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight
      );
    });
    dimensions.height = pageHeight;
  }
  
  return {
    path: filePath,
    cached: false,
    size: stats.size,
    dimensions
  };
}

/**
 * Clear screenshot cache
 */
export async function clearScreenshotCache(cacheDir = '.visc/cache/screenshots'): Promise<void> {
  try {
    const files = await fs.readdir(cacheDir);
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpeg') || file.endsWith('.jpg')) {
        await fs.unlink(path.join(cacheDir, file));
      }
    }
  } catch (error) {
    // Directory might not exist
    console.debug('Could not clear cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(cacheDir = '.visc/cache/screenshots'): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestFile?: Date;
  newestFile?: Date;
}> {
  try {
    const files = await fs.readdir(cacheDir);
    let totalSize = 0;
    let oldestTime: number | undefined;
    let newestTime: number | undefined;
    
    for (const file of files) {
      if (file.endsWith('.png') || file.endsWith('.jpeg') || file.endsWith('.jpg')) {
        const filePath = path.join(cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        const time = stats.mtimeMs;
        if (!oldestTime || time < oldestTime) oldestTime = time;
        if (!newestTime || time > newestTime) newestTime = time;
      }
    }
    
    return {
      totalFiles: files.length,
      totalSize,
      oldestFile: oldestTime ? new Date(oldestTime) : undefined,
      newestFile: newestTime ? new Date(newestTime) : undefined
    };
  } catch {
    return {
      totalFiles: 0,
      totalSize: 0
    };
  }
}