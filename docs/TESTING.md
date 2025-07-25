# レイアウト抽出のテスト

visual-checkerのレイアウト抽出機能をテストするための包括的なテストスイートを提供しています。

## テストの種類

### 1. ユニットテスト（Vitest）

セマンティック抽出器の個別機能をテストします。

```bash
# すべてのユニットテストを実行
npm run test:unit

# 特定のテストファイルのみ実行
npm run test:unit tests/layout/semantic-extractor.test.ts

# ウォッチモードで実行
npm run test:unit -- --watch
```

テスト内容：
- セマンティックタイプの判定（navigation, section, interactive, container, group）
- 重要度計算アルゴリズム
- 階層構造の構築
- パターン検出
- レイアウト変更の検出

### 2. 統合テスト（Playwright）

実際のブラウザ環境でレイアウト抽出機能をテストします。

```bash
# すべての統合テストを実行
npm run test:layout

# UIモードで実行（インタラクティブ）
npm run test:layout:ui

# 特定のテストのみ実行
npx playwright test tests/layout/layout-integration.test.ts
```

テスト内容：
- 実際のHTMLページでのセマンティックグループ検出
- カードレイアウトのパターン検出
- レスポンシブデザインでのレイアウト変更
- アクセシビリティ要素の識別
- 動的コンテンツの追加検出
- 視覚的階層の解析

### 3. E2Eテスト（Playwright）

エンドツーエンドのシナリオをテストします。

```bash
# E2Eテストを実行
npx playwright test tests/layout/layout-e2e.test.ts
```

## テストの書き方

### ユニットテストの例

```typescript
import { describe, test, expect } from 'vitest';
import { SemanticLayoutExtractor } from '../../src/layout/semantic-extractor';

describe('セマンティックタイプ検出', () => {
  test('ナビゲーション要素を正しく識別する', () => {
    const analyzer = new SemanticLayoutExtractor();
    const navElement = createMockElement('nav');
    expect(analyzer.getSemanticType(navElement)).toBe('navigation');
  });
});
```

### 統合テストの例

```typescript
import { test, expect } from '@playwright/test';

test('レイアウトを抽出して検証する', async ({ page }) => {
  await page.goto('file:///path/to/test-page.html');
  
  const layoutData = await page.evaluate(() => {
    // ブラウザ内でレイアウト抽出を実行
    return extractLayout();
  });
  
  expect(layoutData.groups.length).toBeGreaterThan(0);
});
```

## モックとヘルパー

### DOM要素のモック

```typescript
function createMockElement(tag: string, attrs: Record<string, any> = {}): any {
  return {
    tagName: tag.toUpperCase(),
    className: attrs.className || '',
    id: attrs.id || '',
    children: attrs.children || [],
    textContent: attrs.textContent || '',
    getAttribute: (name: string) => attrs[name] || null,
    getBoundingClientRect: () => attrs.rect || { 
      x: 0, y: 0, width: 100, height: 50, 
      top: 0, left: 0, right: 100, bottom: 50 
    },
    style: attrs.style || {},
    parentElement: attrs.parentElement || null
  };
}
```

## テストデータ

`examples/test-page.html`を使用して、実際のウェブページ構造でテストを行います。このページには以下の要素が含まれています：

- ヘッダーセクション
- ナビゲーション
- カードレイアウト（グリッド）
- フォーム要素
- アクセシビリティ属性を持つ要素

## CI/CD統合

GitHub Actionsでテストを自動実行するには：

```yaml
- name: Install dependencies
  run: npm ci

- name: Build
  run: npm run build

- name: Run unit tests
  run: npm run test:unit

- name: Install Playwright browsers
  run: npx playwright install

- name: Run integration tests
  run: npm run test:layout
```

## デバッグ

### Playwrightのデバッグ

```bash
# ヘッドレスモードを無効にしてデバッグ
PWDEBUG=1 npx playwright test

# コンソールログを表示
npx playwright test --debug

# トレースを有効化
npx playwright test --trace on
```

### Vitestのデバッグ

```bash
# デバッグ情報を表示
npm run test:unit -- --reporter=verbose

# 特定のテストのみ実行
npm run test:unit -- -t "セマンティックタイプ"
```

## カバレッジ

```bash
# カバレッジレポートを生成
npm run test:unit -- --coverage
```

## トラブルシューティング

### テストが失敗する場合

1. **依存関係の確認**
   ```bash
   npm install
   npm run build
   ```

2. **Playwrightブラウザのインストール**
   ```bash
   npx playwright install
   ```

3. **テストページの存在確認**
   - `examples/test-page.html`が存在することを確認

4. **タイムアウトの調整**
   - 必要に応じてテストのタイムアウト値を増やす

## ベストプラクティス

1. **独立性**: 各テストは他のテストに依存しない
2. **明確性**: テスト名は何をテストしているか明確に示す
3. **再現性**: テストは常に同じ結果を返す
4. **速度**: ユニットテストは高速に実行される
5. **カバレッジ**: 重要なロジックはすべてテストでカバーする