import { chromium } from '@playwright/test';
import { compareImages } from '../dist/core/compare.js';
import fs from 'fs/promises';
import path from 'path';

// All-in-one configuration with proxy override rules
const config = {
  // Target website
  targetUrl: 'https://example.com',
  
  // Visual test settings
  viewport: { width: 1280, height: 720 },
  threshold: 0.01, // 1% threshold
  
  // Proxy configuration (simulated - in real use, this would be your proxy server)
  proxy: {
    server: 'http://localhost:8080',
    // CSS override rules
    overrides: [
      {
        pattern: /\.css$/,
        replacement: `
          /* Overridden CSS */
          body {
            font-family: 'Georgia', serif !important;
            background-color: #f0f0f0 !important;
            color: #2c3e50 !important;
            line-height: 1.8 !important;
          }
          
          h1, h2, h3 {
            color: #e74c3c !important;
            font-weight: 700 !important;
          }
          
          a {
            color: #3498db !important;
            text-decoration: none !important;
          }
          
          a:hover {
            text-decoration: underline !important;
          }
          
          /* Additional overrides to ensure visibility */
          * {
            transition: none !important;
            animation: none !important;
          }
        `
      }
    ]
  },
  
  // Test scenarios
  scenarios: [
    {
      name: 'homepage',
      path: '/',
      waitFor: 'networkidle'
    },
    // Add more pages as needed
  ]
};

async function runCSSRefactorWithProxySimulation() {
  console.log('🚀 CSS Refactoring Test with Proxy Override Simulation\n');
  console.log(`📋 Configuration:`);
  console.log(`   Target: ${config.targetUrl}`);
  console.log(`   Viewport: ${config.viewport.width}x${config.viewport.height}`);
  console.log(`   Threshold: ${(config.threshold * 100).toFixed(1)}%`);
  console.log(`   Proxy: ${config.proxy.server} (simulated)\n`);

  const browser = await chromium.launch({ 
    headless: true,
    // In real scenario, you would configure proxy here:
    // proxy: { server: config.proxy.server }
  });
  
  const context = await browser.newContext({ 
    viewport: config.viewport,
    // Ignore HTTPS errors for testing
    ignoreHTTPSErrors: true
  });
  
  try {
    // Create directories
    await fs.mkdir('./snapshots', { recursive: true });
    await fs.mkdir('./css-refactor-diffs', { recursive: true });
    
    const results = [];
    
    for (const scenario of config.scenarios) {
      console.log(`\n📍 Testing: ${scenario.name} (${scenario.path})`);
      
      // Step 1: Original page
      console.log('  📸 Capturing original...');
      const page1 = await context.newPage();
      await page1.goto(config.targetUrl + scenario.path, {
        waitUntil: scenario.waitFor as any
      });
      
      const originalPath = `./snapshots/${scenario.name}-original.png`;
      await page1.screenshot({ 
        path: originalPath,
        fullPage: true 
      });
      await page1.close();
      
      // Step 2: Page with CSS override (simulated)
      console.log('  🎨 Applying CSS override...');
      const page2 = await context.newPage();
      
      // Navigate to page
      await page2.goto(config.targetUrl + scenario.path, {
        waitUntil: scenario.waitFor as any
      });
      
      // Simulate proxy CSS override by injecting styles
      await page2.addStyleTag({
        content: config.proxy.overrides[0].replacement
      });
      
      const overridePath = `./snapshots/${scenario.name}-override.png`;
      await page2.screenshot({ 
        path: overridePath,
        fullPage: true 
      });
      await page2.close();
      
      // Step 3: Compare
      console.log('  🔍 Comparing images...');
      const result = await compareImages(originalPath, overridePath, {
        threshold: config.threshold,
        generateDiff: true,
        diffPath: `./css-refactor-diffs/${scenario.name}-diff.png`
      });
      
      const scenarioResult = {
        scenario: scenario.name,
        url: config.targetUrl + scenario.path,
        difference: result.difference,
        differencePercentage: (result.difference * 100).toFixed(4) + '%',
        diffPixels: result.diffPixels,
        passed: result.difference <= config.threshold,
        diffImage: result.diffPath
      };
      
      results.push(scenarioResult);
      
      console.log(`  📊 Result: ${scenarioResult.differencePercentage} difference`);
      console.log(`  Status: ${scenarioResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      configuration: {
        targetUrl: config.targetUrl,
        viewport: config.viewport,
        threshold: config.threshold,
        proxyServer: config.proxy.server,
        overrideRules: config.proxy.overrides.length
      },
      summary: {
        totalScenarios: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        overallPassed: results.every(r => r.passed)
      },
      results: results
    };
    
    // Display summary
    console.log('\n📊 Overall Summary:');
    console.log(`   Total scenarios: ${report.summary.totalScenarios}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Overall: ${report.summary.overallPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    // Show details of failures
    if (report.summary.failed > 0) {
      console.log('\n❌ Failed scenarios:');
      results.filter(r => !r.passed).forEach(r => {
        console.log(`   - ${r.scenario}: ${r.differencePercentage} difference`);
        console.log(`     Diff image: ${r.diffImage}`);
      });
    }
    
    // Save report
    await fs.writeFile(
      './css-proxy-override-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('\n📄 Full report saved: ./css-proxy-override-report.json');
    
    // Real proxy implementation example
    console.log('\n💡 Real Proxy Implementation:');
    console.log('   1. Start your proxy server (e.g., Cloudflare Worker)');
    console.log('   2. Configure proxy in browser launch options');
    console.log('   3. Proxy intercepts CSS requests and serves overrides');
    console.log('   4. No need to inject styles - proxy handles it transparently');
    
    // Exit with appropriate code
    process.exit(report.summary.overallPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Execute the test
runCSSRefactorWithProxySimulation().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});