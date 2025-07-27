import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { 
  compareLayoutsWithContentExclusion,
  analyzeLayoutWithContentAwareness 
} from '../../src/layout/content-aware-comparator.js';

describe('Content-Aware Layout Comparator', () => {
  let browser: Browser;
  let page1: Page;
  let page2: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page1 = await browser.newPage();
    page2 = await browser.newPage();
  });

  afterEach(async () => {
    await page1.close();
    await page2.close();
  });

  it('should extract and exclude main content from article pages', async () => {
    const articleHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Test Article</title>
        <style>
          body { margin: 0; font-family: Arial; }
          header { background: #333; color: white; padding: 20px; }
          nav { background: #666; padding: 10px; }
          .sidebar { float: left; width: 200px; background: #f0f0f0; padding: 20px; }
          main { margin-left: 240px; padding: 20px; }
          article { line-height: 1.6; }
          footer { clear: both; background: #333; color: white; padding: 20px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <header>
          <h1>News Site</h1>
        </header>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
        <div class="sidebar">
          <h3>Related Articles</h3>
          <ul>
            <li><a href="/article1">Article 1</a></li>
            <li><a href="/article2">Article 2</a></li>
            <li><a href="/article3">Article 3</a></li>
          </ul>
        </div>
        <main>
          <article>
            <h2>Important News Article</h2>
            <p class="byline">By John Doe - January 27, 2025</p>
            <p>This is the main content of the article. It contains important information that should be extracted by Readability. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
            <p>Another paragraph with more content. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
            <p>Final paragraph of the article. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. This text should be identified as main content and excluded during layout comparison.</p>
          </article>
        </main>
        <footer>
          <p>&copy; 2025 News Site. All rights reserved.</p>
        </footer>
      </body>
      </html>
    `;

    await page1.setContent(articleHTML);
    await page2.setContent(articleHTML);

    const result = await compareLayoutsWithContentExclusion(page1, page2, {
      excludeContent: true,
      excludeMethod: 'hide'
    });

    // 本文が正しく抽出されたか確認
    expect(result.contentExtraction).toBeDefined();
    expect(result.contentExtraction?.baseline.success).toBe(true);
    expect(result.contentExtraction?.baseline.title).toContain('Test Article');
    expect(result.contentExtraction?.baseline.textLength).toBeGreaterThan(100);

    // 本文除外後の比較結果が存在するか確認
    expect(result.excludedContentComparison).toBeDefined();
    expect(result.excludedContentComparison?.similarity).toBe(100); // 同じページなので100%一致
  });

  it('should compare layouts without content extraction when disabled', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <header>Header</header>
        <main>
          <article>
            <h1>Title</h1>
            <p>Content paragraph that would normally be extracted.</p>
          </article>
        </main>
        <footer>Footer</footer>
      </body>
      </html>
    `;

    await page1.setContent(html);
    await page2.setContent(html);

    const result = await compareLayoutsWithContentExclusion(page1, page2, {
      excludeContent: false
    });

    // 本文抽出が行われていないことを確認
    expect(result.contentExtraction).toBeUndefined();
    expect(result.excludedContentComparison).toBeUndefined();
    expect(result.similarity).toBe(100);
  });

  it('should detect layout differences when content is excluded', async () => {
    const baseHTML = `
      <!DOCTYPE html>
      <html>
      <body>
        <nav style="height: 50px; background: #333;">Navigation</nav>
        <main>
          <article>
            <h1>Article Title</h1>
            <p>This is the main content that will be excluded. It's quite long and contains multiple sentences to ensure Readability can identify it as the main content.</p>
          </article>
        </main>
        <aside style="width: 200px; float: right; background: #f0f0f0;">Sidebar</aside>
      </body>
      </html>
    `;

    const modifiedHTML = `
      <!DOCTYPE html>
      <html>
      <body>
        <nav style="height: 100px; background: #333;">Navigation</nav>
        <main>
          <article>
            <h1>Different Article Title</h1>
            <p>This is completely different content but in the same layout structure. The navigation height has changed, which should be detected even when content is excluded.</p>
          </article>
        </main>
        <aside style="width: 200px; float: right; background: #f0f0f0;">Sidebar</aside>
      </body>
      </html>
    `;

    await page1.setContent(baseHTML);
    await page2.setContent(modifiedHTML);

    const result = await compareLayoutsWithContentExclusion(page1, page2, {
      excludeContent: true,
      excludeMethod: 'hide'
    });

    // レイアウトの違いが検出されることを確認（ナビゲーションの高さが異なる）
    expect(result.excludedContentComparison).toBeDefined();
    expect(result.excludedContentComparison?.similarity).toBeLessThan(100);
    expect(result.excludedContentComparison?.differences.length).toBeGreaterThan(0);
  });

  it('should handle different exclusion methods', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <header>Site Header</header>
        <main>
          <article>
            <h1>Article</h1>
            <p>Main content paragraph with enough text to be identified as article content by Readability. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
          </article>
        </main>
        <footer>Site Footer</footer>
      </body>
      </html>
    `;

    await page1.setContent(html);
    await page2.setContent(html);

    // hideメソッドでテスト
    const hideResult = await compareLayoutsWithContentExclusion(page1, page2, {
      excludeContent: true,
      excludeMethod: 'hide'
    });

    // 要素の可視性を確認
    const hiddenElements = await page1.evaluate(() => {
      const articles = document.querySelectorAll('article');
      return Array.from(articles).map(el => ({
        visibility: (el as HTMLElement).style.visibility,
        opacity: (el as HTMLElement).style.opacity
      }));
    });

    expect(hiddenElements.some(el => el.visibility === 'hidden')).toBe(true);
  });

  it('should analyze layout with content awareness', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <body>
        <header>
          <h1>Blog Title</h1>
        </header>
        <main>
          <article>
            <h2>Blog Post</h2>
            <div class="meta">Published on January 27, 2025</div>
            <div class="content">
              <p>This is a blog post with substantial content that should be identified by Readability. It includes multiple paragraphs and various HTML elements.</p>
              <p>Another paragraph to ensure there's enough content for proper extraction.</p>
            </div>
          </article>
        </main>
        <footer>
          <p>Copyright 2025</p>
        </footer>
      </body>
      </html>
    `;

    await page1.setContent(html);

    const analysis = await analyzeLayoutWithContentAwareness('data:text/html,' + encodeURIComponent(html), page1, {
      excludeContent: true
    });

    expect(analysis.layout).toBeDefined();
    expect(analysis.contentExtraction).toBeDefined();
    expect(analysis.layoutWithoutContent).toBeDefined();
    
    // レイアウトが本文除外前後で異なることを確認
    expect(analysis.layout).not.toEqual(analysis.layoutWithoutContent);
  });

  it('should handle pages without identifiable main content', async () => {
    const navigationHTML = `
      <!DOCTYPE html>
      <html>
      <body>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/products">Products</a></li>
            <li><a href="/services">Services</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </nav>
        <div class="cta">
          <button>Get Started</button>
        </div>
      </body>
      </html>
    `;

    await page1.setContent(navigationHTML);
    await page2.setContent(navigationHTML);

    const result = await compareLayoutsWithContentExclusion(page1, page2, {
      excludeContent: true
    });

    // 本文が見つからない場合でもエラーにならないことを確認
    expect(result.contentExtraction?.baseline.success).toBe(false);
    expect(result.similarity).toBe(100); // レイアウトは同じ
  });
});