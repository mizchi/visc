/**
 * visc library basic usage examples
 */

import {
  // Core functions
  fetchRawLayoutData,
  extractLayoutTree,
  compareLayoutTrees,
  
  // Rendering
  renderLayoutToSvg,
  renderComparisonToSvg,
  
  // Calibration
  calibrateComparisonSettings,
  validateWithSettings,
  
  // Utilities
  getVisualNodeGroupStatistics,
  compareFlattenedGroups,
  generateChangeSummary,
} from '@mizchi/visc';
import puppeteer from 'puppeteer';

async function basicExample() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Fetch raw layout data from a page
    await page.goto('https://example.com', { waitUntil: 'networkidle0' });
    const rawData = await fetchRawLayoutData(page);
    
    // 2. Extract structured layout tree
    const layout = extractLayoutTree(rawData, {
      viewportOnly: true, // Only include viewport elements
      groupingThreshold: 20,
      importanceThreshold: 10,
    });
    
    console.log(`Found ${layout.elements.length} elements`);
    console.log(`Organized into ${layout.visualNodeGroups?.length || 0} visual groups`);
    
    // 3. Generate SVG visualization
    const svg = renderLayoutToSvg(layout, {
      showLabels: true,
      ignoreElements: ['.ads', '.cookie-banner'],
    });
    // Save svg to file or display...
    
    // 4. Compare two layouts
    const layout2 = extractLayoutTree(rawData); // Second sample
    const comparison = compareLayoutTrees(layout, layout2, {
      threshold: 2, // Position change threshold in pixels
      ignoreText: false,
      ignoreElements: ['.timestamp', '.dynamic-content'],
    });
    
    console.log(`Similarity: ${comparison.similarity}%`);
    console.log(`Changes: ${comparison.differences.length}`);
    
    // 5. Render comparison as SVG
    const diffSvg = renderComparisonToSvg(comparison, layout, layout2, {
      showUnchanged: true,
      highlightLevel: 'moderate',
    });
    
    // 6. Calibrate settings from multiple samples
    const samples = [];
    for (let i = 0; i < 5; i++) {
      await page.reload();
      const sample = await fetchRawLayoutData(page);
      samples.push(extractLayoutTree(sample));
    }
    
    const calibration = calibrateComparisonSettings(samples, {
      strictness: 'medium', // 'low', 'medium', 'high'
    });
    
    console.log(`Calibration confidence: ${calibration.confidence}%`);
    console.log(`Position tolerance: ${calibration.settings.positionTolerance}px`);
    
    // 7. Validate against calibrated settings
    const validation = validateWithSettings(layout, layout2, calibration.settings);
    console.log(`Valid: ${validation.isValid}`);
    console.log(`Violations: ${validation.violations.length}`);
    
    // 8. Visual node group analysis
    if (layout.visualNodeGroups) {
      const stats = getVisualNodeGroupStatistics(layout.visualNodeGroups);
      console.log(`Group types:`, stats.groupsByType);
      console.log(`Max depth: ${stats.maxDepth}`);
    }
    
    // 9. Flatten and compare groups
    const flatComparison = compareFlattenedGroups(layout, layout2);
    const summary = generateChangeSummary(flatComparison);
    console.log(summary);
    
  } finally {
    await browser.close();
  }
}

// Run the example
basicExample().catch(console.error);