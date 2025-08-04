# Visual Checker v2 API設計

## 本質的なAPI一覧

### 1. データ取得層（生データ取得）

#### `fetchRawLayoutData(url: string, options?: BrowserOptions): Promise<RawLayoutData>`
- **目的**: Puppeteerを使用して生の座標情報を取得
- **現状**: `fetchLayoutAnalysis`として実装済み（ただし、既に要約処理も含む）
- **必要な変更**: 生データ取得と要約処理を分離する必要がある

### 2. データ変換層（要約・圧縮）

#### `extractLayoutTree(rawData: RawLayoutData): LayoutTree`
- **目的**: 生の情報を位置情報とアクセシビリティで要約したツリーに圧縮
- **現状**: `getExtractLayoutScript`内で実装されているが、ブラウザ内で実行される
- **必要な変更**: 明示的なAPIとして分離

### 3. 比較・分析層

#### `compareLayoutTrees(tree1: LayoutTree, tree2: LayoutTree): ComparisonResult`
- **目的**: 圧縮されたツリーを比較して、類似度を計算
- **現状**: `compareLayouts`として実装済み

#### `calculateSimilarity(tree1: LayoutTree, tree2: LayoutTree): number`
- **目的**: 2つのツリーの類似度を0-100のスコアで返す
- **現状**: `isLayoutSimilar`として部分的に実装

### 4. ハイレベルAPI（自動調整）

#### `calibrateComparisonSettings(samples: LayoutTree[]): ComparisonSettings`
- **目的**: 同条件で取得した複数のデータを満たす比較設定をadaptiveにキャリブレーション
- **現状**: 未実装（`detectFlakiness`が近い機能を持つが、設定生成はない）

#### `validateWithSettings(tree: LayoutTree, baseline: LayoutTree, settings: ComparisonSettings): ValidationResult`
- **目的**: キャリブレーションされた設定で、新しく取得したデータがその設定に収まるか確認
- **現状**: 未実装

### 5. 描画系

#### `renderLayoutToSvg(tree: LayoutTree): string`
- **目的**: 圧縮されたツリーをSVGに描画
- **現状**: 実装済み

#### `renderComparisonToSvg(comparison: ComparisonResult): string`
- **目的**: 比較されたツリー比較の結果のdiffをSVGに描画
- **現状**: 未実装

## 現在の実装状況

### 実装済み
- ✅ データ取得と要約の統合版（`fetchLayoutAnalysis`）
- ✅ ツリー比較（`compareLayouts`）
- ✅ 類似度判定（`isLayoutSimilar`）
- ✅ ツリーのSVG描画（`renderLayoutToSvg`）
- ✅ Flakiness検出（`detectFlakiness`）

### 未実装
- ❌ 生データ取得の分離
- ❌ 比較設定の自動キャリブレーション
- ❌ キャリブレーション済み設定での検証
- ❌ 比較結果のSVG描画

## 推奨される実装順序

1. **生データ取得とツリー抽出の分離**
   - `fetchRawLayoutData`と`extractLayoutTree`を別々のAPIとして実装
   - 現在の`fetchLayoutAnalysis`は両方を組み合わせた便利関数として残す

2. **比較設定の自動キャリブレーション**
   - `calibrateComparisonSettings`の実装
   - 複数のサンプルから適切な閾値を自動計算

3. **キャリブレーション済み設定での検証**
   - `validateWithSettings`の実装
   - 設定に基づいた合否判定

4. **比較結果のSVG描画**
   - `renderComparisonToSvg`の実装
   - 差分を視覚的に表現

## 型定義の整理

```typescript
// 生データ（ブラウザから取得する生の情報）
interface RawLayoutData {
  elements: RawElement[];
  viewport: ViewportInfo;
  url: string;
  timestamp: string;
}

// 要約されたツリー構造
interface LayoutTree {
  root: SemanticGroup;
  metadata: {
    url: string;
    timestamp: string;
    viewport: ViewportInfo;
  };
}

// 比較設定
interface ComparisonSettings {
  positionTolerance: number;  // 位置の許容誤差（ピクセル）
  sizeTolerance: number;      // サイズの許容誤差（%）
  textSimilarityThreshold: number;  // テキスト類似度の閾値
  ignoreElements?: string[];  // 無視する要素のセレクタ
}

// 検証結果
interface ValidationResult {
  isValid: boolean;
  similarity: number;
  violations: Violation[];
}
```