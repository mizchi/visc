#!/usr/bin/env node
import { test } from "node:test";
import {
  checkAdaptiveStability,
  createPuppeteerDriver,
  // } from "../dist/index.js";
} from "../src/index";

import puppeteer, { Browser } from "puppeteer";
import path from "path";

async function main() {
  // コマンドライン引数からURLを取得
  const url =
    process.argv[2] || `file://${path.join(process.cwd(), "test.html")}`;
  const outputDir =
    process.argv[3] || path.join(process.cwd(), "output", "adaptive-stability");

  console.log("🚀 適応的安定性チェックツール");
  console.log("=============================");
  console.log(`URL: ${url}`);
  console.log(`出力ディレクトリ: ${outputDir}`);
  console.log("");

  // ブラウザインスタンスを事前に作成
  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({ headless: true });

    const result = await checkAdaptiveStability(
      async () => {
        if (!browser) {
          throw new Error("Browser instance is not initialized.");
        }
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        return createPuppeteerDriver({
          page,
          browser: undefined, // pageのみをクローズするようにundefinedを渡す
          viewport: { width: 1280, height: 720 },
        });
      },
      {
        url,
        minIterations: 3,
        maxIterations: 10,
        viewport: { width: 1280, height: 720 },
        outputDir,
        delay: 2000,
        targetStability: 95,
        earlyStopThreshold: 98,
      }
    );

    console.log("\n📊 最終結果サマリー");
    console.log("==================");
    console.log(
      `最終安定性スコア: ${(
        result.analysis.overallStabilityScore * 100
      ).toFixed(1)}%`
    );
    console.log(`総反復数: ${result.analysis.iterations}`);
    console.log(
      `安定ノード数: ${result.analysis.stableNodes}/${result.analysis.totalNodes}`
    );
    console.log(`不安定ノード数: ${result.analysis.unstableNodes.length}`);

    if (result.analysis.recommendations.ignoreSelectors.length > 0) {
      console.log("\n推奨される無視セレクター:");
      result.analysis.recommendations.ignoreSelectors.forEach((selector) => {
        console.log(`  - ${selector}`);
      });
    }

    console.log("\n✅ 適応的安定性チェック完了！");
    console.log(`詳細な結果は ${outputDir} に保存されました。`);

    // プロセスを正常終了
    process.exit(0);
  } catch (error) {
    console.error("❌ エラーが発生しました:", error);
  } finally {
    await browser?.close();
    process.exit(1);
  }
}

// テストモードでない場合は main を実行
if (!process.env.NODE_TEST_CONTEXT) {
  main();
}

// テスト用エクスポート
test("adaptive stability check example", async () => {
  console.log("This is an example file");
});
