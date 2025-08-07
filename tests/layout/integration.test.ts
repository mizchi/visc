import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
  detectFlakiness,
  generateFlakinessReport,
} from '../../src/layout/flakiness-detector';
import {
  compareLayoutTrees,
} from '../../src/layout/comparator';
import {
  calibrateComparisonSettings,
} from '../../src/layout/calibrator';
import type { VisualTreeAnalysis } from '../../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../fixtures/layout-data');

async function loadFixture(filename: string): Promise<{
  description: string;
  samples: VisualTreeAnalysis[];
  expectedAnalysis?: any;
}> {
  const content = await readFile(join(fixturesDir, filename), 'utf-8');
  return JSON.parse(content);
}

describe('Layout Integration Tests', () => {
  describe('Stable Layout', () => {
    it('should detect no flakiness in stable layout', async () => {
      const { samples } = await loadFixture('stable-layout.json');
      
      const analysis = detectFlakiness(samples);
      
      expect(analysis.overallScore).toBe(0);
      expect(analysis.flakyElements).toHaveLength(0);
      expect(analysis.stableCount).toBeGreaterThan(0);
      expect(analysis.unstableCount).toBe(0);
    });

    it('should generate optimal calibration for stable layout', async () => {
      const { samples } = await loadFixture('stable-layout.json');
      
      const calibration = calibrateComparisonSettings(samples);
      
      // 99%以上の信頼度があれば完全に安定とみなす
      expect(calibration.confidence).toBeGreaterThanOrEqual(99);
      expect(calibration.settings.positionTolerance).toBeLessThanOrEqual(2);
      expect(calibration.settings.sizeTolerance).toBeLessThanOrEqual(2);
    });

    it('should compare identical layouts as 100% similar', async () => {
      const { samples } = await loadFixture('stable-layout.json');
      
      const comparison = compareLayoutTrees(samples[0], samples[1]);
      
      expect(comparison.similarity).toBe(100);
      expect(comparison.differences).toHaveLength(0);
    });
  });

  describe('Position Flaky Layout', () => {
    it('should detect position flakiness', async () => {
      const { samples, expectedAnalysis } = await loadFixture('position-flaky.json');
      
      const analysis = detectFlakiness(samples);
      
      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.flakyElements.length).toBeGreaterThan(0);
      
      // Check if the floating button is detected as flaky
      const flakyButton = analysis.flakyElements.find(el => 
        el.identifier.className === 'floating-btn' || 
        el.elementId.includes('floating-btn')
      );
      expect(flakyButton).toBeDefined();
      
      if (flakyButton) {
        expect(['position', 'mixed']).toContain(flakyButton.flakinessType);
      }
    });

    it('should calibrate with appropriate position tolerance', async () => {
      const { samples, expectedAnalysis } = await loadFixture('position-flaky.json');
      
      const calibration = calibrateComparisonSettings(samples);
      
      // Should suggest tolerance that covers the position variations
      expect(calibration.settings.positionTolerance).toBeGreaterThanOrEqual(
        expectedAnalysis.maxPositionDiff
      );
      expect(calibration.settings.positionTolerance).toBeLessThanOrEqual(
        expectedAnalysis.suggestedTolerance + 2
      );
      expect(calibration.confidence).toBeLessThan(100);
    });

    it('should detect position changes in comparison', async () => {
      const { samples } = await loadFixture('position-flaky.json');
      
      const comparison = compareLayoutTrees(samples[0], samples[1], {
        threshold: 1 // Strict threshold to detect small movements
      });
      
      expect(comparison.similarity).toBeLessThan(100);
      expect(comparison.differences.length).toBeGreaterThan(0);
      
      const buttonDiff = comparison.differences.find(diff => 
        diff.element?.className === 'floating-btn'
      );
      expect(buttonDiff).toBeDefined();
      expect(buttonDiff?.positionDiff).toBeGreaterThan(0);
    });
  });

  describe('Dynamic Content Layout', () => {
    it('should detect content and existence flakiness', async () => {
      const { samples, expectedAnalysis } = await loadFixture('dynamic-content.json');
      
      const analysis = detectFlakiness(samples);
      
      expect(analysis.overallScore).toBeGreaterThan(0);
      expect(analysis.flakyElements.length).toBeGreaterThanOrEqual(2);
      
      // Check timestamp element (content change)
      const timestampElement = analysis.flakyElements.find(el =>
        el.identifier.className === 'timestamp' ||
        el.elementId.includes('timestamp')
      );
      expect(timestampElement).toBeDefined();
      
      // Check notification element (appears/disappears)
      const notificationElement = analysis.flakyElements.find(el =>
        el.identifier.className === 'notification' ||
        el.elementId.includes('notification')
      );
      expect(notificationElement).toBeDefined();
      
      // Check categorization
      if (analysis.categorizedFlakiness.content.length > 0 || 
          analysis.categorizedFlakiness.existence.length > 0) {
        expect(
          analysis.categorizedFlakiness.content.length +
          analysis.categorizedFlakiness.existence.length
        ).toBeGreaterThanOrEqual(1);
      }
    });

    it('should suggest ignoring dynamic text in calibration', async () => {
      const { samples } = await loadFixture('dynamic-content.json');
      
      const calibration = calibrateComparisonSettings(samples);
      
      // When text changes frequently, should suggest ignoring it
      // or have lower confidence
      expect(calibration.confidence).toBeLessThan(100);
      
      // Check if calibration detects the dynamic nature
      // Text handling is now controlled by textSimilarityThreshold
      // Lower threshold means text differences are less important
      expect(calibration.settings.textSimilarityThreshold).toBeLessThan(100);
    });

    it('should handle appearing/disappearing elements in comparison', async () => {
      const { samples } = await loadFixture('dynamic-content.json');
      
      // Compare sample 0 (with notification) to sample 1 (without notification)
      const comparison = compareLayoutTrees(samples[0], samples[1]);
      
      expect(comparison.similarity).toBeLessThan(100);
      expect(comparison.differences.length).toBeGreaterThan(0);
      
      // Should detect the notification as removed
      const removedNotification = comparison.differences.find(diff =>
        diff.type === 'removed' &&
        diff.element?.className === 'notification'
      );
      expect(removedNotification).toBeDefined();
      
      // Should detect text change in timestamp
      const textChange = comparison.differences.find(diff =>
        diff.element?.className === 'timestamp' &&
        (diff.type === 'modified' || diff.type === 'text')
      );
      expect(textChange).toBeDefined();
    });
  });

  describe('Cross-module Integration', () => {
    it('should use calibration results for comparison validation', async () => {
      const { samples } = await loadFixture('position-flaky.json');
      
      // First calibrate to get optimal settings
      const calibration = calibrateComparisonSettings(samples);
      
      // Then use calibrated settings for comparison
      const comparison = compareLayoutTrees(samples[0], samples[1], {
        threshold: calibration.settings.positionTolerance
      });
      
      // With calibrated threshold, minor position changes should be tolerated
      if (calibration.settings.positionTolerance >= 2) {
        // The position difference is 2px, so if tolerance is >= 2, should be similar
        expect(comparison.similarity).toBeGreaterThanOrEqual(95);
      }
    });

    it('should generate meaningful flakiness report', async () => {
      const { samples } = await loadFixture('dynamic-content.json');
      
      const analysis = detectFlakiness(samples);
      const report = generateFlakinessReport(analysis);
      
      expect(report).toContain('フレーキーネス分析レポート');
      expect(report).toContain(analysis.overallScore.toFixed(1));
      expect(report).toContain(`サンプル数: ${analysis.sampleCount}`);
      
      // Should list flaky elements
      if (analysis.flakyElements.length > 0) {
        expect(report).toContain('不安定な要素');
      }
    });
  });
});