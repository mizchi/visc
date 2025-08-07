/**
 * Utility functions for check command
 */

import { stdout } from "process";
import { EnhancedProgressDisplay } from "../../ui/enhanced-progress.js";

/**
 * Execute tasks with concurrency limit
 */
export async function executeWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then((result) => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      executing.splice(0, executing.findIndex((p) => p !== promise) + 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Execute a function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  retries: number,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < retries && onRetry) {
        onRetry(attempt + 1, error);
      }
    }
  }
  
  throw lastError || new Error("Unknown error during retry");
}

/**
 * Render progress bar
 */
export function renderProgressBar(
  current: number, 
  total: number, 
  label: string = "",
  progressDisplay: EnhancedProgressDisplay | null = null
) {
  if (progressDisplay) {
    progressDisplay.showProgress(label, current, total);
  } else {
    const width = 30;
    const percent = Math.floor((current / total) * 100);
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;

    const bar = `[${"█".repeat(filled)}${" ".repeat(empty)}]`;
    const progress = `${current}/${total}`;

    stdout.write(`\r${bar} ${progress} ${percent}% ${label}`);

    if (current === total) {
      stdout.write("\n");
    }
  }
}

/**
 * Clear terminal line
 */
export function clearLine() {
  stdout.write("\r" + " ".repeat(80) + "\r");
}

/**
 * Log message with progress display support
 */
export function log(message: string, progressDisplay: EnhancedProgressDisplay | null = null) {
  if (progressDisplay) {
    progressDisplay.log(message);
  } else {
    console.log(message);
  }
}