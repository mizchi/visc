/**
 * Configuration Loader
 * 設定ファイルの読み込み
 */

import fs from 'fs/promises';
import path from 'path';
import type { BasicConfig } from './types.js';

/**
 * 設定ファイルを読み込むクラス
 * 
 * @example
 * ```typescript
 * // JSONファイルから読み込み
 * const config = await ConfigLoader.fromFile('./config.json');
 * 
 * // デフォルト設定とマージ
 * const config = await ConfigLoader.fromFile('./config.json', {
 *   browser: { headless: true },
 *   comparison: { threshold: 0.1 }
 * });
 * ```
 */
export class ConfigLoader {
  /**
   * JSONファイルから設定を読み込む
   */
  static async fromFile(
    filePath: string,
    defaults?: Partial<BasicConfig>
  ): Promise<BasicConfig> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content) as BasicConfig;
      
      // デフォルト値とマージ
      return this.mergeWithDefaults(config, defaults);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in configuration file: ${filePath}`);
      }
      throw error;
    }
  }
  
  /**
   * 複数の設定ファイルを読み込んでマージ
   */
  static async fromFiles(
    filePaths: string[],
    defaults?: Partial<BasicConfig>
  ): Promise<BasicConfig> {
    let merged: BasicConfig = defaults || {};
    
    for (const filePath of filePaths) {
      const config = await this.fromFile(filePath);
      merged = this.mergeConfigs(merged, config);
    }
    
    return merged;
  }
  
  /**
   * 環境変数から設定を読み込む
   */
  static fromEnv(prefix: string = 'VISUAL_CHECKER_'): Partial<BasicConfig> {
    const config: Partial<BasicConfig> = {};
    
    // BASE_URL
    if (process.env[`${prefix}BASE_URL`]) {
      config.baseUrl = process.env[`${prefix}BASE_URL`];
    }
    
    // SNAPSHOT_DIR
    if (process.env[`${prefix}SNAPSHOT_DIR`]) {
      config.snapshotDir = process.env[`${prefix}SNAPSHOT_DIR`];
    }
    
    // BROWSER_TYPE
    if (process.env[`${prefix}BROWSER_TYPE`]) {
      config.browser = config.browser || {};
      config.browser.browser = process.env[`${prefix}BROWSER_TYPE`] as any;
    }
    
    // HEADLESS
    if (process.env[`${prefix}HEADLESS`]) {
      config.browser = config.browser || {};
      config.browser.headless = process.env[`${prefix}HEADLESS`] === 'true';
    }
    
    // THRESHOLD
    const thresholdEnv = process.env[`${prefix}THRESHOLD`];
    if (thresholdEnv) {
      config.comparison = config.comparison || {};
      config.comparison.threshold = parseFloat(thresholdEnv);
    }
    
    return config;
  }
  
  /**
   * デフォルト設定を取得
   */
  static getDefaults(): BasicConfig {
    return {
      baseUrl: 'http://localhost:3000',
      snapshotDir: './snapshots',
      browser: {
        browser: 'chromium',
        headless: true,
        viewport: { name: 'default', width: 1280, height: 720 },
        timeout: 30000
      },
      comparison: {
        threshold: 0.1,
        generateDiff: true,
        diffDir: './diffs'
      },
      urls: []
    };
  }
  
  /**
   * 設定をマージ
   */
  static mergeConfigs(...configs: Partial<BasicConfig>[]): BasicConfig {
    const result: any = {};
    
    for (const config of configs) {
      for (const [key, value] of Object.entries(config)) {
        if (value === undefined) continue;
        
        if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
          result[key] = { ...result[key], ...value };
        } else {
          result[key] = value;
        }
      }
    }
    
    return result;
  }
  
  /**
   * デフォルト値とマージ
   */
  static mergeWithDefaults(
    config: Partial<BasicConfig>,
    customDefaults?: Partial<BasicConfig>
  ): BasicConfig {
    return this.mergeConfigs(
      this.getDefaults(),
      customDefaults || {},
      config
    );
  }
  
  /**
   * 設定ファイルを探す
   */
  static async findConfigFile(
    startDir: string = process.cwd(),
    filename: string = 'visual-checker.config.json'
  ): Promise<string | null> {
    let currentDir = path.resolve(startDir);
    
    while (currentDir !== path.dirname(currentDir)) {
      const configPath = path.join(currentDir, filename);
      
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
        // ファイルが存在しない
      }
      
      // configs ディレクトリも確認
      const configsPath = path.join(currentDir, 'configs', filename);
      try {
        await fs.access(configsPath);
        return configsPath;
      } catch {
        // ファイルが存在しない
      }
      
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
}