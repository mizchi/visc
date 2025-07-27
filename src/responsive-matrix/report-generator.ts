import { ResponsiveMatrixResult, ViewportTestResult } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

export class ResponsiveMatrixReportGenerator {
  /**
   * HTML形式のレポートを生成
   */
  async generateHTMLReport(
    results: ResponsiveMatrixResult[],
    outputPath: string
  ): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Responsive Matrix Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      color: #333;
      margin-bottom: 30px;
    }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-value {
      font-size: 36px;
      font-weight: bold;
      margin: 10px 0;
    }
    .summary-label {
      color: #666;
      font-size: 14px;
    }
    .success { color: #22c55e; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    .url-section {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .viewport-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .viewport-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .viewport-header {
      background: #f9fafb;
      padding: 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    .viewport-name {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .viewport-size {
      color: #6b7280;
      font-size: 14px;
    }
    .viewport-content {
      padding: 15px;
    }
    .screenshot {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    .media-queries {
      margin-top: 15px;
    }
    .media-query-list {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }
    .media-query-item {
      background: #f3f4f6;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 5px;
      font-size: 13px;
      font-family: monospace;
    }
    .css-fingerprint {
      font-family: monospace;
      font-size: 12px;
      color: #6b7280;
      margin-top: 10px;
    }
    .consistency-section {
      margin-top: 30px;
      padding: 20px;
      background: #fef3c7;
      border-radius: 8px;
      border: 1px solid #fbbf24;
    }
    .consistency-item {
      margin-bottom: 15px;
      padding: 15px;
      background: white;
      border-radius: 4px;
    }
    .consistency-query {
      font-family: monospace;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .consistency-status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      margin-left: 10px;
    }
    .consistent {
      background: #d1fae5;
      color: #065f46;
    }
    .inconsistent {
      background: #fee2e2;
      color: #991b1b;
    }
    .viewport-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 10px;
    }
    .comparison-column h4 {
      font-size: 14px;
      margin-bottom: 5px;
      color: #4b5563;
    }
    .viewport-list {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .viewport-tag {
      background: #e5e7eb;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 12px;
    }
    .timestamp {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Responsive Matrix Test Report</h1>
    ${this.generateSummaryHTML(results)}
    ${results.map(result => this.generateURLResultHTML(result)).join('')}
  </div>
</body>
</html>`;
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, html);
  }
  
  /**
   * サマリーセクションのHTML生成
   */
  private generateSummaryHTML(results: ResponsiveMatrixResult[]): string {
    const totalUrls = results.length;
    const passedUrls = results.filter(r => r.passed).length;
    const totalViewports = results.reduce((sum, r) => sum + r.summary.totalViewports, 0);
    const totalIssues = results.reduce((sum, r) => 
      sum + r.summary.failedViewports + r.summary.mediaQueryIssues + r.summary.layoutInconsistencies, 0
    );
    
    return `
    <div class="summary">
      <h2>Overall Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value ${passedUrls === totalUrls ? 'success' : 'error'}">
            ${passedUrls}/${totalUrls}
          </div>
          <div class="summary-label">URLs Passed</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${totalViewports}</div>
          <div class="summary-label">Total Viewports Tested</div>
        </div>
        <div class="summary-item">
          <div class="summary-value ${totalIssues === 0 ? 'success' : 'warning'}">
            ${totalIssues}
          </div>
          <div class="summary-label">Total Issues Found</div>
        </div>
      </div>
    </div>`;
  }
  
  /**
   * URL結果のHTML生成
   */
  private generateURLResultHTML(result: ResponsiveMatrixResult): string {
    const statusClass = result.passed ? 'success' : 'error';
    const statusText = result.passed ? '✓ Passed' : '✗ Failed';
    
    return `
    <div class="url-section">
      <h2>
        ${result.url.name} 
        <span class="${statusClass}" style="font-size: 18px; margin-left: 10px;">
          ${statusText}
        </span>
      </h2>
      <div class="timestamp">Tested at: ${new Date(result.timestamp).toLocaleString()}</div>
      
      <h3>Viewport Results</h3>
      <div class="viewport-grid">
        ${result.viewportResults.map(vr => this.generateViewportCardHTML(vr)).join('')}
      </div>
      
      ${this.generateConsistencySection(result)}
    </div>`;
  }
  
  /**
   * ビューポートカードのHTML生成
   */
  private generateViewportCardHTML(result: ViewportTestResult): string {
    const hasError = !!result.error;
    const statusClass = hasError ? 'error' : 'success';
    
    return `
    <div class="viewport-card">
      <div class="viewport-header">
        <div class="viewport-name">
          ${result.viewport.name}
          <span class="${statusClass}" style="float: right;">
            ${hasError ? '✗' : '✓'}
          </span>
        </div>
        <div class="viewport-size">
          ${result.viewport.width}×${result.viewport.height}px
          ${result.viewport.deviceScaleFactor ? `@${result.viewport.deviceScaleFactor}x` : ''}
        </div>
      </div>
      <div class="viewport-content">
        ${hasError ? `
          <div class="error">Error: ${result.error}</div>
        ` : `
          <img src="${path.basename(result.snapshotPath)}" alt="${result.viewport.name}" class="screenshot">
          
          <div class="media-queries">
            <strong>Applied Media Queries:</strong>
            ${result.appliedMediaQueries.length > 0 ? `
              <ul class="media-query-list">
                ${result.appliedMediaQueries.map(q => `
                  <li class="media-query-item">${this.escapeHtml(q)}</li>
                `).join('')}
              </ul>
            ` : '<div style="color: #6b7280; font-size: 14px;">None</div>'}
          </div>
          
          <div class="css-fingerprint">
            CSS Fingerprint: ${result.cssFingerprint}
          </div>
        `}
      </div>
    </div>`;
  }
  
  /**
   * 一貫性セクションのHTML生成
   */
  private generateConsistencySection(result: ResponsiveMatrixResult): string {
    const inconsistentQueries = result.mediaQueryConsistency.filter(m => !m.isConsistent);
    
    if (inconsistentQueries.length === 0 && result.summary.layoutInconsistencies === 0) {
      return '';
    }
    
    return `
    <div class="consistency-section">
      <h3>Consistency Issues</h3>
      
      ${inconsistentQueries.length > 0 ? `
        <h4>Media Query Inconsistencies</h4>
        ${inconsistentQueries.map(mq => `
          <div class="consistency-item">
            <div class="consistency-query">
              ${this.escapeHtml(mq.query)}
              <span class="consistency-status inconsistent">Inconsistent</span>
            </div>
            <div class="viewport-comparison">
              <div class="comparison-column">
                <h4>Expected Viewports:</h4>
                <div class="viewport-list">
                  ${mq.expectedViewports.map(v => `
                    <span class="viewport-tag">${v}</span>
                  `).join('')}
                </div>
              </div>
              <div class="comparison-column">
                <h4>Actual Viewports:</h4>
                <div class="viewport-list">
                  ${mq.actualViewports.map(v => `
                    <span class="viewport-tag">${v}</span>
                  `).join('')}
                </div>
              </div>
            </div>
            ${mq.inconsistencies ? `
              <div style="margin-top: 10px; color: #dc2626; font-size: 14px;">
                ${mq.inconsistencies.join('<br>')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      ` : ''}
      
      ${result.summary.layoutInconsistencies > 0 ? `
        <div style="margin-top: 20px; padding: 15px; background: white; border-radius: 4px;">
          <strong>Layout Inconsistencies:</strong>
          <span style="color: #dc2626; margin-left: 10px;">
            ${result.summary.layoutInconsistencies} layout changes detected between viewports
          </span>
        </div>
      ` : ''}
    </div>`;
  }
  
  /**
   * JSONレポートを生成
   */
  async generateJSONReport(
    results: ResponsiveMatrixResult[],
    outputPath: string
  ): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalUrls: results.length,
        passedUrls: results.filter(r => r.passed).length,
        failedUrls: results.filter(r => !r.passed).length,
        totalViewports: results.reduce((sum, r) => sum + r.summary.totalViewports, 0),
        totalIssues: results.reduce((sum, r) => 
          sum + r.summary.failedViewports + r.summary.mediaQueryIssues + r.summary.layoutInconsistencies, 0
        )
      },
      results: results.map(r => ({
        ...r,
        viewportResults: r.viewportResults.map(vr => ({
          ...vr,
          layoutStructure: undefined // 大きすぎるため除外
        }))
      }))
    };
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
  }
  
  /**
   * マークダウンレポートを生成
   */
  async generateMarkdownReport(
    results: ResponsiveMatrixResult[],
    outputPath: string
  ): Promise<void> {
    const lines: string[] = [
      '# Responsive Matrix Test Report',
      '',
      `Generated at: ${new Date().toISOString()}`,
      '',
      '## Summary',
      '',
      `- Total URLs tested: ${results.length}`,
      `- Passed: ${results.filter(r => r.passed).length}`,
      `- Failed: ${results.filter(r => !r.passed).length}`,
      '',
      '## Results by URL',
      ''
    ];
    
    for (const result of results) {
      lines.push(`### ${result.url.name} - ${result.passed ? '✅ Passed' : '❌ Failed'}`);
      lines.push('');
      lines.push('#### Viewport Results:');
      lines.push('');
      lines.push('| Viewport | Size | Status | Media Queries | CSS Fingerprint |');
      lines.push('|----------|------|--------|---------------|-----------------|');
      
      for (const vr of result.viewportResults) {
        const status = vr.error ? '❌' : '✅';
        const queries = vr.appliedMediaQueries.length || 'None';
        lines.push(
          `| ${vr.viewport.name} | ${vr.viewport.width}×${vr.viewport.height} | ${status} | ${queries} | ${vr.cssFingerprint.substring(0, 8)}... |`
        );
      }
      
      lines.push('');
      
      if (result.summary.mediaQueryIssues > 0) {
        lines.push('#### Media Query Issues:');
        lines.push('');
        
        const inconsistent = result.mediaQueryConsistency.filter(m => !m.isConsistent);
        for (const mq of inconsistent) {
          lines.push(`- **${mq.query}**`);
          lines.push(`  - Expected: ${mq.expectedViewports.join(', ')}`);
          lines.push(`  - Actual: ${mq.actualViewports.join(', ')}`);
          if (mq.inconsistencies) {
            lines.push(`  - Issues: ${mq.inconsistencies.join('; ')}`);
          }
        }
        
        lines.push('');
      }
    }
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, lines.join('\n'));
  }
  
  /**
   * HTMLエスケープ
   */
  private escapeHtml(str: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    
    return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
  }
}