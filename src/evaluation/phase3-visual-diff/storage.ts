/**
 * Phase 3: Visual Diff Storage
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { VisualDiff } from './types';

export class VisualDiffStorage {
  constructor(private readonly options: {
    fixturesPath: string;
    maxDiffs?: number;
  }) {}
  
  async saveDiff(diff: VisualDiff): Promise<string> {
    const diffDir = path.join(this.options.fixturesPath, '__fixtures__', diff.id);
    await fs.mkdir(diffDir, { recursive: true });
    
    // Save metadata
    const metadataPath = path.join(diffDir, 'diff-metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(diff, null, 2));
    
    // Clean up old diffs if limit exceeded
    if (this.options.maxDiffs) {
      await this.cleanupOldDiffs();
    }
    
    return diffDir;
  }
  
  async loadDiff(diffId: string): Promise<VisualDiff | null> {
    const metadataPath = path.join(
      this.options.fixturesPath,
      '__fixtures__',
      diffId,
      'diff-metadata.json'
    );
    
    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }
  
  async listDiffs(): Promise<string[]> {
    const fixturesDir = path.join(this.options.fixturesPath, '__fixtures__');
    
    try {
      const entries = await fs.readdir(fixturesDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('diff-'))
        .map(entry => entry.name);
    } catch (error) {
      return [];
    }
  }
  
  private async cleanupOldDiffs(): Promise<void> {
    const diffs = await this.listDiffs();
    
    if (diffs.length <= (this.options.maxDiffs || 10)) {
      return;
    }
    
    // Sort by timestamp (embedded in ID)
    const sortedDiffs = diffs.sort((a, b) => {
      const timestampA = parseInt(a.split('-')[1]);
      const timestampB = parseInt(b.split('-')[1]);
      return timestampA - timestampB;
    });
    
    // Remove oldest diffs
    const diffsToRemove = sortedDiffs.slice(0, diffs.length - (this.options.maxDiffs || 10));
    
    for (const diffId of diffsToRemove) {
      const diffDir = path.join(this.options.fixturesPath, '__fixtures__', diffId);
      await fs.rm(diffDir, { recursive: true });
    }
  }
}