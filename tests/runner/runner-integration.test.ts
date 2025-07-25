import { describe, test, expect } from 'vitest';
import { defaultRunnerFactory } from '../../src/runner/factory.js';

describe('ランナー統合テスト', () => {
  test('Playwrightランナーでレイアウト抽出', async () => {
    const runner = defaultRunnerFactory.create('playwright');
    const browserContext = await runner.launch({ headless: true });
    const pageContext = await runner.newPage(browserContext);
    
    try {
      await runner.goto(pageContext, 'https://example.com');
      const layout = await runner.extractLayout(pageContext);
      
      expect(layout.url).toBe('https://example.com/');
      expect(layout.timestamp).toBeDefined();
      expect(layout.viewport).toBeDefined();
      expect(layout.totalElements).toBeGreaterThan(0);
      
      // セマンティックグループが存在することを確認
      expect(layout.semanticGroups).toBeDefined();
      expect(layout.semanticGroups!.length).toBeGreaterThan(0);
      
      // 統計情報を確認
      expect(layout.statistics).toBeDefined();
      expect(layout.statistics.groupCount).toBeGreaterThan(0);
    } finally {
      await runner.closePage(pageContext);
      await runner.close(browserContext);
    }
  });

  test('異なるビューポートサイズでの比較', { timeout: 20000 }, async () => {
    const runner = defaultRunnerFactory.create('playwright');
    
    // デスクトップサイズ
    const desktopContext = await runner.launch({ headless: true });
    const desktopPage = await runner.newPage(desktopContext, {
      viewport: { width: 1280, height: 720 }
    });
    
    // モバイルサイズ
    const mobileContext = await runner.launch({ headless: true });
    const mobilePage = await runner.newPage(mobileContext, {
      viewport: { width: 375, height: 667 }
    });
    
    try {
      await runner.goto(desktopPage, 'https://example.com');
      await runner.goto(mobilePage, 'https://example.com');
      
      const desktopLayout = await runner.extractLayout(desktopPage);
      const mobileLayout = await runner.extractLayout(mobilePage);
      
      // ビューポートサイズが正しく記録されていることを確認
      expect(desktopLayout.viewport.width).toBe(1280);
      expect(mobileLayout.viewport.width).toBe(375);
      
      // 要素の配置が異なることを確認（レスポンシブデザイン）
      const desktopGroup = desktopLayout.semanticGroups?.[0];
      const mobileGroup = mobileLayout.semanticGroups?.[0];
      
      if (desktopGroup && mobileGroup) {
        expect(desktopGroup.bounds.width).toBeGreaterThan(mobileGroup.bounds.width);
      }
    } finally {
      await runner.closePage(desktopPage);
      await runner.close(desktopContext);
      await runner.closePage(mobilePage);
      await runner.close(mobileContext);
    }
  });

  test('ファクトリーのクリーンアップ', async () => {
    const runner1 = defaultRunnerFactory.create('playwright');
    const context1 = await runner1.launch({ headless: true });
    
    const runner2 = defaultRunnerFactory.create('playwright');
    const context2 = await runner2.launch({ headless: true });
    
    // 同じランナーインスタンスが返されることを確認
    expect(runner1).toBe(runner2);
    
    // クリーンアップ
    await defaultRunnerFactory.cleanup();
    
    // クリーンアップ後は新しいインスタンスが作成される
    const runner3 = defaultRunnerFactory.create('playwright');
    expect(runner3).not.toBe(runner1);
    
    await runner3.cleanup();
  });
});