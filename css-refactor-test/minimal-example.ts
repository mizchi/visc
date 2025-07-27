import { chromium } from '@playwright/test';
import { compareImages } from '../dist/core/compare.js';

const originalCSS = `
  body { background: white; color: black; }
  h1 { color: #333; font-size: 2rem; }
`;

const refactoredCSS = `
  body { background: #f8f9fa; color: #212529; }
  h1 { color: #2c3e50; font-size: 2.2rem; }
`;

const html = `
  <!DOCTYPE html>
  <html>
  <head><style id="css"></style></head>
  <body>
    <h1>CSS Refactor Test</h1>
    <p>Visual regression testing example</p>
  </body>
  </html>
`;

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Original
    await page.setContent(html.replace('<style id="css"></style>', 
                                     `<style>${originalCSS}</style>`));
    await page.screenshot({ path: 'original.png' });
    
    // Refactored
    await page.setContent(html.replace('<style id="css"></style>', 
                                     `<style>${refactoredCSS}</style>`));
    await page.screenshot({ path: 'refactored.png' });
    
    // Compare
    const result = await compareImages('original.png', 'refactored.png', {
      threshold: 0.01,
      generateDiff: true,
      diffPath: 'diff.png'
    });
    
    console.log(`Difference: ${(result.difference * 100).toFixed(2)}%`);
    console.log(`Status: ${result.difference <= 0.01 ? 'PASS' : 'FAIL'}`);
    
  } finally {
    await browser.close();
  }
}

test().catch(console.error);