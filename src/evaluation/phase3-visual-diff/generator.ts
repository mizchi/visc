/**
 * Phase 3: Visual Diff Generator
 */

import { Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ComparisonResult, LayoutDifference } from '../phase1-layout/types';
import { VisualDiff, HighlightRegion, DiffGenerationOptions } from './types';

export class VisualDiffGenerator {
  private readonly defaultColors = {
    added: '#00FF00',
    removed: '#FF0000',
    modified: '#FFA500'
  };
  
  constructor(private readonly options: DiffGenerationOptions = {}) {}
  
  async generateDiff(
    page: Page,
    comparison: ComparisonResult,
    outputDir: string
  ): Promise<VisualDiff> {
    const timestamp = Date.now();
    const baselineScreenshot = path.join(outputDir, `baseline-${timestamp}.png`);
    const currentScreenshot = path.join(outputDir, `current-${timestamp}.png`);
    const overlayImage = path.join(outputDir, `overlay-${timestamp}.png`);
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Take current screenshot
    await page.screenshot({ path: currentScreenshot, fullPage: true });
    
    // Generate highlight regions from comparison
    const highlightRegions = this.generateHighlightRegions(comparison.differences);
    
    // Create overlay with highlights
    if (this.options.includeOverlay !== false) {
      await this.createOverlay(page, highlightRegions, overlayImage);
    }
    
    const visualDiff: VisualDiff = {
      id: `diff-${timestamp}`,
      comparisonId: comparison.id,
      baselineScreenshot: baselineScreenshot,
      currentScreenshot: currentScreenshot,
      overlayImage: this.options.includeOverlay !== false ? overlayImage : undefined,
      highlightRegions,
      metadata: {
        createdAt: timestamp,
        diffPixels: 0, // TODO: Calculate actual pixel diff
        diffPercentage: comparison.statistics.percentageChanged,
        threshold: this.options.threshold || 0
      }
    };
    
    return visualDiff;
  }
  
  private generateHighlightRegions(differences: LayoutDifference[]): HighlightRegion[] {
    const regions: HighlightRegion[] = [];
    const colors = { ...this.defaultColors, ...this.options.highlightColor };
    
    for (const diff of differences) {
      if (diff.type === 'added' && diff.current) {
        regions.push({
          type: 'added',
          bounds: diff.current.bounds,
          color: colors.added,
          opacity: 0.5,
          label: 'New Element'
        });
      } else if (diff.type === 'removed' && diff.baseline) {
        regions.push({
          type: 'removed',
          bounds: diff.baseline.bounds,
          color: colors.removed,
          opacity: 0.5,
          label: 'Removed Element'
        });
      } else if (diff.type === 'modified' && diff.current) {
        regions.push({
          type: 'modified',
          bounds: diff.current.bounds,
          color: colors.modified,
          opacity: 0.5,
          label: this.getChangeLabel(diff.changes)
        });
      }
    }
    
    return regions;
  }
  
  private getChangeLabel(changes?: any): string {
    if (!changes) return 'Modified';
    
    const changeTypes = [];
    if (changes.bounds) changeTypes.push('Position/Size');
    if (changes.text) changeTypes.push('Text');
    if (changes.visibility) changeTypes.push('Visibility');
    if (changes.attributes) changeTypes.push('Attributes');
    
    return changeTypes.join(', ');
  }
  
  private async createOverlay(
    page: Page,
    regions: HighlightRegion[],
    outputPath: string
  ): Promise<void> {
    // Inject overlay script
    await page.evaluate((regions) => {
      // Remove existing overlay if any
      const existingOverlay = document.getElementById('visual-diff-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'visual-diff-overlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '999999';
      
      // Add highlight regions
      regions.forEach(region => {
        const highlight = document.createElement('div');
        highlight.style.position = 'absolute';
        highlight.style.left = `${region.bounds.x}px`;
        highlight.style.top = `${region.bounds.y}px`;
        highlight.style.width = `${region.bounds.width}px`;
        highlight.style.height = `${region.bounds.height}px`;
        highlight.style.backgroundColor = region.color;
        highlight.style.opacity = region.opacity.toString();
        highlight.style.border = `2px solid ${region.color}`;
        highlight.style.boxSizing = 'border-box';
        
        if (region.label) {
          const label = document.createElement('div');
          label.textContent = region.label;
          label.style.position = 'absolute';
          label.style.top = '-20px';
          label.style.left = '0';
          label.style.backgroundColor = region.color;
          label.style.color = 'white';
          label.style.padding = '2px 6px';
          label.style.fontSize = '12px';
          label.style.fontFamily = 'Arial, sans-serif';
          label.style.whiteSpace = 'nowrap';
          highlight.appendChild(label);
        }
        
        overlay.appendChild(highlight);
      });
      
      document.body.appendChild(overlay);
    }, regions);
    
    // Take screenshot with overlay
    await page.screenshot({ path: outputPath, fullPage: true });
    
    // Remove overlay
    await page.evaluate(() => {
      const overlay = document.getElementById('visual-diff-overlay');
      if (overlay) {
        overlay.remove();
      }
    });
  }
}