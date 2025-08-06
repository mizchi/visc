/**
 * Enhanced progress display with better visualization
 */

import chalk from 'chalk';
import ora from 'ora';
import { stdout } from 'process';

export type TaskState = 
  | 'pending'
  | 'requesting'
  | 'waiting-lcp'
  | 'extracting'
  | 'completed'
  | 'failed';

interface Task {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  state?: TaskState;
  progress?: number;
  total?: number;
  message?: string;
}

export class EnhancedProgressDisplay {
  private tasks: Map<string, Task> = new Map();
  private phase: string = '';
  private spinner: any = null;
  private isInteractive: boolean;
  private lastRenderLines = 0;

  constructor(isInteractive: boolean = true) {
    this.isInteractive = isInteractive;
  }

  setPhase(phase: string, emoji: string = '🚀') {
    this.phase = phase;
    if (!this.isInteractive) {
      console.log(`\n${emoji} ${chalk.bold(phase)}\n`);
    }
  }

  addTask(task: Task) {
    this.tasks.set(task.id, task);
    this.render();
  }

  updateTask(id: string, updates: Partial<Task>) {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
      this.render();
    }
  }

  updateTaskState(id: string, state: TaskState, message?: string) {
    const task = this.tasks.get(id);
    if (task) {
      const updates: Partial<Task> = { state };
      if (message) updates.message = message;
      if (state === 'completed') {
        updates.status = 'completed';
      } else if (state === 'failed') {
        updates.status = 'failed';
      } else if (state !== 'pending') {
        updates.status = 'running';
      }
      this.updateTask(id, updates);
    }
  }

  startTask(id: string, message?: string) {
    this.updateTask(id, { status: 'running', message });
  }

  completeTask(id: string, message?: string) {
    this.updateTask(id, { status: 'completed', message });
  }

  failTask(id: string, message: string) {
    this.updateTask(id, { status: 'failed', message });
  }

  private render() {
    if (!this.isInteractive) {
      return; // In non-interactive mode, we just log messages
    }

    // Clear previous render
    if (this.lastRenderLines > 0) {
      stdout.write('\x1B[' + this.lastRenderLines + 'A'); // Move cursor up
      stdout.write('\x1B[J'); // Clear from cursor to end
    }

    const lines: string[] = [];

    // Header
    if (this.phase) {
      lines.push(chalk.bold.blue(`📊 ${this.phase}`));
      lines.push('');
    }

    // Group tasks by status
    const running = Array.from(this.tasks.values()).filter(t => t.status === 'running');
    const completed = Array.from(this.tasks.values()).filter(t => t.status === 'completed');
    const failed = Array.from(this.tasks.values()).filter(t => t.status === 'failed');
    const pending = Array.from(this.tasks.values()).filter(t => t.status === 'pending');

    // Show completed tasks
    completed.forEach(task => {
      lines.push(`${chalk.green('✓')} ${chalk.gray(task.label)} ${task.message ? chalk.gray(`- ${task.message}`) : ''}`);
    });

    // Show running tasks with progress
    running.forEach(task => {
      const icon = chalk.blue('⟳');
      let line = `${icon} ${chalk.bold(task.label)}`;
      
      // Show state if available
      if (task.state && task.state !== 'pending' && task.state !== 'completed') {
        const stateColor = this.getStateColor(task.state);
        const stateText = this.getStateText(task.state);
        // Use type assertion to access chalk color methods
        line += ` ${(chalk as any)[stateColor](`[${stateText}]`)}`;
      }
      
      if (task.progress !== undefined && task.total) {
        const percent = Math.round((task.progress / task.total) * 100);
        const bar = this.renderProgressBar(task.progress, task.total);
        line += ` ${bar} ${chalk.cyan(`${percent}%`)}`;
      }
      
      if (task.message) {
        line += ` ${chalk.yellow(task.message)}`;
      }
      
      lines.push(line);
    });

    // Show failed tasks
    failed.forEach(task => {
      lines.push(`${chalk.red('✗')} ${chalk.red(task.label)} - ${chalk.red(task.message || 'Failed')}`);
    });

    // Summary
    if (this.tasks.size > 0) {
      lines.push('');
      const summary = `${completed.length}/${this.tasks.size} completed`;
      const failedCount = failed.length > 0 ? chalk.red(` (${failed.length} failed)`) : '';
      lines.push(chalk.gray(summary + failedCount));
    }

    // Output
    stdout.write(lines.join('\n') + '\n');
    this.lastRenderLines = lines.length;
  }

  private renderProgressBar(current: number, total: number): string {
    const width = 20;
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;
    
    const filledChar = chalk.cyan('█');
    const emptyChar = chalk.gray('░');
    
    return `[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]`;
  }

  private getStateColor(state: TaskState): string {
    switch (state) {
      case 'requesting': return 'cyan';
      case 'waiting-lcp': return 'yellow';
      case 'extracting': return 'magenta';
      case 'failed': return 'red';
      default: return 'gray';
    }
  }

  private getStateText(state: TaskState): string {
    switch (state) {
      case 'requesting': return 'Requesting';
      case 'waiting-lcp': return 'Waiting LCP';
      case 'extracting': return 'Extracting';
      default: return state;
    }
  }

  clear() {
    this.tasks.clear();
    this.render();
  }

  finish() {
    if (this.spinner) {
      this.spinner.stop();
    }
    this.render();
  }

  // Simple progress bar for non-task progress
  showProgress(label: string, current: number, total: number) {
    if (this.isInteractive) {
      const percent = Math.round((current / total) * 100);
      const bar = this.renderProgressBar(current, total);
      stdout.write(`\r${bar} ${percent}% ${label}`);
      
      if (current === total) {
        stdout.write('\n');
      }
    } else {
      if (current === total) {
        console.log(`✓ ${label}`);
      }
    }
  }

  log(message: string) {
    if (this.isInteractive) {
      // Clear current render
      if (this.lastRenderLines > 0) {
        stdout.write('\x1B[' + this.lastRenderLines + 'A');
        stdout.write('\x1B[J');
      }
    }
    
    console.log(message);
    
    if (this.isInteractive) {
      this.render();
    }
  }

  // Calibration-specific display
  showCalibration(testCase: string, viewport: string, current: number, total: number, confidence?: number) {
    if (this.isInteractive) {
      stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
      
      let line = `🔧 ${chalk.bold(testCase)} @ ${chalk.cyan(viewport)} `;
      line += this.renderProgressBar(current, total);
      line += ` ${current}/${total}`;
      
      if (confidence !== undefined) {
        const color = confidence > 90 ? 'green' : confidence > 70 ? 'yellow' : 'red';
        line += ` ${chalk[color](`(${confidence.toFixed(1)}% confidence)`)}`;
      }
      
      stdout.write(line);
      
      if (current === total) {
        stdout.write('\n');
      }
    } else {
      if (current === total) {
        const confStr = confidence ? ` (${confidence.toFixed(1)}% confidence)` : '';
        console.log(`✓ Calibrated ${testCase} @ ${viewport}${confStr}`);
      }
    }
  }
}