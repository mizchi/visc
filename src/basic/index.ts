/**
 * Visual Checker Basic API
 * 
 * 一般的な使用ケースに対応する基本機能
 * 
 * @example
 * ```typescript
 * import { BrowserController, SnapshotManager } from 'visual-checker/basic';
 * 
 * // ブラウザ制御
 * const browser = new BrowserController({ headless: true });
 * await browser.launch();
 * 
 * // スナップショット管理
 * const manager = new SnapshotManager('./snapshots');
 * const screenshot = await browser.captureScreenshot({ url: '/' });
 * await manager.update('home', screenshot);
 * ```
 * 
 * @module basic
 */

export * from './browser/index.js';
export * from './snapshot/index.js';
export * from './config/index.js';