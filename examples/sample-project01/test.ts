import { test } from "node:test";
import {
  createVisualAssert,
  assertVisualMatch,
} from "../../dist/assertion/index.js";

// CLI引数を解析
const args = process.argv.slice(2);
const outDirIndex = args.indexOf("--outdir");
const OUTPUT_DIR =
  outDirIndex !== -1 && args[outDirIndex + 1]
    ? args[outDirIndex + 1]
    : "./output";

console.log(`📁 Output directory: ${OUTPUT_DIR}`);

// テスト
test("CSS視覚的回帰テスト", async (t) => {
  // 視覚的アサーションを作成
  const visual = await createVisualAssert({ outputDir: OUTPUT_DIR });

  try {
    await t.test("main", async () => {
      const result = await visual.compareSemanticLayout("main");
      await assertVisualMatch(result, `差分: ${result.differencePercentage}`);
    });

    await t.test("main (厳密)", async () => {
      const result = await visual.compareSemanticLayout("main", {
        threshold: 0.001,
      });
      await assertVisualMatch(
        result,
        `厳密な閾値での差異: ${result.differencePercentage}`
      );
    });

    await t.test("main (モバイル)", async () => {
      const result = await visual.compareSemanticLayout("main", {
        viewport: { width: 375, height: 667 },
      });
      await assertVisualMatch(
        result,
        `モバイルサイズでの差異: ${result.differencePercentage}`
      );
    });
  } finally {
    // クリーンアップ
    await visual.cleanup();
  }
});

// テスト
test("CSS視覚的回帰テスト with SVG", async (t) => {
  // SVG生成を有効にして視覚的アサーションを作成
  const visual = await createVisualAssert({
    outputDir: "./output",
    generateSVG: true, // SVG生成を有効化
  });

  try {
    await t.test("main with semantic SVG", async () => {
      const result = await visual.compareSemanticLayout("main");
      await assertVisualMatch(result, `差分: ${result.differencePercentage}`);
      console.log("✅ Semantic SVG generated at: ./output/semantic/");
    });
  } finally {
    await visual.cleanup();
  }
});
