/**
 * Phase 1: Layout Storage Service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaselineLayout, ComparisonResult } from './types';

export interface StorageOptions {
  basePath: string;
  format?: 'json' | 'compressed';
}

export class LayoutStorage {
  constructor(private readonly options: StorageOptions) {}
  
  async saveBaseline(layout: BaselineLayout): Promise<string> {
    const filename = `baseline-${layout.id}.json`;
    const filepath = path.join(this.options.basePath, 'baselines', filename);
    
    await this.ensureDirectory(path.dirname(filepath));
    
    if (this.options.format === 'compressed') {
      // TODO: Implement compression
      await fs.writeFile(filepath, JSON.stringify(layout));
    } else {
      await fs.writeFile(filepath, JSON.stringify(layout, null, 2));
    }
    
    return filepath;
  }
  
  async loadBaseline(id: string): Promise<BaselineLayout | null> {
    const filename = `baseline-${id}.json`;
    const filepath = path.join(this.options.basePath, 'baselines', filename);
    
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  async saveComparison(result: ComparisonResult): Promise<string> {
    const filename = `comparison-${result.id}.json`;
    const filepath = path.join(this.options.basePath, 'comparisons', filename);
    
    await this.ensureDirectory(path.dirname(filepath));
    await fs.writeFile(filepath, JSON.stringify(result, null, 2));
    
    return filepath;
  }
  
  async loadComparison(id: string): Promise<ComparisonResult | null> {
    const filename = `comparison-${id}.json`;
    const filepath = path.join(this.options.basePath, 'comparisons', filename);
    
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  async listBaselines(): Promise<string[]> {
    const dir = path.join(this.options.basePath, 'baselines');
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(f => f.startsWith('baseline-') && f.endsWith('.json'))
        .map(f => f.replace('baseline-', '').replace('.json', ''));
    } catch (error) {
      return [];
    }
  }
  
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}