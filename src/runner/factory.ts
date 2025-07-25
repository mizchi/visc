/**
 * ブラウザランナーファクトリー
 */

import type { BrowserRunner, BrowserRunnerFactory } from "./types.js";
import { PlaywrightRunner } from "./playwright-runner.js";
import { PuppeteerRunner } from "./puppeteer-runner.js";

export class DefaultBrowserRunnerFactory implements BrowserRunnerFactory {
  private runners: Map<string, BrowserRunner> = new Map();

  create(type: 'playwright' | 'puppeteer'): BrowserRunner {
    // 既存のランナーがあれば再利用
    const existing = this.runners.get(type);
    if (existing) {
      return existing;
    }

    let runner: BrowserRunner;
    
    switch (type) {
      case 'playwright':
        runner = new PlaywrightRunner();
        break;
      case 'puppeteer':
        runner = new PuppeteerRunner();
        break;
      default:
        throw new Error(`Unsupported browser runner type: ${type}`);
    }

    this.runners.set(type, runner);
    return runner;
  }

  /**
   * すべてのランナーをクリーンアップ
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.runners.values()).map(runner => {
      if (runner.cleanup) {
        return runner.cleanup().catch(error => 
          console.error(`Failed to cleanup runner ${runner.type}:`, error)
        );
      }
      return Promise.resolve();
    });
    
    await Promise.all(cleanupPromises);
    this.runners.clear();
  }

  /**
   * 特定のランナーをクリーンアップ
   */
  async cleanupRunner(type: 'playwright' | 'puppeteer'): Promise<void> {
    const runner = this.runners.get(type);
    if (runner && runner.cleanup) {
      await runner.cleanup();
      this.runners.delete(type);
    }
  }
}

// デフォルトのファクトリーインスタンス
export const defaultRunnerFactory = new DefaultBrowserRunnerFactory();

// プロセス終了時のクリーンアップ
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    await defaultRunnerFactory.cleanup();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await cleanup();
    process.exit(1);
  });
}