import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import path from 'path';
import { TestResult, UrlConfig, VisualCheckConfig } from './types.js';

export class SnapshotComparator {
  constructor(private config: VisualCheckConfig) {}

  /**
   * スナップショットを比較
   */
  async compare(
    currentImagePath: string,
    baselineImagePath: string,
    urlConfig: UrlConfig
  ): Promise<Partial<TestResult>> {
    try {
      // ベースラインが存在しない場合は新規作成
      if (!(await this.fileExists(baselineImagePath))) {
        await fs.copyFile(currentImagePath, baselineImagePath);
        return {
          passed: true,
          error: 'New baseline created',
        };
      }

      // 画像を読み込み
      const [currentImage, baselineImage] = await Promise.all([
        this.loadImage(currentImagePath),
        this.loadImage(baselineImagePath),
      ]);

      // サイズが異なる場合はエラー
      if (
        currentImage.width !== baselineImage.width ||
        currentImage.height !== baselineImage.height
      ) {
        return {
          passed: false,
          error: `Image dimensions mismatch. Current: ${currentImage.width}x${currentImage.height}, Baseline: ${baselineImage.width}x${baselineImage.height}`,
        };
      }

      // 差分を計算
      const diff = new PNG({ width: currentImage.width, height: currentImage.height });
      const threshold = this.config.comparison?.threshold ?? 0.1;
      
      const numDiffPixels = pixelmatch(
        baselineImage.data,
        currentImage.data,
        diff.data,
        currentImage.width,
        currentImage.height,
        { threshold }
      );

      const totalPixels = currentImage.width * currentImage.height;
      const diffPercentage = numDiffPixels / totalPixels;

      // 差分画像を保存
      let diffImagePath: string | undefined;
      if (this.config.comparison?.generateDiff && numDiffPixels > 0) {
        diffImagePath = await this.saveDiffImage(diff, urlConfig.name);
      }

      return {
        passed: diffPercentage <= threshold,
        diffPercentage,
        diffImagePath,
        error: diffPercentage > threshold
          ? `Visual difference detected: ${(diffPercentage * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(2)}%)`
          : undefined,
      };
    } catch (error) {
      return {
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error during comparison',
      };
    }
  }

  /**
   * 画像を読み込み
   */
  private async loadImage(imagePath: string): Promise<PNG> {
    const buffer = await fs.readFile(imagePath);
    return PNG.sync.read(buffer);
  }

  /**
   * 差分画像を保存
   */
  private async saveDiffImage(diff: PNG, name: string): Promise<string> {
    const diffDir = this.config.comparison?.diffDir ?? './diffs';
    await fs.mkdir(diffDir, { recursive: true });
    
    const diffPath = path.join(diffDir, `${name}-diff.png`);
    const buffer = PNG.sync.write(diff);
    await fs.writeFile(diffPath, buffer);
    
    return diffPath;
  }

  /**
   * ファイルの存在確認
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}