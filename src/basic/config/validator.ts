/**
 * Configuration Validator
 * 設定の検証
 */

import type { BasicConfig, ValidationResult } from './types.js';

/**
 * 設定ファイルを検証するクラス
 * 
 * @example
 * ```typescript
 * const validator = new ConfigValidator();
 * const result = validator.validate(config);
 * 
 * if (!result.valid) {
 *   console.error('Configuration errors:', result.errors);
 * }
 * 
 * if (result.warnings.length > 0) {
 *   console.warn('Configuration warnings:', result.warnings);
 * }
 * ```
 */
export class ConfigValidator {
  /**
   * 設定を検証
   */
  validate(config: Partial<BasicConfig>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // URLリストの検証
    if (config.urls) {
      if (!Array.isArray(config.urls)) {
        errors.push('urls must be an array');
      } else {
        config.urls.forEach((url, index) => {
          if (!url.name) {
            errors.push(`urls[${index}].name is required`);
          }
          if (!url.url) {
            errors.push(`urls[${index}].url is required`);
          }
          
          // 待機条件の検証
          if (url.waitFor) {
            if (url.waitFor.timeout && url.waitFor.timeout < 0) {
              errors.push(`urls[${index}].waitFor.timeout must be positive`);
            }
          }
          
          // スクリーンショットオプションの検証
          if (url.screenshot?.clip) {
            const clip = url.screenshot.clip;
            if (clip.width <= 0 || clip.height <= 0) {
              errors.push(`urls[${index}].screenshot.clip must have positive width and height`);
            }
          }
        });
      }
    }
    
    // ブラウザ設定の検証
    if (config.browser) {
      if (config.browser.browser && 
          !['chromium', 'firefox', 'webkit'].includes(config.browser.browser)) {
        errors.push('browser.browser must be one of: chromium, firefox, webkit');
      }
      
      if (config.browser.viewport) {
        if (config.browser.viewport.width <= 0 || config.browser.viewport.height <= 0) {
          errors.push('browser.viewport must have positive width and height');
        }
      }
      
      if (config.browser.timeout && config.browser.timeout < 0) {
        errors.push('browser.timeout must be positive');
      }
    }
    
    // 比較設定の検証
    if (config.comparison) {
      if (config.comparison.threshold !== undefined) {
        if (config.comparison.threshold < 0 || config.comparison.threshold > 1) {
          errors.push('comparison.threshold must be between 0 and 1');
        }
      }
    }
    
    // 警告の生成
    if (!config.baseUrl) {
      warnings.push('baseUrl is not set, will use default: http://localhost:3000');
    }
    
    if (!config.snapshotDir) {
      warnings.push('snapshotDir is not set, will use default: ./snapshots');
    }
    
    if (config.browser?.headless === false) {
      warnings.push('Running in headed mode may be slower');
    }
    
    if (config.comparison?.threshold && config.comparison.threshold > 0.5) {
      warnings.push('High threshold value may miss visual changes');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * 厳密な検証（すべての必須フィールドをチェック）
   */
  validateStrict(config: any): ValidationResult {
    const result = this.validate(config);
    
    // 必須フィールドのチェック
    if (!config.urls || config.urls.length === 0) {
      result.errors.push('urls is required and must contain at least one URL');
    }
    
    result.valid = result.errors.length === 0;
    return result;
  }
  
  /**
   * 設定値を正規化
   */
  normalize(config: Partial<BasicConfig>): BasicConfig {
    const normalized: any = { ...config };
    
    // URLの正規化
    if (normalized.baseUrl && !normalized.baseUrl.endsWith('/')) {
      normalized.baseUrl = normalized.baseUrl + '/';
    }
    
    // パスの正規化
    if (normalized.snapshotDir) {
      normalized.snapshotDir = normalized.snapshotDir.replace(/\\/g, '/');
    }
    
    if (normalized.comparison?.diffDir) {
      normalized.comparison.diffDir = normalized.comparison.diffDir.replace(/\\/g, '/');
    }
    
    // URLリストの正規化
    if (normalized.urls) {
      normalized.urls = normalized.urls.map((url: any) => ({
        ...url,
        url: url.url.startsWith('/') ? url.url : '/' + url.url
      }));
    }
    
    return normalized;
  }
}