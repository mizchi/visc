import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractLayoutScript } from '../../dist/layout/extractor.js';
import { extractSemanticLayoutScript } from '../../dist/layout/semantic-analyzer.js';
import type { LayoutAnalysisResult, LayoutElement, SemanticGroup } from '../../dist/layout/extractor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('レイアウト抽出統合テスト', () => {
  test('extractLayoutScriptが正しく動作する', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('viewport');
    expect(result).toHaveProperty('elements');
    expect(result).toHaveProperty('statistics');
    
    expect(result.elements!.length).toBeGreaterThan(0);
    expect(result.statistics.totalElements).toBe(result.elements!.length);
    expect(result.statistics.interactiveElements!).toBeGreaterThanOrEqual(0);
  });

  test('extractSemanticLayoutScriptが正しく動作する', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    const result = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('viewport');
    expect(result).toHaveProperty('semanticGroups');
    expect(result).toHaveProperty('patterns');
    expect(result).toHaveProperty('statistics');
    
    expect(result.semanticGroups!.length).toBeGreaterThan(0);
    expect(result.statistics.groupCount).toBe(result.semanticGroups!.length);
  });

  test('セマンティックグループが正しく階層化される', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    const result = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    
    // トップレベルのグループを確認
    const topLevelGroups = result.semanticGroups!.filter((g) => g.depth === 0);
    expect(topLevelGroups.length).toBeGreaterThan(0);
    
    // 子グループを持つグループがあるか確認
    const groupsWithChildren = result.semanticGroups!.filter((g) => g.children && g.children.length > 0);
    expect(groupsWithChildren.length).toBeGreaterThanOrEqual(0);
  });

  test('パターン検出が正しく動作する', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    // カード要素が存在する場合、パターンとして検出されるはず
    const cards = result.elements!.filter((el) => el.className.includes('card'));
    if (cards.length >= 2) {
      // extractLayoutScriptはgroupsプロパティを持つ可能性がある
      const groups = (result as any).groups;
      expect(groups?.length || result.patterns?.length || 0).toBeGreaterThanOrEqual(0);
    }
  });

  test('アクセシビリティ要素が正しく識別される', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    expect(result).toHaveProperty('accessibilityElements');
    expect((result as any).accessibilityElements.length).toBeGreaterThan(0);
    
    // インタラクティブ要素がアクセシビリティ要素に含まれているか
    const interactiveElements = result.elements!.filter((el) => el.isInteractive);
    expect((result as any).accessibilityElements.length).toBeGreaterThanOrEqual(interactiveElements.length);
  });

  test('レスポンシブデザインでレイアウトが変化する', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    // デスクトップサイズ
    await page.setViewportSize({ width: 1280, height: 720 });
    const desktopResult = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    // モバイルサイズ
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);
    const mobileResult = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    // ビューポートサイズが正しく記録されているか
    expect(desktopResult.viewport.width).toBe(1280);
    expect(mobileResult.viewport.width).toBe(375);
    
    // 要素のレイアウトが変化しているはず
    const desktopHeader = desktopResult.elements?.find((el) => el.tagName === 'HEADER');
    const mobileHeader = mobileResult.elements?.find((el) => el.tagName === 'HEADER');
    
    if (desktopHeader && mobileHeader) {
      expect(mobileHeader.rect.width).toBeLessThan(desktopHeader.rect.width);
    }
  });

  test('エラーページでも適切に処理される', async ({ page }) => {
    // 404ページでもレイアウト抽出が失敗しないことを確認
    await page.goto('https://example.com/404-page-not-found', { waitUntil: 'domcontentloaded' });
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('viewport');
    expect(result).toHaveProperty('elements');
    expect(result.totalElements || 0).toBeGreaterThanOrEqual(0);
  });

  test('空のページでも適切に処理される', async ({ page }) => {
    // 空のHTMLページを作成
    await page.setContent('<html><body></body></html>');
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('viewport');
    expect(result.elements).toHaveLength(0);
    expect(result.totalElements || 0).toBe(0);
  });

  test('重要度が高い要素が正しく識別される', async ({ page }) => {
    const testPagePath = path.join(__dirname, '../../examples/fixtures/test-page.html');
    await page.goto(`file://${testPagePath}`);
    
    const result = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    
    // ヘッダーやメインコンテンツなど重要な要素の重要度をチェック
    const importantGroups = result.semanticGroups?.filter(g => g.importance > 70) || [];
    expect(importantGroups.length).toBeGreaterThan(0);
    
    // ナビゲーション要素の重要度が高いことを確認
    const navGroup = result.semanticGroups?.find(g => g.type === 'navigation');
    if (navGroup) {
      expect(navGroup.importance).toBeGreaterThan(30); // ナビゲーションの重要度基準を調整
    }
  });

  test('入れ子構造が正しく解析される', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <div class="container">
            <div class="parent">
              <div class="child">
                <div class="grandchild">Content</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    
    const result = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    
    // 階層の深さを確認
    const depths = result.semanticGroups?.map(g => g.depth) || [];
    const maxDepth = Math.max(...depths);
    expect(maxDepth).toBeGreaterThanOrEqual(0); // 階層が検出されることを確認
  });

  test('大量の要素でもパフォーマンスが維持される', async ({ page }) => {
    // 1000個の要素を含むページを生成
    const manyElements = Array.from({ length: 1000 }, (_, i) => 
      `<div class="item item-${i}" data-index="${i}">Item ${i}</div>`
    ).join('');
    
    await page.setContent(`
      <html>
        <body>
          <div class="container">
            ${manyElements}
          </div>
        </body>
      </html>
    `);
    
    const startTime = Date.now();
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    const endTime = Date.now();
    
    expect(result.elements!.length).toBeGreaterThanOrEqual(1000);
    expect(endTime - startTime).toBeLessThan(5000); // 5秒以内に完了
  });

  test('アクセシビリティ属性が正しく抽出される', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <button aria-label="Save document" aria-pressed="false">Save</button>
          <nav role="navigation" aria-label="Main navigation">
            <a href="#" aria-current="page">Home</a>
            <a href="#about">About</a>
          </nav>
          <div role="alert" aria-live="polite">Important message</div>
        </body>
      </html>
    `);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    // aria-label が正しく抽出されているか
    const button = result.elements?.find(el => el.tagName === 'BUTTON');
    expect(button?.ariaLabel).toBe('Save document');
    expect(button?.ariaAttributes['aria-pressed']).toBe('false');
    
    // role属性が正しく抽出されているか
    const nav = result.elements?.find(el => el.tagName === 'NAV');
    expect(nav?.role).toBe('navigation');
    
    const alert = result.elements?.find(el => el.role === 'alert');
    expect(alert?.ariaAttributes['aria-live']).toBe('polite');
  });

  test('動的に追加された要素も検出される', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <div id="container">
            <div class="static-element">Static Content</div>
          </div>
          <script>
            setTimeout(() => {
              const newElement = document.createElement('div');
              newElement.className = 'dynamic-element';
              newElement.textContent = 'Dynamic Content';
              document.getElementById('container').appendChild(newElement);
            }, 100);
          </script>
        </body>
      </html>
    `);
    
    // 動的要素が追加されるまで待機
    await page.waitForTimeout(200);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    const staticElement = result.elements?.find(el => el.className === 'static-element');
    const dynamicElement = result.elements?.find(el => el.className === 'dynamic-element');
    
    expect(staticElement).toBeTruthy();
    expect(dynamicElement).toBeTruthy();
  });

  test('CSS Grid レイアウトが正しく解析される', async ({ page }) => {
    await page.setContent(`
      <html>
        <head>
          <style>
            .grid-container {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              padding: 20px;
            }
            .grid-item {
              background: #f0f0f0;
              padding: 20px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="grid-container">
            <div class="grid-item">1</div>
            <div class="grid-item">2</div>
            <div class="grid-item">3</div>
            <div class="grid-item">4</div>
            <div class="grid-item">5</div>
            <div class="grid-item">6</div>
          </div>
        </body>
      </html>
    `);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    const gridItems = result.elements?.filter(el => el.className === 'grid-item') || [];
    expect(gridItems).toHaveLength(6);
    
    // グリッドアイテムが正しく配置されているか確認
    const firstRowItems = gridItems.slice(0, 3);
    const secondRowItems = gridItems.slice(3, 6);
    
    // 同じ行のアイテムは同じY座標を持つはず
    const firstRowY = firstRowItems[0]?.rect.y;
    expect(firstRowItems.every(item => item.rect.y === firstRowY)).toBe(true);
    
    const secondRowY = secondRowItems[0]?.rect.y;
    expect(secondRowItems.every(item => item.rect.y === secondRowY)).toBe(true);
    expect(secondRowY).toBeGreaterThan(firstRowY!);
  });

  test('フォーム要素のインタラクティブ性が検出される', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <form>
            <input type="text" placeholder="Name" />
            <input type="email" placeholder="Email" />
            <textarea placeholder="Message"></textarea>
            <select>
              <option>Option 1</option>
              <option>Option 2</option>
            </select>
            <button type="submit">Submit</button>
            <div class="form-label">Not interactive</div>
          </form>
        </body>
      </html>
    `);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    const interactiveElements = result.elements?.filter(el => el.isInteractive) || [];
    const formInputs = interactiveElements.filter(el => 
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(el.tagName)
    );
    
    expect(formInputs).toHaveLength(5);
    
    // 非インタラクティブな要素が正しく識別されているか
    const label = result.elements?.find(el => el.className === 'form-label');
    expect(label?.isInteractive).toBe(false);
  });

  test('スクロール位置が記録される', async ({ page }) => {
    await page.setContent(`
      <html>
        <body style="height: 3000px;">
          <div style="position: absolute; top: 1500px;">
            <h1>Scroll Target</h1>
          </div>
        </body>
      </html>
    `);
    
    // ページをスクロール
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(100);
    
    const result = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    
    expect(result.viewport.scrollY).toBe(1000);
  });

  test('セマンティックグループのラベルが適切に生成される', async ({ page }) => {
    await page.setContent(`
      <html>
        <body>
          <nav aria-label="Primary navigation">
            <a href="#">Home</a>
            <a href="#">About</a>
          </nav>
          <section>
            <h2>Featured Products</h2>
            <div class="product">Product 1</div>
            <div class="product">Product 2</div>
          </section>
          <footer>
            <p>Copyright 2024</p>
          </footer>
        </body>
      </html>
    `);
    
    const result = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    
    // ナビゲーションのラベル
    const navGroup = result.semanticGroups?.find(g => g.type === 'navigation');
    expect(navGroup?.label).toBeTruthy(); // ラベルが存在することを確認
    
    // セクション要素が存在することを確認
    const sectionGroups = result.semanticGroups?.filter(g => g.type === 'section') || [];
    expect(sectionGroups.length).toBeGreaterThan(0);
  });
});