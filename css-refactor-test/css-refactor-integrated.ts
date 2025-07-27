import { chromium } from '@playwright/test';
import { compareImages } from '../dist/core/compare.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - all in one place
const config = {
  // Test configuration
  viewport: { width: 1280, height: 720 },
  threshold: 0.01, // 1% threshold
  
  // Original CSS (inline)
  originalCSS: `
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #ffffff;
      line-height: 1.6;
    }
    
    h1 {
      color: #333333;
      font-size: 2rem;
      margin-bottom: 1rem;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .button {
      background-color: #007bff;
      color: white;
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  `,
  
  // Refactored CSS (with changes)
  refactoredCSS: `
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif; /* Changed font stack */
      margin: 0;
      padding: 20px;
      background-color: #f8f9fa; /* Slightly different background */
      line-height: 1.7; /* Slightly increased */
    }
    
    h1 {
      color: #2c3e50; /* Different color */
      font-size: 2.2rem; /* Slightly larger */
      margin-bottom: 1.2rem;
      font-weight: 600; /* Added weight */
    }
    
    .container {
      max-width: 820px; /* Slightly wider */
      margin: 0 auto;
      padding: 24px; /* Increased padding */
    }
    
    .button {
      background-color: #28a745; /* Different color (green) */
      color: white;
      padding: 12px 24px; /* Larger padding */
      border: none;
      border-radius: 6px; /* More rounded */
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .button:hover {
      background-color: #218838;
    }
  `,
  
  // Test HTML content
  htmlContent: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CSS Refactor Test</title>
      <style id="test-styles">
        /* Styles will be injected here */
      </style>
    </head>
    <body>
      <div class="container">
        <h1>CSS Refactoring Test</h1>
        <p>This page demonstrates visual regression testing for CSS refactoring.</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <button class="button">Click Me</button>
        <p>Additional content to test layout changes and spacing.</p>
      </div>
    </body>
    </html>
  `
};

async function runCSSRefactorTest() {
  console.log('🚀 CSS Refactoring Visual Regression Test\n');
  console.log(`📋 Configuration:`);
  console.log(`   Viewport: ${config.viewport.width}x${config.viewport.height}`);
  console.log(`   Threshold: ${(config.threshold * 100).toFixed(1)}%`);
  console.log(`   Mode: Inline CSS comparison\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: config.viewport });
  
  try {
    // Create directories
    await fs.mkdir('./snapshots', { recursive: true });
    await fs.mkdir('./css-refactor-diffs', { recursive: true });
    
    // Test with original CSS
    console.log('📸 Step 1: Capturing with original CSS...');
    const page1 = await context.newPage();
    const htmlWithOriginal = config.htmlContent.replace(
      '/* Styles will be injected here */', 
      config.originalCSS
    );
    await page1.setContent(htmlWithOriginal);
    await page1.waitForLoadState('networkidle');
    
    const originalPath = './snapshots/css-original.png';
    await page1.screenshot({ 
      path: originalPath,
      fullPage: true 
    });
    await page1.close();
    console.log('✅ Original screenshot captured\n');
    
    // Test with refactored CSS
    console.log('📸 Step 2: Capturing with refactored CSS...');
    const page2 = await context.newPage();
    const htmlWithRefactored = config.htmlContent.replace(
      '/* Styles will be injected here */', 
      config.refactoredCSS
    );
    await page2.setContent(htmlWithRefactored);
    await page2.waitForLoadState('networkidle');
    
    const refactoredPath = './snapshots/css-refactored.png';
    await page2.screenshot({ 
      path: refactoredPath,
      fullPage: true 
    });
    await page2.close();
    console.log('✅ Refactored screenshot captured\n');
    
    // Compare images
    console.log('🔍 Step 3: Comparing images...');
    const result = await compareImages(originalPath, refactoredPath, {
      threshold: config.threshold,
      generateDiff: true,
      diffPath: './css-refactor-diffs/comparison.png'
    });
    
    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      configuration: {
        viewport: config.viewport,
        threshold: config.threshold
      },
      result: {
        match: result.match,
        difference: result.difference,
        differencePercentage: (result.difference * 100).toFixed(4) + '%',
        diffPixels: result.diffPixels,
        passed: result.difference <= config.threshold
      },
      files: {
        original: originalPath,
        refactored: refactoredPath,
        diff: result.diffPath
      }
    };
    
    // Display results
    console.log('\n📊 Results:');
    console.log(`   Difference: ${report.result.differencePercentage}`);
    console.log(`   Different pixels: ${result.diffPixels}`);
    console.log(`   Threshold: ${(config.threshold * 100)}%`);
    console.log(`   Status: ${report.result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (result.diffPath) {
      console.log(`   Diff image: ${result.diffPath}`);
    }
    
    // Detailed analysis
    if (!report.result.passed) {
      console.log('\n⚠️  Visual regression detected!');
      console.log('   The CSS refactoring has introduced visual changes that exceed the threshold.');
      console.log('\n   Changed CSS properties:');
      console.log('   - Font family: Arial → Helvetica Neue');
      console.log('   - Background: #ffffff → #f8f9fa');
      console.log('   - H1 color: #333333 → #2c3e50');
      console.log('   - Button color: #007bff → #28a745');
      console.log('   - Various spacing adjustments');
    } else {
      console.log('\n✅ CSS refactoring passed!');
      console.log('   Visual changes are within acceptable threshold.');
    }
    
    // Save report
    await fs.writeFile(
      './css-refactor-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Full report saved: ./css-refactor-report.json');
    
    // Example of how to use with CI/CD
    console.log('\n💡 CI/CD Integration:');
    console.log('   Exit code:', report.result.passed ? '0 (success)' : '1 (failure)');
    console.log('   Use in CI: node css-refactor-integrated.ts || exit 1');
    
    // Exit with appropriate code
    process.exit(report.result.passed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Execute the test
runCSSRefactorTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});