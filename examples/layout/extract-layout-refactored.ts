import { chromium } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';
import { extractLayoutScript } from '../../dist/layout/extractor.js';
import { extractSemanticLayoutScript } from '../../dist/layout/semantic-analyzer.js';
import type { LayoutAnalysisResult } from '../../dist/index.js';

/**
 * シンプルなレイアウト抽出
 */
export async function extractSimpleLayout(url: string): Promise<LayoutAnalysisResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    
    const layoutData = await page.evaluate(extractLayoutScript) as LayoutAnalysisResult;
    return layoutData;
  } finally {
    await browser.close();
  }
}

/**
 * セマンティックレイアウト抽出
 */
export async function extractSemanticLayout(url: string): Promise<LayoutAnalysisResult> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    
    const layoutData = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    return layoutData;
  } finally {
    await browser.close();
  }
}

/**
 * レイアウトの可視化
 */
export async function visualizeLayout(url: string, outputPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    
    // レイアウトを抽出
    const layoutData = await page.evaluate(extractSemanticLayoutScript) as LayoutAnalysisResult;
    
    // 可視化オーバーレイを追加
    await page.evaluate((data) => {
      // 既存のオーバーレイを削除
      const existing = document.getElementById('layout-overlay');
      if (existing) existing.remove();
      
      // オーバーレイを作成
      const overlay = document.createElement('div');
      overlay.id = 'layout-overlay';
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10000;';
      document.body.appendChild(overlay);
      
      // グループの色を定義
      const groupColors: Record<string, string> = {
        'section': 'rgba(59, 130, 246, 0.3)',
        'navigation': 'rgba(239, 68, 68, 0.3)',
        'container': 'rgba(34, 197, 94, 0.3)',
        'group': 'rgba(251, 146, 60, 0.3)',
        'interactive': 'rgba(168, 85, 247, 0.3)',
        'content': 'rgba(107, 114, 128, 0.3)'
      };
      
      const borderColors: Record<string, string> = {
        'section': 'rgba(59, 130, 246, 0.8)',
        'navigation': 'rgba(239, 68, 68, 0.8)',
        'container': 'rgba(34, 197, 94, 0.8)',
        'group': 'rgba(251, 146, 60, 0.8)',
        'interactive': 'rgba(168, 85, 247, 0.8)',
        'content': 'rgba(107, 114, 128, 0.8)'
      };
      
      // セマンティックグループを描画
      if (data.semanticGroups) {
        data.semanticGroups.forEach((group: any) => {
          const rect = document.createElement('div');
          rect.style.cssText = `
            position: absolute;
            left: ${group.bounds.x}px;
            top: ${group.bounds.y}px;
            width: ${group.bounds.width}px;
            height: ${group.bounds.height}px;
            background-color: ${groupColors[group.type] || groupColors.content};
            border: 2px solid ${borderColors[group.type] || borderColors.content};
            border-radius: 4px;
            box-sizing: border-box;
          `;
          
          // 重要度に応じて境界線を調整
          if (group.importance > 50) {
            rect.style.borderWidth = '3px';
          }
          if (group.importance > 70) {
            rect.style.borderWidth = '4px';
            rect.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
          }
          
          overlay.appendChild(rect);
          
          // ラベルを追加
          const label = document.createElement('div');
          label.style.cssText = `
            position: absolute;
            left: ${group.bounds.x}px;
            top: ${group.bounds.y - 25}px;
            background-color: ${borderColors[group.type] || borderColors.content};
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            white-space: nowrap;
          `;
          label.textContent = `${group.type.toUpperCase()} - ${group.label} [${Math.round(group.importance)}%]`;
          
          overlay.appendChild(label);
        });
      }
    }, layoutData);
    
    // スクリーンショットを保存
    await page.screenshot({ path: outputPath, fullPage: true });
    
    // 統計情報を表示
    console.log('\n📊 Layout Analysis Results:');
    console.log(`   Total elements: ${layoutData.totalElements}`);
    console.log(`   Semantic groups: ${layoutData.statistics.groupCount || 0}`);
    console.log(`   Patterns: ${layoutData.statistics.patternCount || 0}`);
    
  } finally {
    await browser.close();
  }
}

// CLI実行用
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const command = args[0];
  const url = args[1] || 'file://' + path.join(process.cwd(), 'examples', 'fixtures', 'test-page.html');
  
  (async () => {
    try {
      switch (command) {
        case 'simple': {
          const result = await extractSimpleLayout(url);
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'semantic': {
          const result = await extractSemanticLayout(url);
          console.log(JSON.stringify(result, null, 2));
          break;
        }
        case 'visualize': {
          const outputPath = args[2] || path.join(process.cwd(), 'output', 'layout-visualization.png');
          await visualizeLayout(url, outputPath);
          console.log('\\n✅ Visualization saved to: ' + outputPath);
          break;
        }
        default:
          console.log('Usage: node extract-layout-refactored.js <command> [url] [output]');
          console.log('Commands:');
          console.log('  simple    - Extract simple layout');
          console.log('  semantic  - Extract semantic layout');
          console.log('  visualize - Create visualization');
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
}