#!/usr/bin/env node
import path from 'path';
import fs from 'fs/promises';
import { fetchLayoutAnalysis } from '../v2/io/browser.js';
import { detectFlakiness, generateFlakinessReport } from '../v2/layout/flakiness-detector.js';
import { renderLayoutToSvg } from '../v2/layout/svg-renderer.js';
import type { LayoutAnalysisResult } from '../v2/index.js';

async function main() {
  const url = process.argv[2] || `file://${path.join(process.cwd(), 'examples/sample-project01/assets/main/index.html')}`;
  const outputDir = process.argv[3] || path.join(process.cwd(), 'output', 'v2-adaptive-stability');

  console.log('v2 - Adaptive Stability Check with SVG Rendering');
  console.log('====================================================');
  console.log(`URL: ${url}`);
  console.log(`Output Directory: ${outputDir}`);
  console.log('');

  await fs.mkdir(outputDir, { recursive: true });

  const options = {
    minIterations: 3,
    maxIterations: 10,
    viewport: { width: 1280, height: 720 },
    delay: 1000, // 1 second delay between checks
    targetStability: 95, // 95% stability
  };

  const results: LayoutAnalysisResult[] = [];
  let lastFlakinessScore = 0;

  try {
    for (let i = 0; i < options.maxIterations; i++) {
      console.log(`[Iteration ${i + 1}/${options.maxIterations}] Fetching layout data...`);
      const layout = await fetchLayoutAnalysis(url, { viewport: options.viewport });
      results.push(layout);

      // Save individual result and SVG
      const iteration = i + 1;
      await fs.writeFile(
        path.join(outputDir, `layout_iteration_${iteration}.json`),
        JSON.stringify(layout, null, 2)
      );
      const svg = renderLayoutToSvg(layout);
      await fs.writeFile(
        path.join(outputDir, `layout_iteration_${iteration}.svg`),
        svg
      );
      console.log(`  -> Saved layout_iteration_${iteration}.json and .svg`);

      if (results.length >= options.minIterations) {
        console.log('Analyzing flakiness...');
        const flakinessAnalysis = detectFlakiness(results);
        lastFlakinessScore = 100 - flakinessAnalysis.overallScore;

        const report = generateFlakinessReport(flakinessAnalysis, { format: 'text', verbosity: 'summary' });
        console.log(report);

        if (lastFlakinessScore >= options.targetStability) {
          console.log(`\nStability target of ${options.targetStability}% reached.`);
          break;
        }
      }

      if (i < options.maxIterations - 1) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }

    console.log('\nFinal Flakiness Analysis');
    console.log('===========================');
    const finalAnalysis = detectFlakiness(results);
    const finalReport = generateFlakinessReport(finalAnalysis, { format: 'markdown', verbosity: 'detailed' });
    
    await fs.writeFile(path.join(outputDir, 'final-report.md'), finalReport);
    console.log(finalReport);

    console.log(`\nCheck complete. Results saved in ${outputDir}`);
    process.exit(0);

  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

main();
