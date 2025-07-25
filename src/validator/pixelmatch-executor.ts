/**
 * Pixelmatch実行ユーティリティ
 */

import pixelmatch from 'pixelmatch';
import type * as Pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

/**
 * Pixelmatch実行結果
 */
export interface PixelmatchResult {
  /** 異なるピクセル数 */
  diffPixels: number;
  /** 全ピクセル数 */
  totalPixels: number;
  /** 差分の割合（0-1） */
  diffPercentage: number;
  /** 差分画像のバッファ（生成された場合） */
  diffBuffer?: Buffer;
  /** 差分画像のパス（保存された場合） */
  diffPath?: string;
}

/**
 * Pixelmatch実行オプション
 */
export interface PixelmatchOptions {
  /** 色差の閾値 (0-1, デフォルト: 0.1) */
  threshold?: number;
  /** アンチエイリアスを含めるか (デフォルト: true) */
  includeAA?: boolean;
  /** 透明度の閾値 (0-1, デフォルト: 0) */
  alpha?: number;
  /** アンチエイリアス検出サイズ (デフォルト: 3) */
  aaColor?: [number, number, number];
  /** 差分色 (RGB, デフォルト: [255, 119, 119]) */
  diffColor?: [number, number, number];
  /** 差分マスクを生成するか (デフォルト: false) */
  diffMask?: boolean;
  /** 差分画像を保存するパス */
  outputDiffPath?: string;
}

/**
 * 画像ファイルからPNGデータを読み込む
 */
export function loadPNG(imagePath: string): PNG {
  if (!existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  
  const buffer = readFileSync(imagePath);
  return PNG.sync.read(buffer);
}

/**
 * BufferからPNGデータを作成
 */
export function createPNGFromBuffer(buffer: Buffer): PNG {
  return PNG.sync.read(buffer);
}

/**
 * 2つの画像を比較してPixelmatch結果を返す
 */
export function executePixelmatch(
  baselineImage: string | Buffer | PNG,
  currentImage: string | Buffer | PNG,
  options: PixelmatchOptions = {}
): PixelmatchResult {
  // 画像データを準備
  const img1 = typeof baselineImage === 'string' 
    ? loadPNG(baselineImage)
    : baselineImage instanceof Buffer
    ? createPNGFromBuffer(baselineImage)
    : baselineImage;
    
  const img2 = typeof currentImage === 'string'
    ? loadPNG(currentImage)
    : currentImage instanceof Buffer
    ? createPNGFromBuffer(currentImage)
    : currentImage;
  
  // PNGインスタンスかBufferかをチェック
  const png1 = img1 instanceof PNG ? img1 : createPNGFromBuffer(img1);
  const png2 = img2 instanceof PNG ? img2 : createPNGFromBuffer(img2);
  
  // サイズチェック
  if (png1.width !== png2.width || png1.height !== png2.height) {
    throw new Error(
      `Image dimensions do not match. ` +
      `Baseline: ${png1.width}x${png1.height}, ` +
      `Current: ${png2.width}x${png2.height}`
    );
  }
  
  const { width, height } = png1;
  const totalPixels = width * height;
  
  // 差分画像用のバッファを作成
  const diff = new PNG({ width, height });
  
  // Pixelmatchオプションを設定
  const pixelmatchOptions: Pixelmatch.PixelmatchOptions = {
    threshold: options.threshold ?? 0.1,
    includeAA: options.includeAA ?? true,
    alpha: options.alpha ?? 0,
    aaColor: options.aaColor ?? [255, 255, 0] as [number, number, number],
    diffColor: options.diffColor ?? [255, 119, 119] as [number, number, number],
    diffColorAlt: options.diffMask ? [0, 0, 0] as [number, number, number] : undefined,
    diffMask: options.diffMask ?? false
  };
  
  // Pixelmatchを実行
  const diffPixels = pixelmatch(
    png1.data,
    png2.data,
    diff.data,
    width,
    height,
    pixelmatchOptions
  );
  
  // 差分画像を保存（オプション）
  let diffPath: string | undefined;
  let diffBuffer: Buffer | undefined;
  
  if (options.outputDiffPath) {
    diffBuffer = PNG.sync.write(diff);
    const dir = dirname(options.outputDiffPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(options.outputDiffPath, diffBuffer);
    diffPath = options.outputDiffPath;
  } else {
    // パスが指定されていない場合でもバッファは返す
    diffBuffer = PNG.sync.write(diff);
  }
  
  return {
    diffPixels,
    totalPixels,
    diffPercentage: diffPixels / totalPixels,
    diffBuffer,
    diffPath
  };
}

/**
 * 複数の領域でPixelmatchを実行
 */
export function executeRegionPixelmatch(
  baselineImage: string | Buffer | PNG,
  currentImage: string | Buffer | PNG,
  regions: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
  options: PixelmatchOptions = {}
): Array<{
  region: typeof regions[0];
  result: PixelmatchResult;
}> {
  // 画像データを準備
  const img1 = typeof baselineImage === 'string' 
    ? loadPNG(baselineImage)
    : baselineImage instanceof Buffer
    ? createPNGFromBuffer(baselineImage)
    : baselineImage;
    
  const img2 = typeof currentImage === 'string'
    ? loadPNG(currentImage)
    : currentImage instanceof Buffer
    ? createPNGFromBuffer(currentImage)
    : currentImage;
  
  const results: Array<{ region: typeof regions[0]; result: PixelmatchResult }> = [];
  
  for (const region of regions) {
    // 領域を切り出す
    const regionImg1 = extractRegion(img1 instanceof PNG ? img1 : createPNGFromBuffer(img1), region);
    const regionImg2 = extractRegion(img2 instanceof PNG ? img2 : createPNGFromBuffer(img2), region);
    
    // 領域ごとにPixelmatchを実行
    const result = executePixelmatch(regionImg1, regionImg2, {
      ...options,
      outputDiffPath: options.outputDiffPath 
        ? options.outputDiffPath.replace('.png', `-${region.name}.png`)
        : undefined
    });
    
    results.push({ region, result });
  }
  
  return results;
}

/**
 * PNG画像から特定の領域を切り出す
 */
function extractRegion(
  image: PNG,
  region: { x: number; y: number; width: number; height: number }
): PNG {
  const { x, y, width, height } = region;
  
  // 境界チェック
  if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) {
    throw new Error(
      `Region out of bounds. ` +
      `Image: ${image.width}x${image.height}, ` +
      `Region: ${x},${y} ${width}x${height}`
    );
  }
  
  const regionPNG = new PNG({ width, height });
  
  // ピクセルデータをコピー
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const srcIdx = ((y + dy) * image.width + (x + dx)) * 4;
      const dstIdx = (dy * width + dx) * 4;
      
      // RGBA値をコピー
      regionPNG.data[dstIdx] = image.data[srcIdx];
      regionPNG.data[dstIdx + 1] = image.data[srcIdx + 1];
      regionPNG.data[dstIdx + 2] = image.data[srcIdx + 2];
      regionPNG.data[dstIdx + 3] = image.data[srcIdx + 3];
    }
  }
  
  return regionPNG;
}

/**
 * スクリーンショットからPixelmatch用の画像を準備
 */
export async function prepareScreenshotForPixelmatch(
  screenshotPath: string | Buffer,
  options?: {
    crop?: { x: number; y: number; width: number; height: number };
    resize?: { width: number; height: number };
  }
): Promise<PNG> {
  let png = typeof screenshotPath === 'string'
    ? loadPNG(screenshotPath)
    : createPNGFromBuffer(screenshotPath);
  
  // クロップ処理
  if (options?.crop) {
    png = extractRegion(png, options.crop);
  }
  
  // リサイズ処理（簡易実装、実際の使用には画像処理ライブラリを推奨）
  if (options?.resize) {
    console.warn('Resize is not implemented in this simple version');
  }
  
  return png;
}