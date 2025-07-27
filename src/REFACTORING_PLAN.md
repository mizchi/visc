# Visual Checker API階層構造リファクタリング計画

## 現状の課題
- フラットな構造で機能の関係性が分かりにくい
- 初心者が基本的な使い方から段階的に学ぶのが困難
- 実験的機能と安定機能が混在

## 新しい階層構造

```
src/
├── core/                    # 1. コアAPI（最も基本的な機能）
│   ├── screenshot.ts        # スクリーンショット撮影
│   ├── compare.ts          # 画像比較
│   └── types.ts            # 基本型定義
│
├── basic/                   # 2. 基本機能（一般的な使用）
│   ├── browser/            # ブラウザ制御
│   │   ├── controller.ts
│   │   └── types.ts
│   ├── snapshot/           # スナップショット管理
│   │   ├── manager.ts
│   │   └── comparator.ts
│   └── config/             # 設定管理
│       ├── loader.ts
│       └── validator.ts
│
├── advanced/               # 3. 高度な機能（特殊な要件）
│   ├── layout/            # レイアウト分析
│   │   ├── extractor.ts
│   │   ├── comparator.ts
│   │   └── semantic-analyzer.ts
│   ├── responsive/        # レスポンシブテスト
│   │   ├── matrix-tester.ts
│   │   └── report-generator.ts
│   ├── content/           # コンテンツ分析
│   │   ├── excluder.ts
│   │   └── content-aware-comparator.ts
│   └── proxy/             # プロキシ機能
│       ├── client.ts
│       └── override-handler.ts
│
├── expert/                # 4. エキスパート向け（カスタマイズ）
│   ├── workflow/          # ワークフロー制御
│   │   ├── engine.ts
│   │   └── error-analyzer.ts
│   ├── validation/        # バリデーションチェーン
│   │   ├── chain.ts
│   │   └── factory.ts
│   └── ai/               # AI統合
│       ├── provider-factory.ts
│       └── analyzer.ts
│
├── experimental/          # 5. 実験的機能（将来の機能）
│   ├── flakiness-detector.ts
│   ├── multi-crawl-manager.ts
│   └── rect-distance/
│
├── cli/                   # CLI関連（エンドユーザー向け）
│   └── index.ts
│
└── index.ts              # パブリックAPIのエクスポート
```

## 段階的なAPI設計

### Level 1: Core API（最も簡単）
```typescript
// 単一のスクリーンショット
import { captureScreenshot } from 'visual-checker/core';
const screenshot = await captureScreenshot('https://example.com');

// 2つの画像を比較
import { compareImages } from 'visual-checker/core';
const result = await compareImages('before.png', 'after.png');
```

### Level 2: Basic API（一般的な使用）
```typescript
// ブラウザ制御付きスクリーンショット
import { BrowserController } from 'visual-checker/basic';
const browser = new BrowserController({ headless: true });
await browser.launch();
const screenshot = await browser.captureScreenshot({ 
  url: 'https://example.com',
  waitFor: { selector: '.loaded' }
});

// スナップショット管理
import { SnapshotManager } from 'visual-checker/basic';
const manager = new SnapshotManager('./snapshots');
await manager.update('home', screenshot);
const hasChanged = await manager.compare('home', newScreenshot);
```

### Level 3: Advanced API（高度な機能）
```typescript
// レイアウト分析
import { LayoutAnalyzer } from 'visual-checker/advanced';
const analyzer = new LayoutAnalyzer();
const layout = await analyzer.extract(page);
const comparison = await analyzer.compare(layout1, layout2);

// レスポンシブマトリクステスト
import { ResponsiveMatrixTester } from 'visual-checker/advanced';
const tester = new ResponsiveMatrixTester(config);
const results = await tester.testAllViewports(url);

// コンテンツ除外
import { ContentExcluder } from 'visual-checker/advanced';
const excluder = new ContentExcluder();
const layoutWithoutContent = await excluder.excludeMainContent(page);
```

### Level 4: Expert API（カスタマイズ）
```typescript
// ワークフローエンジン
import { WorkflowEngine, AIProvider } from 'visual-checker/expert';
const engine = new WorkflowEngine(config);
engine.addStep('analyze', new AIProvider());
const result = await engine.execute();

// バリデーションチェーン
import { ValidationChain } from 'visual-checker/expert';
const chain = new ValidationChain()
  .add(new PixelMatchValidator())
  .add(new LayoutValidator())
  .add(new AIValidator());
const isValid = await chain.validate(comparison);
```

## エクスポート戦略

### src/index.ts
```typescript
// Core - 最も基本的な機能
export * from './core';

// Basic - よく使う機能
export * from './basic';

// Advanced - 特定用途向け（名前空間付き）
export * as layout from './advanced/layout';
export * as responsive from './advanced/responsive';
export * as content from './advanced/content';
export * as proxy from './advanced/proxy';

// Expert - 上級者向け（明示的インポート推奨）
// export * as workflow from './expert/workflow';
// export * as validation from './expert/validation';
// export * as ai from './expert/ai';
```

### パッケージ.json exports
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./core": "./dist/core/index.js",
    "./basic": "./dist/basic/index.js",
    "./advanced": "./dist/advanced/index.js",
    "./expert": "./dist/expert/index.js",
    "./experimental": "./dist/experimental/index.js"
  }
}
```

## 移行計画

### Phase 1: 新構造の作成
1. 新しいディレクトリ構造を作成
2. 既存コードを適切な階層に移動
3. 相互依存関係の整理

### Phase 2: APIの整理
1. 各レベルのパブリックAPIを定義
2. 内部実装の隠蔽
3. ドキュメント生成

### Phase 3: 後方互換性
1. 既存のimportパスをサポート
2. 非推奨警告の追加
3. 移行ガイドの作成

## 利点
- **段階的学習**: 初心者から上級者まで段階的に学べる
- **明確な依存関係**: 下位レベルは上位レベルに依存しない
- **安定性の明確化**: experimental配下は不安定であることが明確
- **モジュール性**: 必要な機能だけをインポート可能