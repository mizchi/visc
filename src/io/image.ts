import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import { writeBinaryFile } from './file.js';

export interface ImageCompareResult {
  difference: number;
  diffPixels: number;
  diffBuffer?: Buffer;
  totalPixels: number;
}

/**
 * PNG画像を読み込む
 */
export async function readPNG(filePath: string): Promise<PNG> {
  const buffer = await fs.readFile(filePath);
  return PNG.sync.read(buffer);
}

/**
 * PNG画像を保存
 */
export async function writePNG(filePath: string, png: PNG): Promise<void> {
  const buffer = PNG.sync.write(png);
  await writeBinaryFile(filePath, buffer);
}

/**
 * 画像を比較
 */
export async function compareImages(
  originalPath: string,
  modifiedPath: string,
  options: {
    threshold?: number;
    generateDiff?: boolean;
    diffPath?: string;
  } = {}
): Promise<ImageCompareResult> {
  const original = await readPNG(originalPath);
  const modified = await readPNG(modifiedPath);

  if (original.width !== modified.width || original.height !== modified.height) {
    throw new Error(`Image dimensions do not match: ${original.width}x${original.height} vs ${modified.width}x${modified.height}`);
  }

  const { width, height } = original;
  const totalPixels = width * height;
  let diffBuffer: Buffer | undefined;

  let diff: PNG | null = null;
  if (options.generateDiff) {
    diff = new PNG({ width, height });
  }

  const diffPixels = pixelmatch(
    original.data,
    modified.data,
    diff?.data || null,
    width,
    height,
    { threshold: options.threshold || 0.1 }
  );

  const difference = diffPixels / totalPixels;

  if (options.generateDiff && diff && options.diffPath) {
    await writePNG(options.diffPath, diff);
    diffBuffer = PNG.sync.write(diff);
  }

  return {
    difference,
    diffPixels,
    diffBuffer,
    totalPixels
  };
}

/**
 * スクリーンショットをPNG形式で保存
 */
export async function saveScreenshot(
  screenshotBuffer: Buffer,
  filePath: string
): Promise<void> {
  await writeBinaryFile(filePath, screenshotBuffer);
}