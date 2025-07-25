import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { extractSemanticLayoutScript } from '../../src/layout/semantic-analyzer.js';
import { calculateVisualSimilarity, isVisuallyEqualLayout } from '../../src/layout/rect-distance-visual.js';
import type { LayoutAnalysisResult } from '../../src/layout/extractor.js';

describe('DOM variation integration tests', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  async function createPageWithHTML(html: string): Promise<LayoutAnalysisResult> {
    const page = await browser.newPage();
    await page.setContent(html);
    await page.waitForLoadState('domcontentloaded');
    
    const layout = await page.evaluate(extractSemanticLayoutScript);
    await page.close();
    
    return layout;
  }

  test('テーブルレイアウトとFlexboxレイアウトが同じとして識別される', async () => {
    // テーブルレイアウト
    const tableHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 20px; vertical-align: top; }
          .header { background: #333; color: white; height: 60px; }
          .sidebar { background: #f0f0f0; width: 200px; }
          .content { background: white; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="2" class="header">
              <h1>My Website</h1>
            </td>
          </tr>
          <tr>
            <td class="sidebar">
              <nav>
                <ul>
                  <li><a href="#">Home</a></li>
                  <li><a href="#">About</a></li>
                  <li><a href="#">Contact</a></li>
                </ul>
              </nav>
            </td>
            <td class="content">
              <main>
                <h2>Welcome</h2>
                <p>This is the main content area.</p>
                <p>Lorem ipsum dolor sit amet.</p>
              </main>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Flexboxレイアウト
    const flexHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; }
          .container { display: flex; flex-direction: column; min-height: 100vh; }
          .header { background: #333; color: white; height: 60px; padding: 20px; }
          .main-content { display: flex; flex: 1; }
          .sidebar { background: #f0f0f0; width: 200px; padding: 20px; }
          .content { background: white; flex: 1; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="header">
            <h1>My Website</h1>
          </header>
          <div class="main-content">
            <aside class="sidebar">
              <nav>
                <ul>
                  <li><a href="#">Home</a></li>
                  <li><a href="#">About</a></li>
                  <li><a href="#">Contact</a></li>
                </ul>
              </nav>
            </aside>
            <main class="content">
              <h2>Welcome</h2>
              <p>This is the main content area.</p>
              <p>Lorem ipsum dolor sit amet.</p>
            </main>
          </div>
        </div>
      </body>
      </html>
    `;

    const tableLayout = await createPageWithHTML(tableHTML);
    const flexLayout = await createPageWithHTML(flexHTML);

    if (!tableLayout.semanticGroups || !flexLayout.semanticGroups) {
      throw new Error('Failed to extract semantic groups');
    }

    const similarity = calculateVisualSimilarity(
      tableLayout.semanticGroups,
      flexLayout.semanticGroups
    );

    // 視覚的に同じレイアウトなので高い類似度
    expect(similarity.similarity).toBeGreaterThan(0.7);
    
    // ヘッダー、サイドバー、メインコンテンツがマッチするはず
    expect(similarity.matchedGroups.length).toBeGreaterThanOrEqual(2);
    
    // 構造として同じと判定される
    expect(isVisuallyEqualLayout(
      tableLayout.semanticGroups,
      flexLayout.semanticGroups,
      0.7
    )).toBe(true);
  });

  test('インラインスタイルとCSSクラスの同じレイアウト', async () => {
    // インラインスタイル
    const inlineHTML = `
      <!DOCTYPE html>
      <html>
      <body style="margin: 0;">
        <div style="background: navy; color: white; padding: 10px 20px;">
          <h1 style="margin: 0;">Site Title</h1>
        </div>
        <div style="display: flex; gap: 20px; padding: 20px;">
          <div style="background: #f0f0f0; padding: 20px; width: 300px;">
            <h3>Card 1</h3>
            <p>Content for card 1</p>
          </div>
          <div style="background: #f0f0f0; padding: 20px; width: 300px;">
            <h3>Card 2</h3>
            <p>Content for card 2</p>
          </div>
          <div style="background: #f0f0f0; padding: 20px; width: 300px;">
            <h3>Card 3</h3>
            <p>Content for card 3</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // CSSクラス
    const classHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; }
          .header { background: navy; color: white; padding: 10px 20px; }
          .header h1 { margin: 0; }
          .cards { display: flex; gap: 20px; padding: 20px; }
          .card { background: #f0f0f0; padding: 20px; width: 300px; }
        </style>
      </head>
      <body>
        <header class="header">
          <h1>Site Title</h1>
        </header>
        <section class="cards">
          <article class="card">
            <h3>Card 1</h3>
            <p>Content for card 1</p>
          </article>
          <article class="card">
            <h3>Card 2</h3>
            <p>Content for card 2</p>
          </article>
          <article class="card">
            <h3>Card 3</h3>
            <p>Content for card 3</p>
          </article>
        </section>
      </body>
      </html>
    `;

    const inlineLayout = await createPageWithHTML(inlineHTML);
    const classLayout = await createPageWithHTML(classHTML);

    if (!inlineLayout.semanticGroups || !classLayout.semanticGroups) {
      throw new Error('Failed to extract semantic groups');
    }

    const similarity = calculateVisualSimilarity(
      inlineLayout.semanticGroups,
      classLayout.semanticGroups
    );

    // スタイリング方法が違っても同じレイアウト
    expect(similarity.similarity).toBeGreaterThan(0.75);
    
    // 同じ構造として識別
    expect(isVisuallyEqualLayout(
      inlineLayout.semanticGroups,
      classLayout.semanticGroups,
      0.7
    )).toBe(true);
  });

  test('divスープとセマンティックHTMLの同じレイアウト', async () => {
    // divスープ
    const divSoupHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; }
          .top-bar { background: #333; color: white; padding: 15px; }
          .wrapper { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .box { margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <div class="wrapper">
            <div>Company Name</div>
          </div>
        </div>
        <div class="wrapper">
          <div class="box">
            <div style="font-size: 24px; margin-bottom: 10px;">Article Title</div>
            <div>Published on January 1, 2024</div>
            <div style="margin-top: 15px;">
              <p>This is the article content.</p>
              <p>More content here.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // セマンティックHTML
    const semanticHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; }
          header { background: #333; color: white; padding: 15px; }
          .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
          article { margin-bottom: 20px; padding: 20px; border: 1px solid #ddd; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          .meta { color: #666; }
          .content { margin-top: 15px; }
        </style>
      </head>
      <body>
        <header>
          <div class="container">
            <span>Company Name</span>
          </div>
        </header>
        <main class="container">
          <article>
            <h1>Article Title</h1>
            <div class="meta">Published on <time>January 1, 2024</time></div>
            <div class="content">
              <p>This is the article content.</p>
              <p>More content here.</p>
            </div>
          </article>
        </main>
      </body>
      </html>
    `;

    const divLayout = await createPageWithHTML(divSoupHTML);
    const semanticLayout = await createPageWithHTML(semanticHTML);

    if (!divLayout.semanticGroups || !semanticLayout.semanticGroups) {
      throw new Error('Failed to extract semantic groups');
    }

    const similarity = calculateVisualSimilarity(
      divLayout.semanticGroups,
      semanticLayout.semanticGroups
    );

    // HTML構造は違っても視覚的に同じ
    expect(similarity.similarity).toBeGreaterThan(0.65);
    
    // 主要な領域がマッチ
    const hasHeaderMatch = similarity.matchedGroups.some(m => 
      m.group1.bounds.y < 100 && m.group2.bounds.y < 100
    );
    const hasContentMatch = similarity.matchedGroups.some(m => 
      m.group1.bounds.y > 100 && m.group2.bounds.y > 100
    );
    
    expect(hasHeaderMatch).toBe(true);
    expect(hasContentMatch).toBe(true);
  });

  test('異なるグリッドシステムで実装された同じレイアウト', async () => {
    // Bootstrap風グリッド
    const bootstrapHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; }
          .container { max-width: 1200px; margin: 0 auto; padding: 0 15px; }
          .row { display: flex; margin: 0 -15px; }
          .col-4 { flex: 0 0 33.333%; padding: 0 15px; }
          .feature { background: #f8f9fa; padding: 30px; text-align: center; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="row">
            <div class="col-4">
              <div class="feature">
                <h3>Feature 1</h3>
                <p>Description of feature 1</p>
              </div>
            </div>
            <div class="col-4">
              <div class="feature">
                <h3>Feature 2</h3>
                <p>Description of feature 2</p>
              </div>
            </div>
            <div class="col-4">
              <div class="feature">
                <h3>Feature 3</h3>
                <p>Description of feature 3</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    // CSS Grid
    const cssGridHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; }
          .features { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 30px; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 0 15px; 
          }
          .feature-item { 
            background: #f8f9fa; 
            padding: 30px; 
            text-align: center; 
          }
        </style>
      </head>
      <body>
        <section class="features">
          <div class="feature-item">
            <h3>Feature 1</h3>
            <p>Description of feature 1</p>
          </div>
          <div class="feature-item">
            <h3>Feature 2</h3>
            <p>Description of feature 2</p>
          </div>
          <div class="feature-item">
            <h3>Feature 3</h3>
            <p>Description of feature 3</p>
          </div>
        </section>
      </body>
      </html>
    `;

    const bootstrapLayout = await createPageWithHTML(bootstrapHTML);
    const gridLayout = await createPageWithHTML(cssGridHTML);

    if (!bootstrapLayout.semanticGroups || !gridLayout.semanticGroups) {
      throw new Error('Failed to extract semantic groups');
    }

    const similarity = calculateVisualSimilarity(
      bootstrapLayout.semanticGroups,
      gridLayout.semanticGroups
    );

    // 異なるグリッドシステムでも同じレイアウト
    expect(similarity.similarity).toBeGreaterThan(0.7);
    
    // 3つのフィーチャーボックスがマッチ
    const contentMatches = similarity.matchedGroups.filter(m => 
      m.group1.type === 'content' || m.group1.type === 'group'
    );
    expect(contentMatches.length).toBeGreaterThanOrEqual(3);
  });
});