import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ResponsiveMatrixReportGenerator } from '../../src/responsive-matrix/report-generator.js';
import { ResponsiveMatrixResult } from '../../src/types.js';
import fs from 'fs/promises';
import path from 'path';

describe('ResponsiveMatrixReportGenerator', () => {
  const generator = new ResponsiveMatrixReportGenerator();
  const testOutputDir = './test-reports';
  
  const mockResult: ResponsiveMatrixResult = {
    url: {
      name: 'test-page',
      url: 'https://example.com'
    },
    timestamp: new Date().toISOString(),
    viewportResults: [
      {
        viewport: { name: 'mobile', width: 375, height: 667 },
        snapshotPath: '/snapshots/test-mobile.png',
        appliedMediaQueries: ['(max-width: 767px)'],
        cssFingerprint: 'abc123',
        layoutStructure: { elements: [] }
      },
      {
        viewport: { name: 'desktop', width: 1920, height: 1080 },
        snapshotPath: '/snapshots/test-desktop.png',
        appliedMediaQueries: ['(min-width: 1024px)'],
        cssFingerprint: 'def456',
        layoutStructure: { elements: [] }
      }
    ],
    mediaQueryConsistency: [
      {
        query: '(max-width: 767px)',
        expectedViewports: ['mobile'],
        actualViewports: ['mobile'],
        isConsistent: true
      },
      {
        query: '(min-width: 768px) and (max-width: 1023px)',
        expectedViewports: ['tablet'],
        actualViewports: [],
        isConsistent: false,
        inconsistencies: ['Missing in: tablet']
      }
    ],
    passed: false,
    summary: {
      totalViewports: 2,
      passedViewports: 2,
      failedViewports: 0,
      mediaQueryIssues: 1,
      layoutInconsistencies: 0
    }
  };
  
  beforeAll(async () => {
    await fs.mkdir(testOutputDir, { recursive: true });
  });
  
  afterAll(async () => {
    await fs.rm(testOutputDir, { recursive: true, force: true });
  });
  
  it('should generate HTML report', async () => {
    const outputPath = path.join(testOutputDir, 'test-report.html');
    await generator.generateHTMLReport([mockResult], outputPath);
    
    const content = await fs.readFile(outputPath, 'utf-8');
    
    // HTMLの基本構造を確認
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<title>Responsive Matrix Test Report</title>');
    
    // テスト結果が含まれていることを確認
    expect(content).toContain('test-page');
    expect(content).toContain('mobile');
    expect(content).toContain('desktop');
    expect(content).toContain('(max-width: 767px)');
    
    // サマリー情報を確認
    expect(content).toContain('Overall Summary');
    expect(content).toContain('URLs Passed');
    
    // メディアクエリの不整合が表示されていることを確認
    expect(content).toContain('Media Query Inconsistencies');
    expect(content).toContain('Missing in: tablet');
  });
  
  it('should generate JSON report', async () => {
    const outputPath = path.join(testOutputDir, 'test-report.json');
    await generator.generateJSONReport([mockResult], outputPath);
    
    const content = await fs.readFile(outputPath, 'utf-8');
    const report = JSON.parse(content);
    
    // JSONレポートの構造を確認
    expect(report.timestamp).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.results).toHaveLength(1);
    
    // サマリー情報を確認
    expect(report.summary.totalUrls).toBe(1);
    expect(report.summary.passedUrls).toBe(0);
    expect(report.summary.totalViewports).toBe(2);
    expect(report.summary.totalIssues).toBe(1);
    
    // レイアウト構造が除外されていることを確認
    expect(report.results[0].viewportResults[0].layoutStructure).toBeUndefined();
  });
  
  it('should generate Markdown report', async () => {
    const outputPath = path.join(testOutputDir, 'test-report.md');
    await generator.generateMarkdownReport([mockResult], outputPath);
    
    const content = await fs.readFile(outputPath, 'utf-8');
    
    // Markdownの基本構造を確認
    expect(content).toContain('# Responsive Matrix Test Report');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Results by URL');
    
    // テーブルが含まれていることを確認
    expect(content).toContain('| Viewport | Size | Status | Media Queries | CSS Fingerprint |');
    expect(content).toContain('| mobile | 375×667 |');
    expect(content).toContain('| desktop | 1920×1080 |');
    
    // メディアクエリの問題が記載されていることを確認
    expect(content).toContain('#### Media Query Issues:');
    expect(content).toContain('Missing in: tablet');
  });
  
  it('should handle multiple URL results', async () => {
    const multipleResults = [
      mockResult,
      {
        ...mockResult,
        url: { name: 'another-page', url: 'https://example.com/another' },
        passed: true,
        summary: {
          ...mockResult.summary,
          mediaQueryIssues: 0
        }
      }
    ];
    
    const outputPath = path.join(testOutputDir, 'multi-report.html');
    await generator.generateHTMLReport(multipleResults, outputPath);
    
    const content = await fs.readFile(outputPath, 'utf-8');
    
    // 両方のURLが含まれていることを確認
    expect(content).toContain('test-page');
    expect(content).toContain('another-page');
    
    // それぞれのステータスが正しく表示されていることを確認
    expect(content).toContain('✗ Failed');
    expect(content).toContain('✓ Passed');
  });
  
  it('should escape HTML in media queries', async () => {
    const resultWithHtml: ResponsiveMatrixResult = {
      ...mockResult,
      viewportResults: [
        {
          viewport: { name: 'mobile', width: 375, height: 667 },
          snapshotPath: '/snapshots/test-mobile.png',
          appliedMediaQueries: ['(min-width: <script>alert("xss")</script>px)'],
          cssFingerprint: 'abc123',
          layoutStructure: { elements: [] }
        }
      ],
      mediaQueryConsistency: [
        {
          query: '(min-width: <script>alert("xss")</script>px)',
          expectedViewports: ['all'],
          actualViewports: ['mobile'],
          isConsistent: false,
          inconsistencies: ['XSS test']
        }
      ],
      summary: {
        ...mockResult.summary,
        mediaQueryIssues: 1
      }
    };
    
    const outputPath = path.join(testOutputDir, 'escaped-report.html');
    await generator.generateHTMLReport([resultWithHtml], outputPath);
    
    const content = await fs.readFile(outputPath, 'utf-8');
    
    // HTMLがエスケープされていることを確認
    expect(content).not.toContain('<script>alert("xss")</script>');
    expect(content).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});