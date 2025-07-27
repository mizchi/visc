/**
 * Core image comparison functionality
 * 最も基本的な画像比較機能
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';
import type { CompareOptions, CompareResult } from './types.js';

/**
 * 2つの画像を比較
 * 
 * @example
 * ```typescript
 * // 最も簡単な使い方
 * const result = await compareImages('before.png', 'after.png');
 * console.log(`Match: ${result.match}, Difference: ${result.difference}%`);
 * 
 * // 差分画像を生成
 * const result = await compareImages('before.png', 'after.png', {
 *   generateDiff: true,
 *   diffPath: './diff.png',
 *   threshold: 0.1
 * });
 * ```
 */
export async function compareImages(
  imagePath1: string,
  imagePath2: string,
  options: CompareOptions = {}
): Promise<CompareResult> {
  const {
    threshold = 0.1,
    generateDiff = false,
    diffPath = path.join(path.dirname(imagePath1), 'diff.png')
  } = options;
  
  // 画像の読み込み
  const img1 = await loadImage(imagePath1);
  const img2 = await loadImage(imagePath2);
  
  // サイズチェック
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `Image dimensions do not match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`
    );
  }
  
  // 差分画像用のバッファ
  const diff = generateDiff ? new PNG({ width: img1.width, height: img1.height }) : null;
  
  // ピクセル比較
  const diffPixels = pixelmatch(
    img1.data,
    img2.data,
    diff?.data || null,
    img1.width,
    img1.height,
    { threshold }
  );
  
  // 差分の割合を計算
  const totalPixels = img1.width * img1.height;
  const difference = diffPixels / totalPixels;
  
  // 差分画像の保存
  let savedDiffPath: string | undefined;
  if (generateDiff && diff && diffPixels > 0) {
    await saveImage(diff, diffPath);
    savedDiffPath = diffPath;
  }
  
  return {
    match: diffPixels === 0,
    difference,
    diffPixels,
    diffPath: savedDiffPath
  };
}

/**
 * 画像を読み込む
 */
async function loadImage(imagePath: string): Promise<PNG> {
  return new Promise((resolve, reject) => {
    fs.createReadStream(imagePath)
      .pipe(new PNG())
      .on('parsed', function() {
        resolve(this);
      })
      .on('error', reject);
  });
}

/**
 * 画像を保存
 */
async function saveImage(image: PNG, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // ディレクトリの作成
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    
    image.pack()
      .pipe(fs.createWriteStream(outputPath))
      .on('finish', resolve)
      .on('error', reject);
  });
}

/**
 * 複数の画像ペアを比較
 * 
 * @example
 * ```typescript
 * const results = await compareMultipleImages([
 *   { before: 'v1/home.png', after: 'v2/home.png' },
 *   { before: 'v1/about.png', after: 'v2/about.png' }
 * ], { threshold: 0.1 });
 * ```
 */
export async function compareMultipleImages(
  pairs: Array<{ before: string; after: string }>,
  options: CompareOptions = {}
): Promise<Array<{ pair: { before: string; after: string }; result: CompareResult }>> {
  return Promise.all(
    pairs.map(async (pair) => ({
      pair,
      result: await compareImages(pair.before, pair.after, options)
    }))
  );
}