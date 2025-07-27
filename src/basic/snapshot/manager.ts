/**
 * Snapshot Manager
 * スナップショットの管理を行う基本クラス
 */

import fs from 'fs/promises';
import path from 'path';
import { compareImages } from '../../core/compare.js';
import type { CompareResult } from '../../core/types.js';

/**
 * スナップショットを管理するクラス
 * 
 * @example
 * ```typescript
 * // 基本的な使い方
 * const manager = new SnapshotManager('./snapshots');
 * 
 * // ベースラインの更新
 * await manager.update('home', './screenshot.png');
 * 
 * // 比較
 * const result = await manager.compare('home', './new-screenshot.png');
 * if (!result.match) {
 *   console.log(`Difference: ${result.difference * 100}%`);
 * }
 * ```
 */
export class SnapshotManager {
  private snapshotDir: string;
  
  constructor(snapshotDir: string = './snapshots') {
    this.snapshotDir = path.resolve(snapshotDir);
  }
  
  /**
   * ベースラインスナップショットを更新
   */
  async update(name: string, imagePath: string): Promise<void> {
    const baselinePath = this.getBaselinePath(name);
    
    // ディレクトリの作成
    await fs.mkdir(path.dirname(baselinePath), { recursive: true });
    
    // ファイルのコピー
    await fs.copyFile(imagePath, baselinePath);
  }
  
  /**
   * 現在の画像とベースラインを比較
   */
  async compare(name: string, currentImagePath: string, options?: {
    threshold?: number;
    generateDiff?: boolean;
  }): Promise<CompareResult & { baselinePath: string }> {
    const baselinePath = this.getBaselinePath(name);
    
    // ベースラインの存在確認
    try {
      await fs.access(baselinePath);
    } catch {
      throw new Error(`Baseline not found for "${name}". Run update() first.`);
    }
    
    // 差分画像のパス
    const diffPath = this.getDiffPath(name);
    
    // 画像の比較
    const result = await compareImages(baselinePath, currentImagePath, {
      threshold: options?.threshold,
      generateDiff: options?.generateDiff,
      diffPath
    });
    
    return {
      ...result,
      baselinePath
    };
  }
  
  /**
   * ベースラインが存在するか確認
   */
  async hasBaseline(name: string): Promise<boolean> {
    try {
      await fs.access(this.getBaselinePath(name));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * すべてのベースラインを取得
   */
  async listBaselines(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.snapshotDir);
      return files
        .filter(file => file.endsWith('-baseline.png'))
        .map(file => file.replace('-baseline.png', ''));
    } catch {
      return [];
    }
  }
  
  /**
   * ベースラインを削除
   */
  async deleteBaseline(name: string): Promise<void> {
    const baselinePath = this.getBaselinePath(name);
    try {
      await fs.unlink(baselinePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  
  /**
   * すべてのベースラインを削除
   */
  async clearAll(): Promise<void> {
    try {
      await fs.rm(this.snapshotDir, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
  }
  
  /**
   * ベースラインのパスを取得
   */
  getBaselinePath(name: string): string {
    return path.join(this.snapshotDir, `${name}-baseline.png`);
  }
  
  /**
   * 現在のスナップショットのパスを取得
   */
  getCurrentPath(name: string): string {
    return path.join(this.snapshotDir, `${name}-current.png`);
  }
  
  /**
   * 差分画像のパスを取得
   */
  getDiffPath(name: string): string {
    return path.join(this.snapshotDir, `${name}-diff.png`);
  }
  
  /**
   * スナップショットディレクトリのパスを取得
   */
  getSnapshotDir(): string {
    return this.snapshotDir;
  }
}