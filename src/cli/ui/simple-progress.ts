/**
 * Simple progress display without Ink (fallback)
 */

import { stdout } from 'process';

export class SimpleProgressDisplay {
  private lastLineLength = 0;

  renderProgressBar(current: number, total: number, label: string = "") {
    const width = 30;
    const percent = Math.floor((current / total) * 100);
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;

    const bar = `[${"█".repeat(filled)}${" ".repeat(empty)}]`;
    const progress = `${current}/${total}`;

    this.clearLine();
    stdout.write(`\r${bar} ${progress} ${percent}% ${label}`);
    this.lastLineLength = bar.length + progress.length + label.length + 10;

    if (current === total) {
      stdout.write("\n");
      this.lastLineLength = 0;
    }
  }

  clearLine() {
    if (this.lastLineLength > 0) {
      stdout.write("\r" + " ".repeat(this.lastLineLength) + "\r");
    }
  }

  log(message: string) {
    this.clearLine();
    console.log(message);
    this.lastLineLength = 0;
  }
}