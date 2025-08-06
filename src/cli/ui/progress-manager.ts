/**
 * Progress manager for Ink UI
 */

import { EventEmitter } from 'events';
import type { TaskProgress } from './progress-ui.js';

export class ProgressManager extends EventEmitter {
  private tasks: Map<string, TaskProgress> = new Map();
  private phase: 'capture' | 'compare' | 'calibration' = 'capture';
  
  constructor() {
    super();
  }

  setPhase(phase: 'capture' | 'compare' | 'calibration') {
    this.phase = phase;
    this.emit('update', this.getState());
  }

  addTask(task: TaskProgress) {
    this.tasks.set(task.id, task);
    this.emit('update', this.getState());
  }

  updateTask(id: string, updates: Partial<TaskProgress>) {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
      this.emit('update', this.getState());
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

  updateProgress(id: string, progress: number, total: number) {
    this.updateTask(id, { progress, total });
  }

  clear() {
    this.tasks.clear();
    this.emit('update', this.getState());
  }

  getState() {
    return {
      phase: this.phase,
      tasks: Array.from(this.tasks.values()),
      overallProgress: this.calculateOverallProgress()
    };
  }

  private calculateOverallProgress(): number {
    if (this.tasks.size === 0) return 0;
    
    const completed = Array.from(this.tasks.values()).filter(
      t => t.status === 'completed' || t.status === 'failed'
    ).length;
    
    return (completed / this.tasks.size) * 100;
  }
}

// Global instance
export const progressManager = new ProgressManager();