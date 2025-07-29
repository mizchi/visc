#!/usr/bin/env node

/**
 * レイアウト類似性の比較例
 * 
 * 使用方法:
 * npx tsx examples/layout-similarity.ts https://example.com https://example.org
 */

import { chromium } from 'playwright';
import { getExtractSemanticLayoutScript } from '../src/layout/semantic-analyzer.js';
import { 
  calculateLayoutSimilarity, 
  generateLayoutFingerprint,
  isSameLayoutStructure 
} from '../src/layout/rect-distance.js';
import type { LayoutAnalysisResult } from '../src/layout/extractor.js';

async function compareLayouts(url1: string, url2: string) {
  const browser = await chromium.launch({ headless: true });
  
  try {
    // 両方のURLからレイアウトを抽出
    console.log(`\n📊 レイアウト比較を開始します...`);
    console.log(`URL1: ${url1}`);
    console.log(`URL2: ${url2}\n`);

    const layout1 = await extractLayout(browser, url1);
    const layout2 = await extractLayout(browser, url2);

    if (!layout1.semanticGroups || !layout2.semanticGroups) {
      console.error('❌ レイアウト情報の抽出に失敗しました');
      return;
    }

    // レイアウトの統計情報を表示
    console.log('📈 レイアウト統計:');
    console.log(`URL1: ${layout1.semanticGroups.length} グループ, ${layout1.totalElements} 要素`);
    console.log(`URL2: ${layout2.semanticGroups.length} グループ, ${layout2.totalElements} 要素`);

    // フィンガープリントを生成
    const fingerprint1 = generateLayoutFingerprint(layout1.semanticGroups);
    const fingerprint2 = generateLayoutFingerprint(layout2.semanticGroups);
    
    console.log('\n🔍 レイアウトフィンガープリント:');
    console.log(`URL1: ${fingerprint1.substring(0, 50)}...`);
    console.log(`URL2: ${fingerprint2.substring(0, 50)}...`);
    console.log(`完全一致: ${fingerprint1 === fingerprint2 ? '✅ Yes' : '❌ No'}`);

    // 類似性を計算
    const similarity = calculateLayoutSimilarity(
      layout1.semanticGroups, 
      layout2.semanticGroups,
      { viewport: layout1.viewport }
    );

    console.log('\n📊 類似性分析:');
    console.log(`全体的な類似度: ${(similarity.similarity * 100).toFixed(1)}%`);
    console.log(`マッチしたグループ: ${similarity.matchedGroups.length} / ${Math.max(layout1.semanticGroups.length, layout2.semanticGroups.length)}`);

    // 詳細メトリクス
    console.log('\n📏 詳細メトリクス:');
    console.log(`位置の距離: ${similarity.metrics.positionDistance.toFixed(3)}`);
    console.log(`サイズの距離: ${similarity.metrics.sizeDistance.toFixed(3)}`);
    console.log(`アスペクト比の距離: ${similarity.metrics.aspectRatioDistance.toFixed(3)}`);
    console.log(`ユークリッド距離: ${similarity.metrics.euclideanDistance.toFixed(3)}`);

    // マッチしたグループの詳細
    if (similarity.matchedGroups.length > 0) {
      console.log('\n🔗 マッチしたグループ:');
      similarity.matchedGroups.forEach((match, index) => {
        console.log(`  ${index + 1}. ${match.group1.type} "${match.group1.label}" ↔ "${match.group2.label}" (${(match.similarity * 100).toFixed(1)}%)`);
      });
    }

    // 構造の判定
    const isSameStructure = isSameLayoutStructure(layout1.semanticGroups, layout2.semanticGroups);
    console.log(`\n🏗️ 構造判定: ${isSameStructure ? '✅ 同じ構造' : '❌ 異なる構造'}`);

    // グループタイプ別の比較
    console.log('\n📋 グループタイプ別の分布:');
    const types1 = countGroupTypes(layout1.semanticGroups);
    const types2 = countGroupTypes(layout2.semanticGroups);
    const allTypes = new Set([...Object.keys(types1), ...Object.keys(types2)]);
    
    allTypes.forEach(type => {
      const count1 = types1[type] || 0;
      const count2 = types2[type] || 0;
      const diff = count1 - count2;
      const diffStr = diff === 0 ? '✅' : (diff > 0 ? `+${diff}` : `${diff}`);
      console.log(`  ${type}: URL1=${count1}, URL2=${count2} (${diffStr})`);
    });

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await browser.close();
  }
}

async function extractLayout(browser: any, url: string): Promise<LayoutAnalysisResult> {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  
  // 少し待機してレンダリングを完了させる
  await page.waitForTimeout(1000);
  
  const layoutData = await page.evaluate(getExtractSemanticLayoutScript());
  await page.close();
  
  return layoutData;
}

function countGroupTypes(groups: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  groups.forEach(group => {
    counts[group.type] = (counts[group.type] || 0) + 1;
  });
  return counts;
}

// メイン実行
const [url1, url2] = process.argv.slice(2);

if (!url1 || !url2) {
  console.log('使用方法: npx tsx examples/layout-similarity.ts <URL1> <URL2>');
  console.log('例: npx tsx examples/layout-similarity.ts https://example.com https://example.org');
  process.exit(1);
}

compareLayouts(url1, url2).catch(console.error);