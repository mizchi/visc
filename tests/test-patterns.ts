#!/usr/bin/env node
/**
 * Test script for visual regression patterns
 * Analyzes different types of changes and generates insights
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import {
  captureLayout,
  compareLayouts,
  type Viewport as WorkflowViewport,
  type TestCase,
  type ComparisonResult,
} from '../src/workflow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configurations
const TEST_CASES = [
  {
    name: 'Text Changes',
    baseline: 'baseline/basic-layout.html',
    changed: 'changed/basic-layout-text-change.html',
    description: 'Tests detection of text content changes while layout remains the same',
    expectedChanges: [
      'Text content modifications in headers and paragraphs',
      'Link text updates',
      'Version number changes',
    ]
  },
  {
    name: 'Style Changes',
    baseline: 'baseline/basic-layout.html',
    changed: 'changed/basic-layout-style-change.html',
    description: 'Tests detection of CSS style changes without structural modifications',
    expectedChanges: [
      'Color changes (backgrounds, text)',
      'Spacing changes (padding, margin)',
      'Border and shadow additions',
      'Font size and weight changes',
    ]
  },
  {
    name: 'Structure Changes',
    baseline: 'baseline/basic-layout.html',
    changed: 'changed/basic-layout-structure-change.html',
    description: 'Tests detection of DOM structure changes (additions/removals)',
    expectedChanges: [
      'New sections added (alert banner, featured content)',
      'Elements removed (services section)',
      'New components (newsletter signup, tags)',
      'Additional navigation items',
    ]
  },
  {
    name: 'Position Shifts',
    baseline: 'patterns/position-shift.html',
    changed: 'patterns/position-shift.html', // Same file to test shift detection
    description: 'Tests detection of subtle position shifts and alignment issues',
    expectedChanges: [
      '1px, 3px, and 5px position shifts',
      'Float layout collapse issues',
      'Flexbox alignment problems',
      'Margin collapse detection',
      'Subpixel rendering differences',
    ]
  },
  {
    name: 'Z-Index Changes',
    baseline: 'patterns/z-index-changes.html',
    changed: 'patterns/z-index-changes.html', // Same file to test stacking order
    description: 'Tests detection of z-index and stacking context changes',
    expectedChanges: [
      'Stacking order changes',
      'Modal visibility changes',
      'Nested stacking context issues',
      'Transform/opacity stacking contexts',
      'Negative z-index patterns',
    ]
  },
  {
    name: 'Overflow Patterns',
    baseline: 'patterns/overflow-scroll.html',
    changed: 'patterns/overflow-scroll.html', // Same file for overflow analysis
    description: 'Tests detection of overflow and scroll behaviors',
    expectedChanges: [
      'Vertical scroll containers',
      'Horizontal scroll detection',
      'Hidden overflow clipping',
      'Fixed vs responsive dimensions',
      'Table scroll patterns',
    ]
  },
];

const VIEWPORTS: Record<string, WorkflowViewport> = {
  desktop: {
    name: 'Desktop',
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  tablet: {
    name: 'Tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  },
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15'
  }
};

interface TestResult {
  testName: string;
  viewport: string;
  summary: {
    similarity: number;
    hasIssues: boolean;
    addedElements: number;
    removedElements: number;
    modifiedElements: number;
    addedGroups: number;
    removedGroups: number;
    modifiedGroups: number;
  };
  insights: string[];
  selectors: {
    added: string[];
    removed: string[];
    modified: string[];
  };
  overflowAnalysis?: {
    scrollableElements: number;
    fixedDimensions: number;
    responsiveDimensions: number;
  };
}

async function runTest(testCase: any, viewport: WorkflowViewport, viewportKey: string, browser: any): Promise<TestResult> {
  const page = await browser.newPage();
  
  try {
    // Capture baseline
    const baselinePath = `file://${path.join(__dirname, 'fixtures', testCase.baseline)}`;
    const baselineLayout = await captureLayout(page, baselinePath, viewport);
    
    // Capture changed version
    const changedPath = `file://${path.join(__dirname, 'fixtures', testCase.changed)}`;
    const changedLayout = await captureLayout(page, changedPath, viewport);
    
    // Create test case for comparison
    const testCaseObj: TestCase = {
      id: testCase.name,
      url: baselinePath,
      description: testCase.description
    };
    
    // Setup layout maps for comparison
    const currentLayouts = new Map<string, Map<string, any>>();
    const previousLayouts = new Map<string, Map<string, any>>();
    
    const currentTestLayouts = new Map<string, any>();
    currentTestLayouts.set(viewportKey, changedLayout);
    currentLayouts.set(testCaseObj.id, currentTestLayouts);
    
    const previousTestLayouts = new Map<string, any>();
    previousTestLayouts.set(viewportKey, baselineLayout);
    previousLayouts.set(testCaseObj.id, previousTestLayouts);
    
    // Compare layouts using the AsyncGenerator API
    let comparison: ComparisonResult | undefined;
    const generator = compareLayouts(
      [testCaseObj],
      { [viewportKey]: viewport },
      currentLayouts,
      previousLayouts,
      {
        useVisualGroups: true,
        similarityThreshold: 90
      }
    );
    
    for await (const result of generator) {
      // We're looking for ComparisonResult, not TestResult
      if ('comparison' in result) {
        comparison = result as ComparisonResult;
        break;
      }
    }
    
    if (!comparison) {
      throw new Error('No comparison result generated');
    }
    
    // Generate insights
    const insights: string[] = [];
    const selectors = {
      added: [] as string[],
      removed: [] as string[],
      modified: [] as string[]
    };
    
    // Analyze added elements
    if (comparison.comparison.raw.addedGroups?.length > 0) {
      insights.push(`${comparison.comparison.raw.addedGroups.length} new visual groups detected`);
      comparison.comparison.raw.addedGroups.forEach((group: any) => {
        const selector = generateSelector(group);
        if (selector) selectors.added.push(selector);
      });
    }
    
    // Analyze removed elements
    if (comparison.comparison.raw.removedGroups?.length > 0) {
      insights.push(`${comparison.comparison.raw.removedGroups.length} visual groups removed`);
      comparison.comparison.raw.removedGroups.forEach((group: any) => {
        const selector = generateSelector(group);
        if (selector) selectors.removed.push(selector);
      });
    }
    
    // Analyze modifications
    if (comparison.comparison.raw.differences?.length > 0) {
      const positionChanges = comparison.comparison.raw.differences.filter((d: any) => 
        d.type === 'moved' || (d.positionDiff && d.positionDiff > 5)
      ).length;
      
      const sizeChanges = comparison.comparison.raw.differences.filter((d: any) => 
        d.type === 'resized' || (d.sizeDiff && d.sizeDiff > 5)
      ).length;
      
      const contentChanges = comparison.comparison.raw.differences.filter((d: any) => 
        d.type === 'modified' && d.similarity < 95
      ).length;
      
      if (positionChanges > 0) insights.push(`${positionChanges} elements moved`);
      if (sizeChanges > 0) insights.push(`${sizeChanges} elements resized`);
      if (contentChanges > 0) insights.push(`${contentChanges} elements with content changes`);
      
      comparison.comparison.raw.differences.forEach((diff: any) => {
        const selector = generateSelector(diff.group || diff.element);
        if (selector && !selectors.modified.includes(selector)) {
          selectors.modified.push(selector);
        }
      });
    }
    
    // Analyze overflow and dimensions
    const overflowAnalysis = analyzeOverflow(changedLayout);
    if (overflowAnalysis.scrollableElements > 0) {
      insights.push(`${overflowAnalysis.scrollableElements} scrollable containers detected`);
    }
    if (overflowAnalysis.fixedDimensions > 0) {
      insights.push(`${overflowAnalysis.fixedDimensions} elements with fixed dimensions`);
    }
    
    // Generate severity assessment
    const severity = assessSeverity(comparison.comparison);
    insights.push(`Overall change severity: ${severity}`);
    
    return {
      testName: testCase.name,
      viewport: viewport.name,
      summary: {
        similarity: comparison.comparison.similarity,
        hasIssues: comparison.comparison.hasIssues,
        addedElements: comparison.comparison.addedElements,
        removedElements: comparison.comparison.removedElements,
        modifiedElements: comparison.comparison.differences,
        addedGroups: comparison.comparison.raw.addedGroups?.length || 0,
        removedGroups: comparison.comparison.raw.removedGroups?.length || 0,
        modifiedGroups: comparison.comparison.raw.differences?.length || 0,
      },
      insights,
      selectors,
      overflowAnalysis
    };
  } finally {
    await page.close();
  }
}

function generateSelector(node: any): string | undefined {
  if (!node) return undefined;
  
  const parts: string[] = [];
  
  if (node.tagName) {
    parts.push(node.tagName.toLowerCase());
  }
  
  if (node.id) {
    parts.push(`#${node.id}`);
  } else if (node.className && typeof node.className === 'string') {
    const classes = node.className.split(' ').filter((c: string) => c);
    if (classes.length > 0) {
      parts.push(`.${classes[0]}`);
    }
  }
  
  // For groups, try to get selector from first child
  if (!parts.length && node.children && node.children.length > 0) {
    return generateSelector(node.children[0]);
  }
  
  return parts.length > 0 ? parts.join('') : undefined;
}

function analyzeOverflow(layout: any): any {
  let scrollableElements = 0;
  let fixedDimensions = 0;
  let responsiveDimensions = 0;
  
  layout.elements.forEach((element: any) => {
    if (element.isScrollable) {
      scrollableElements++;
    }
    
    if (element.hasFixedDimensions) {
      if (element.hasFixedDimensions.width && element.hasFixedDimensions.height) {
        fixedDimensions++;
      } else {
        responsiveDimensions++;
      }
    }
  });
  
  return {
    scrollableElements,
    fixedDimensions,
    responsiveDimensions
  };
}

function assessSeverity(comparison: any): string {
  const score = comparison.similarity;
  
  if (score >= 98) return 'Minimal';
  if (score >= 95) return 'Low';
  if (score >= 90) return 'Medium';
  if (score >= 80) return 'High';
  return 'Critical';
}

// Visual difference detection assertions
function detectVisualDifferences(result: TestResult): {
  hasPositionShifts: boolean;
  hasZIndexChanges: boolean;
  hasOverflowIssues: boolean;
  hasLayoutShifts: boolean;
  detectedPatterns: string[];
} {
  const patterns: string[] = [];
  
  // Detect position shifts (even 1px matters)
  const hasPositionShifts = result.insights.some(insight => 
    insight.includes('moved') || 
    insight.includes('shift') ||
    insight.includes('position')
  );
  
  if (hasPositionShifts) {
    // Analyze shift magnitude
    const shiftMagnitudes = result.insights
      .filter(i => i.match(/[0-9]+px/))
      .map(i => {
        const match = i.match(/([0-9]+)px/);
        return match ? parseInt(match[1]) : 0;
      });
    
    if (shiftMagnitudes.some(m => m === 1)) patterns.push('1px微細シフト検出');
    if (shiftMagnitudes.some(m => m > 1 && m <= 5)) patterns.push('小規模位置ずれ(2-5px)');
    if (shiftMagnitudes.some(m => m > 5)) patterns.push('大規模位置ずれ(>5px)');
  }
  
  // Detect z-index/stacking changes
  const hasZIndexChanges = result.insights.some(insight =>
    insight.includes('layer') ||
    insight.includes('z-index') ||
    insight.includes('stacking') ||
    insight.includes('overlap')
  );
  
  if (hasZIndexChanges) {
    patterns.push('重なり順序の変更');
  }
  
  // Detect overflow issues
  const hasOverflowIssues = result.overflowAnalysis ? 
    result.overflowAnalysis.scrollableElements > 0 ||
    result.insights.some(i => i.includes('scroll') || i.includes('overflow')) : false;
  
  if (hasOverflowIssues && result.overflowAnalysis) {
    if (result.overflowAnalysis.scrollableElements > 0) {
      patterns.push(`スクロール要素検出(${result.overflowAnalysis.scrollableElements}個)`);
    }
    if (result.overflowAnalysis.fixedDimensions > 0) {
      patterns.push('固定サイズ要素による潜在的オーバーフロー');
    }
  }
  
  // Detect layout shifts
  const hasLayoutShifts = 
    result.summary.addedGroups > 0 ||
    result.summary.removedGroups > 0 ||
    result.summary.modifiedGroups > 3; // More than 3 modifications indicates layout shift
  
  if (hasLayoutShifts) {
    if (result.summary.addedGroups > 0) patterns.push(`要素追加(${result.summary.addedGroups}グループ)`);
    if (result.summary.removedGroups > 0) patterns.push(`要素削除(${result.summary.removedGroups}グループ)`);
    if (result.summary.modifiedGroups > 3) patterns.push('大規模レイアウト変更');
  }
  
  return {
    hasPositionShifts,
    hasZIndexChanges,
    hasOverflowIssues,
    hasLayoutShifts,
    detectedPatterns: patterns
  };
}

// Semantic difference message generator
function generateSemanticMessage(detection: ReturnType<typeof detectVisualDifferences>): string {
  const messages: string[] = [];
  
  if (detection.hasPositionShifts) {
    messages.push('⚠️ 位置ずれを検出しました');
  }
  
  if (detection.hasZIndexChanges) {
    messages.push('🔄 要素の重なり順序が変更されています');
  }
  
  if (detection.hasOverflowIssues) {
    messages.push('📜 スクロール/オーバーフロー問題の可能性');
  }
  
  if (detection.hasLayoutShifts) {
    messages.push('🏗️ レイアウト構造に変更があります');
  }
  
  if (detection.detectedPatterns.length > 0) {
    messages.push('\n検出パターン:');
    detection.detectedPatterns.forEach(p => {
      messages.push(`  • ${p}`);
    });
  }
  
  return messages.length > 0 ? messages.join('\n') : '✅ 重要な視覚的変更は検出されませんでした';
}

async function generateReport(results: TestResult[]): Promise<string> {
  const report: string[] = [];
  
  report.push('# Visual Regression Test Pattern Analysis');
  report.push('');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push('');
  
  // Group results by test case
  const testGroups = new Map<string, TestResult[]>();
  results.forEach(result => {
    if (!testGroups.has(result.testName)) {
      testGroups.set(result.testName, []);
    }
    testGroups.get(result.testName)!.push(result);
  });
  
  // Generate report for each test case
  for (const [testName, testResults] of testGroups) {
    report.push(`## ${testName}`);
    report.push('');
    
    const testCase = TEST_CASES.find(tc => tc.name === testName);
    if (testCase) {
      report.push(`**Description:** ${testCase.description}`);
      report.push('');
      report.push('**Expected Changes:**');
      testCase.expectedChanges.forEach(change => {
        report.push(`- ${change}`);
      });
      report.push('');
    }
    
    report.push('### Results by Viewport');
    report.push('');
    
    testResults.forEach(result => {
      report.push(`#### ${result.viewport}`);
      report.push('');
      report.push(`- **Similarity:** ${result.summary.similarity.toFixed(1)}%`);
      report.push(`- **Has Issues:** ${result.summary.hasIssues ? 'Yes' : 'No'}`);
      report.push('');
      
      // Add semantic difference detection
      const detection = detectVisualDifferences(result);
      const semanticMessage = generateSemanticMessage(detection);
      report.push('**意味的差分検出:**');
      report.push(semanticMessage);
      report.push('');
      
      if (result.summary.addedGroups > 0 || result.summary.removedGroups > 0 || result.summary.modifiedGroups > 0) {
        report.push('**Visual Group Changes:**');
        if (result.summary.addedGroups > 0) {
          report.push(`- Added: ${result.summary.addedGroups} groups`);
        }
        if (result.summary.removedGroups > 0) {
          report.push(`- Removed: ${result.summary.removedGroups} groups`);
        }
        if (result.summary.modifiedGroups > 0) {
          report.push(`- Modified: ${result.summary.modifiedGroups} groups`);
        }
        report.push('');
      }
      
      if (result.insights.length > 0) {
        report.push('**Insights:**');
        result.insights.forEach(insight => {
          report.push(`- ${insight}`);
        });
        report.push('');
      }
      
      if (result.selectors.added.length > 0) {
        report.push('**Added Elements (Sample Selectors):**');
        result.selectors.added.slice(0, 5).forEach(selector => {
          report.push(`- \`${selector}\``);
        });
        if (result.selectors.added.length > 5) {
          report.push(`- ... and ${result.selectors.added.length - 5} more`);
        }
        report.push('');
      }
      
      if (result.selectors.removed.length > 0) {
        report.push('**Removed Elements (Sample Selectors):**');
        result.selectors.removed.slice(0, 5).forEach(selector => {
          report.push(`- \`${selector}\``);
        });
        if (result.selectors.removed.length > 5) {
          report.push(`- ... and ${result.selectors.removed.length - 5} more`);
        }
        report.push('');
      }
      
      if (result.selectors.modified.length > 0) {
        report.push('**Modified Elements (Sample Selectors):**');
        result.selectors.modified.slice(0, 5).forEach(selector => {
          report.push(`- \`${selector}\``);
        });
        if (result.selectors.modified.length > 5) {
          report.push(`- ... and ${result.selectors.modified.length - 5} more`);
        }
        report.push('');
      }
      
      if (result.overflowAnalysis) {
        report.push('**Layout Analysis:**');
        report.push(`- Scrollable containers: ${result.overflowAnalysis.scrollableElements}`);
        report.push(`- Fixed dimension elements: ${result.overflowAnalysis.fixedDimensions}`);
        report.push(`- Responsive elements: ${result.overflowAnalysis.responsiveDimensions}`);
        report.push('');
      }
    });
    
    report.push('---');
    report.push('');
  }
  
  return report.join('\n');
}

// Main execution
async function main() {
  console.log('🚀 Starting Visual Regression Pattern Tests');
  console.log('');
  
  const results: TestResult[] = [];
  const totalTests = TEST_CASES.length * Object.keys(VIEWPORTS).length;
  let completed = 0;
  
  // Launch browser once for all tests
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    for (const testCase of TEST_CASES) {
      console.log(`📋 Testing: ${testCase.name}`);
      
      for (const [viewportKey, viewport] of Object.entries(VIEWPORTS)) {
        process.stdout.write(`  - ${viewport.name}... `);
        
        try {
          const result = await runTest(testCase, viewport, viewportKey, browser);
          results.push(result);
          
          const status = result.summary.hasIssues ? '⚠️' : '✅';
          console.log(`${status} (${result.summary.similarity.toFixed(1)}% similar)`);
          
          completed++;
        } catch (error) {
          console.log(`❌ Error: ${error}`);
          completed++;
        }
      }
      
      console.log('');
    }
  
    // Generate and save report
    console.log('📝 Generating analysis report...');
    const report = await generateReport(results);
    
    const reportPath = path.join(__dirname, 'test-results', 'pattern-analysis.md');
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report);
    
    console.log(`✅ Report saved to: ${reportPath}`);
    console.log('');
    console.log('📊 Summary:');
    console.log(`  - Total tests: ${totalTests}`);
    console.log(`  - Completed: ${completed}`);
    console.log(`  - Tests with issues: ${results.filter(r => r.summary.hasIssues).length}`);
  } finally {
    await browser.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${__filename}`) {
  main().catch(console.error);
}

export { runTest, generateReport, TEST_CASES, VIEWPORTS };