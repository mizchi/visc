# レイアウト分析機能

visual-checkerのレイアウト分析機能は、ウェブページのDOM構造を意味的に解析し、視覚的なグループとパターンを検出します。

## 概要

レイアウト分析機能は以下を提供します：

- **セマンティックタイプの識別**: navigation, section, container, group, interactive, content
- **重要度の計算**: サイズ、位置、タグ、視覚的特徴に基づく
- **パターン検出**: 繰り返される類似要素の識別
- **階層構造の解析**: DOM要素の意味的な階層を構築

## 使用方法

### 基本的な使用

```typescript
import { extractLayoutScript } from 'visual-checker';
import { chromium } from '@playwright/test';

async function analyzeLayout(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto(url);
  const layoutData = await page.evaluate(extractLayoutScript);
  
  console.log(`Total elements: ${layoutData.totalElements}`);
  console.log(`Interactive elements: ${layoutData.statistics.interactiveElements}`);
  console.log(`Groups found: ${layoutData.statistics.groupCount}`);
  
  await browser.close();
  return layoutData;
}
```

### セマンティック分析

```typescript
import { extractSemanticLayoutScript } from 'visual-checker';

async function analyzeSemanticLayout(url: string) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto(url);
  const layoutData = await page.evaluate(extractSemanticLayoutScript);
  
  // セマンティックグループを取得
  layoutData.semanticGroups.forEach(group => {
    console.log(`${group.type}: ${group.label} [${group.importance}%]`);
  });
  
  await browser.close();
  return layoutData;
}
```

### CLI使用

```bash
# シンプルなレイアウト抽出
npm run extract simple https://example.com

# セマンティックレイアウト抽出
npm run extract semantic https://example.com

# 可視化
npm run extract visualize https://example.com output.png
```

## API リファレンス

### 関数

#### `getSemanticType(element: HTMLElement): string`

要素のセマンティックタイプを判定します。

戻り値:
- `'navigation'`: ナビゲーション要素
- `'section'`: セクション要素（main, article, header, footer）
- `'interactive'`: インタラクティブ要素（button, a, input）
- `'container'`: 3つ以上の子要素を持つコンテナ
- `'group'`: 同じタイプの子要素を持つグループ
- `'content'`: その他のコンテンツ要素

#### `calculateImportance(element: HTMLElement, rect: DOMRect): number`

要素の重要度を0-100のスコアで計算します。

考慮される要素:
- サイズ（ビューポートに対する割合）
- 位置（上部ほど重要）
- タグの種類（h1, main, nav等は重要）
- 視覚的特徴（背景色、ボーダー）

#### `detectPatterns(elements: any[]): LayoutPattern[]`

類似要素のパターンを検出します。

#### `detectSemanticGroups(elements: HTMLElement[]): SemanticGroup[]`

意味的なグループを階層的に検出します。

### 型定義

```typescript
interface LayoutElement {
  tagName: string;
  className: string;
  id: string;
  rect: LayoutRect;
  text?: string;
  role: string | null;
  ariaLabel: string | null;
  ariaAttributes: Record<string, string>;
  isInteractive: boolean;
  hasParentWithSameSize: boolean;
  computedStyle: {
    display: string;
    position: string;
    zIndex: string;
    backgroundColor: string;
    color: string;
    fontSize: string;
    fontWeight: string;
  };
}

interface SemanticGroup {
  id: string;
  type: 'section' | 'navigation' | 'container' | 'group' | 'interactive' | 'content';
  bounds: { x: number; y: number; width: number; height: number };
  elements: any[];
  children: SemanticGroup[];
  depth: number;
  label: string;
  importance: number;
}

interface LayoutAnalysisResult {
  url: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
  elements?: LayoutElement[];
  semanticGroups?: SemanticGroup[];
  patterns?: LayoutPattern[];
  totalElements: number;
  statistics: {
    totalElements?: number;
    interactiveElements?: number;
    groupCount?: number;
    patternCount?: number;
    topLevelGroups?: number;
    accessibilityCount?: number;
  };
}
```

## 可視化

レイアウト分析結果を視覚的に表示するには：

1. **色分け**: セマンティックタイプごとに異なる色で表示
   - Section: 青
   - Navigation: 赤
   - Container: 緑
   - Group: オレンジ
   - Interactive: 紫
   - Content: グレー

2. **境界線**: 重要度に応じて太さが変化
   - 重要度 > 70%: 太い境界線とシャドウ
   - 重要度 > 50%: 中程度の境界線
   - その他: 通常の境界線

3. **ラベル**: 各グループにタイプとラベル、重要度を表示

## テスト

```bash
# ユニットテストの実行
npm run test:unit

# 統合テストの実行
npm run test:layout

# すべてのテストを実行
npm run test:all
```

## 活用例

### 1. アクセシビリティ監査

```typescript
const layout = await analyzeLayout(url);
const accessibilityIssues = layout.accessibilityElements.filter(el => 
  !el.ariaLabel && el.isInteractive
);
```

### 2. レイアウトの一貫性チェック

```typescript
const patterns = layout.patterns;
patterns.forEach(pattern => {
  if (pattern.elements.length > 1) {
    // 類似要素のスタイルが一貫しているか確認
  }
});
```

### 3. レスポンシブデザインの検証

```typescript
const desktopLayout = await analyzeWithViewport(url, { width: 1280, height: 720 });
const mobileLayout = await analyzeWithViewport(url, { width: 375, height: 667 });

// レイアウトの変化を比較
```

## ベストプラクティス

1. **ページの読み込み完了を待つ**: `waitUntil: 'networkidle'` または適切な待機
2. **動的コンテンツの考慮**: 必要に応じて追加の待機時間を設定
3. **ビューポートサイズの指定**: テストの再現性のため
4. **不要な要素の除外**: SCRIPT, STYLE, META タグは自動的に除外される