/**
 * CLI command for calculating distances and similarities
 * Provides direct access to core calculation functions
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  // Layout calculations
  euclideanDistance,
  manhattanDistance,
  chebyshevDistance,
  rectDistance,
  minRectDistance,
  rectOverlapArea,
  rectIoU,
  normalizedPositionDifference,
  normalizedSizeDifference,
  aspectRatioDifference,
  
  // Text calculations
  levenshteinDistance,
  normalizedLevenshteinDistance,
  jaroSimilarity,
  jaroWinklerSimilarity,
  diceCoefficient,
  longestCommonSubsequence,
  longestCommonSubstring,
  tokenSimilarity,
  fuzzyStringMatch,
  
  // Set calculations
  jaccardSimilarity,
  diceSimilarity,
  overlapCoefficient,
  cosineSimilarity,
  accessibilitySimilarity,
  setEditDistance,
  normalizedSetEditDistance,
} from '../../core/index.js';

export function createCalcCommand() {
  const calc = new Command('calc')
    .description('Calculate distances and similarities')
    .addHelpText('after', `
Examples:
  # Calculate pixel distance between two points
  $ visc calc point-distance --euclidean 0,0 100,100
  
  # Calculate text similarity
  $ visc calc text-similarity --fuzzy "button" "buton"
  
  # Calculate rectangle IoU
  $ visc calc rect-iou 0,0,100,100 50,50,100,100
  
  # Compare CSS classes
  $ visc calc set-similarity --jaccard "btn primary large" "btn primary disabled"
`);

  // Point distance calculations
  calc
    .command('point-distance')
    .description('Calculate distance between two points')
    .argument('<point1>', 'First point as x,y')
    .argument('<point2>', 'Second point as x,y')
    .option('-e, --euclidean', 'Euclidean distance (default)', true)
    .option('-m, --manhattan', 'Manhattan distance')
    .option('-c, --chebyshev', 'Chebyshev distance')
    .option('-a, --all', 'Show all distance metrics')
    .action((point1Str, point2Str, options) => {
      const p1 = parsePoint(point1Str);
      const p2 = parsePoint(point2Str);
      
      if (options.all) {
        console.log(chalk.cyan('Point Distance Calculations:'));
        console.log(`  Points: (${p1.x}, ${p1.y}) → (${p2.x}, ${p2.y})`);
        console.log(`  ${chalk.green('Euclidean:')} ${euclideanDistance(p1, p2).toFixed(2)}`);
        console.log(`  ${chalk.green('Manhattan:')} ${manhattanDistance(p1, p2).toFixed(2)}`);
        console.log(`  ${chalk.green('Chebyshev:')} ${chebyshevDistance(p1, p2).toFixed(2)}`);
      } else if (options.manhattan) {
        console.log(manhattanDistance(p1, p2).toFixed(2));
      } else if (options.chebyshev) {
        console.log(chebyshevDistance(p1, p2).toFixed(2));
      } else {
        console.log(euclideanDistance(p1, p2).toFixed(2));
      }
    });

  // Rectangle calculations
  calc
    .command('rect-distance')
    .description('Calculate distance between rectangles')
    .argument('<rect1>', 'First rectangle as x,y,width,height')
    .argument('<rect2>', 'Second rectangle as x,y,width,height')
    .option('-c, --center', 'Center-to-center distance (default)', true)
    .option('-m, --min', 'Minimum edge-to-edge distance')
    .action((rect1Str, rect2Str, options) => {
      const r1 = parseRect(rect1Str);
      const r2 = parseRect(rect2Str);
      
      if (options.min) {
        console.log(minRectDistance(r1, r2).toFixed(2));
      } else {
        console.log(rectDistance(r1, r2).toFixed(2));
      }
    });

  calc
    .command('rect-overlap')
    .description('Calculate overlap between rectangles')
    .argument('<rect1>', 'First rectangle as x,y,width,height')
    .argument('<rect2>', 'Second rectangle as x,y,width,height')
    .action((rect1Str, rect2Str) => {
      const r1 = parseRect(rect1Str);
      const r2 = parseRect(rect2Str);
      const overlap = rectOverlapArea(r1, r2);
      
      console.log(chalk.cyan('Rectangle Overlap:'));
      console.log(`  ${chalk.green('Overlap Area:')} ${overlap} px²`);
      console.log(`  ${chalk.green('Rect1 Area:')} ${r1.width * r1.height} px²`);
      console.log(`  ${chalk.green('Rect2 Area:')} ${r2.width * r2.height} px²`);
    });

  calc
    .command('rect-iou')
    .description('Calculate Intersection over Union (IoU)')
    .argument('<rect1>', 'First rectangle as x,y,width,height')
    .argument('<rect2>', 'Second rectangle as x,y,width,height')
    .action((rect1Str, rect2Str) => {
      const r1 = parseRect(rect1Str);
      const r2 = parseRect(rect2Str);
      const iou = rectIoU(r1, r2);
      
      console.log(chalk.cyan('Intersection over Union:'));
      console.log(`  ${chalk.green('IoU:')} ${(iou * 100).toFixed(1)}%`);
      
      if (iou > 0.9) {
        console.log(`  ${chalk.green('Assessment:')} Nearly identical`);
      } else if (iou > 0.7) {
        console.log(`  ${chalk.yellow('Assessment:')} Strong match`);
      } else if (iou > 0.5) {
        console.log(`  ${chalk.yellow('Assessment:')} Moderate overlap`);
      } else if (iou > 0) {
        console.log(`  ${chalk.red('Assessment:')} Low overlap`);
      } else {
        console.log(`  ${chalk.red('Assessment:')} No overlap`);
      }
    });

  // Text similarity calculations
  calc
    .command('text-distance')
    .description('Calculate text edit distance')
    .argument('<text1>', 'First text')
    .argument('<text2>', 'Second text')
    .option('-n, --normalized', 'Show normalized distance (0-1)')
    .action((text1, text2, options) => {
      const distance = levenshteinDistance(text1, text2);
      
      if (options.normalized) {
        const normalized = normalizedLevenshteinDistance(text1, text2);
        console.log(normalized.toFixed(3));
      } else {
        console.log(distance);
      }
    });

  calc
    .command('text-similarity')
    .description('Calculate text similarity')
    .argument('<text1>', 'First text')
    .argument('<text2>', 'Second text')
    .option('-j, --jaro', 'Jaro similarity')
    .option('-w, --jaro-winkler', 'Jaro-Winkler similarity')
    .option('-d, --dice', 'Dice coefficient')
    .option('-t, --token', 'Token-based similarity')
    .option('-f, --fuzzy', 'Fuzzy match (combined metrics)')
    .option('-a, --all', 'Show all metrics')
    .action((text1, text2, options) => {
      if (options.all) {
        console.log(chalk.cyan('Text Similarity Metrics:'));
        console.log(`  Comparing: "${text1}" vs "${text2}"`);
        console.log(`  ${chalk.green('Levenshtein:')} ${(1 - normalizedLevenshteinDistance(text1, text2)).toFixed(3)}`);
        console.log(`  ${chalk.green('Jaro:')} ${jaroSimilarity(text1, text2).toFixed(3)}`);
        console.log(`  ${chalk.green('Jaro-Winkler:')} ${jaroWinklerSimilarity(text1, text2).toFixed(3)}`);
        console.log(`  ${chalk.green('Dice:')} ${diceCoefficient(text1, text2).toFixed(3)}`);
        console.log(`  ${chalk.green('Token:')} ${tokenSimilarity(text1, text2).toFixed(3)}`);
        console.log(`  ${chalk.green('Fuzzy:')} ${fuzzyStringMatch(text1, text2).toFixed(3)}`);
        
        const lcs = longestCommonSubsequence(text1, text2);
        const lcss = longestCommonSubstring(text1, text2);
        console.log(`  ${chalk.green('LCS Length:')} ${lcs}`);
        console.log(`  ${chalk.green('LCSS Length:')} ${lcss}`);
      } else if (options.jaro) {
        console.log(jaroSimilarity(text1, text2).toFixed(3));
      } else if (options.jaroWinkler) {
        console.log(jaroWinklerSimilarity(text1, text2).toFixed(3));
      } else if (options.dice) {
        console.log(diceCoefficient(text1, text2).toFixed(3));
      } else if (options.token) {
        console.log(tokenSimilarity(text1, text2).toFixed(3));
      } else if (options.fuzzy) {
        console.log(fuzzyStringMatch(text1, text2).toFixed(3));
      } else {
        // Default to fuzzy
        console.log(fuzzyStringMatch(text1, text2).toFixed(3));
      }
    });

  // Set similarity calculations
  calc
    .command('set-similarity')
    .description('Calculate set similarity')
    .argument('<set1>', 'First set (space-separated)')
    .argument('<set2>', 'Second set (space-separated)')
    .option('-j, --jaccard', 'Jaccard similarity')
    .option('-d, --dice', 'Dice coefficient')
    .option('-o, --overlap', 'Overlap coefficient')
    .option('-c, --cosine', 'Cosine similarity')
    .option('-e, --edit', 'Set edit distance')
    .option('-a, --all', 'Show all metrics')
    .action((set1Str, set2Str, options) => {
      const set1 = new Set(set1Str.split(/\s+/).filter(s => s.length > 0));
      const set2 = new Set(set2Str.split(/\s+/).filter(s => s.length > 0));
      
      if (options.all) {
        console.log(chalk.cyan('Set Similarity Metrics:'));
        console.log(`  Set 1: {${Array.from(set1).join(', ')}}`);
        console.log(`  Set 2: {${Array.from(set2).join(', ')}}`);
        console.log(`  ${chalk.green('Jaccard:')} ${jaccardSimilarity(set1, set2).toFixed(3)}`);
        console.log(`  ${chalk.green('Dice:')} ${diceSimilarity(set1, set2).toFixed(3)}`);
        console.log(`  ${chalk.green('Overlap:')} ${overlapCoefficient(set1, set2).toFixed(3)}`);
        console.log(`  ${chalk.green('Cosine:')} ${cosineSimilarity(set1, set2).toFixed(3)}`);
        console.log(`  ${chalk.green('Edit Distance:')} ${setEditDistance(set1, set2)}`);
        console.log(`  ${chalk.green('Normalized Edit:')} ${normalizedSetEditDistance(set1, set2).toFixed(3)}`);
      } else if (options.dice) {
        console.log(diceSimilarity(set1, set2).toFixed(3));
      } else if (options.overlap) {
        console.log(overlapCoefficient(set1, set2).toFixed(3));
      } else if (options.cosine) {
        console.log(cosineSimilarity(set1, set2).toFixed(3));
      } else if (options.edit) {
        console.log(setEditDistance(set1, set2));
      } else {
        // Default to Jaccard
        console.log(jaccardSimilarity(set1, set2).toFixed(3));
      }
    });

  // Accessibility attributes comparison
  calc
    .command('aria-similarity')
    .description('Compare ARIA/accessibility attributes')
    .argument('<attrs1>', 'First attributes as key=value pairs')
    .argument('<attrs2>', 'Second attributes as key=value pairs')
    .action((attrs1Str, attrs2Str) => {
      const attrs1 = parseAttributes(attrs1Str);
      const attrs2 = parseAttributes(attrs2Str);
      
      const result = accessibilitySimilarity(attrs1, attrs2);
      
      console.log(chalk.cyan('Accessibility Attributes Comparison:'));
      console.log(`  ${chalk.green('Similarity:')} ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`  ${chalk.green('Matched:')} ${Array.from(result.matchedAttributes).join(', ') || 'none'}`);
      console.log(`  ${chalk.yellow('Only in first:')} ${Array.from(result.uniqueToFirst).join(', ') || 'none'}`);
      console.log(`  ${chalk.yellow('Only in second:')} ${Array.from(result.uniqueToSecond).join(', ') || 'none'}`);
    });

  // Size/aspect ratio calculations
  calc
    .command('size-diff')
    .description('Calculate size and aspect ratio differences')
    .argument('<size1>', 'First size as width,height')
    .argument('<size2>', 'Second size as width,height')
    .action((size1Str, size2Str) => {
      const s1 = parseSize(size1Str);
      const s2 = parseSize(size2Str);
      
      const sizeDiff = normalizedSizeDifference(s1, s2);
      const aspectDiff = aspectRatioDifference(s1, s2);
      const ratio1 = s1.width / (s1.height || 1);
      const ratio2 = s2.width / (s2.height || 1);
      
      console.log(chalk.cyan('Size Comparison:'));
      console.log(`  Size 1: ${s1.width}×${s1.height} (ratio: ${ratio1.toFixed(2)})`);
      console.log(`  Size 2: ${s2.width}×${s2.height} (ratio: ${ratio2.toFixed(2)})`);
      console.log(`  ${chalk.green('Size Difference:')} ${(sizeDiff * 100).toFixed(1)}%`);
      console.log(`  ${chalk.green('Aspect Ratio Diff:')} ${(aspectDiff * 100).toFixed(1)}%`);
      
      if (aspectDiff > 0.3) {
        console.log(`  ${chalk.red('Warning:')} Significant aspect ratio distortion`);
      }
    });

  return calc;
}

// Helper functions
function parsePoint(str: string): { x: number; y: number } {
  const parts = str.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error(`Invalid point format: ${str}. Use: x,y`);
  }
  return { x: parts[0], y: parts[1] };
}

function parseRect(str: string): { x: number; y: number; width: number; height: number } {
  const parts = str.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 4 || parts.some(isNaN)) {
    throw new Error(`Invalid rectangle format: ${str}. Use: x,y,width,height`);
  }
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

function parseSize(str: string): { width: number; height: number } {
  const parts = str.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error(`Invalid size format: ${str}. Use: width,height`);
  }
  return { width: parts[0], height: parts[1] };
}

function parseAttributes(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pairs = str.split(/\s+/);
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      attrs[key] = value;
    }
  }
  
  return attrs;
}