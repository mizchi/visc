#!/usr/bin/env node

import { Command } from 'commander';
import { TestRunner } from './test-runner.js';
import { VisualCheckConfig } from './types.js';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

program
  .name('visual-checker')
  .description('Visual regression testing framework')
  .version('0.1.0');

/**
 * 設定ファイルを読み込み
 */
async function loadConfig(configPath: string): Promise<VisualCheckConfig> {
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configContent);
  } catch (error) {
    console.error(chalk.red(`Failed to load config file: ${configPath}`));
    console.error(error);
    process.exit(1);
  }
}

// testコマンド
program
  .command('test')
  .description('Run visual regression tests')
  .option('-c, --config <path>', 'Path to config file', './configs/example.config.json')
  .action(async (options) => {
    console.log(chalk.blue.bold('Visual Regression Testing'));
    console.log(chalk.gray(`Config: ${options.config}\n`));

    const config = await loadConfig(options.config);
    const runner = new TestRunner(config);
    
    try {
      const results = await runner.runTests(false);
      const hasFailures = results.some(r => !r.passed);
      process.exit(hasFailures ? 1 : 0);
    } catch (error) {
      console.error(chalk.red('Test execution failed:'));
      console.error(error);
      process.exit(1);
    }
  });

// updateコマンド
program
  .command('update')
  .description('Update baseline snapshots')
  .option('-c, --config <path>', 'Path to config file', './configs/example.config.json')
  .action(async (options) => {
    console.log(chalk.blue.bold('Updating Baseline Snapshots'));
    console.log(chalk.gray(`Config: ${options.config}\n`));

    const config = await loadConfig(options.config);
    const runner = new TestRunner(config);
    
    try {
      await runner.runTests(true);
      console.log(chalk.green('\n✓ All baselines updated successfully'));
    } catch (error) {
      console.error(chalk.red('Update failed:'));
      console.error(error);
      process.exit(1);
    }
  });

// compareコマンド
program
  .command('compare <baseline> <current>')
  .description('Compare two images directly')
  .option('-t, --threshold <number>', 'Difference threshold (0-1)', '0.1')
  .option('-o, --output <path>', 'Output path for diff image')
  .action(async (baseline, current, options) => {
    console.log(chalk.blue.bold('Image Comparison'));
    console.log(chalk.gray(`Baseline: ${baseline}`));
    console.log(chalk.gray(`Current: ${current}`));
    console.log(chalk.gray(`Threshold: ${options.threshold}\n`));

    const { SnapshotComparator } = await import('./snapshot-comparator.js');
    
    const config: VisualCheckConfig = {
      urls: [],
      comparison: {
        threshold: parseFloat(options.threshold),
        generateDiff: !!options.output,
        diffDir: options.output ? path.dirname(options.output) : undefined,
      },
    };

    const comparator = new SnapshotComparator(config);
    const result = await comparator.compare(current, baseline, {
      name: path.basename(current, path.extname(current)),
      url: '',
    });

    if (result.passed) {
      console.log(chalk.green('✓ Images match'));
    } else {
      console.log(chalk.red('✗ Images differ'));
      if (result.error) {
        console.log(chalk.red(`  ${result.error}`));
      }
      if (result.diffPercentage !== undefined) {
        console.log(chalk.yellow(`  Difference: ${(result.diffPercentage * 100).toFixed(2)}%`));
      }
    }

    if (options.output && result.diffImagePath) {
      await fs.rename(result.diffImagePath, options.output);
      console.log(chalk.gray(`  Diff saved to: ${options.output}`));
    }

    process.exit(result.passed ? 0 : 1);
  });

// initコマンド
program
  .command('init')
  .description('Initialize visual-checker in current directory')
  .action(async () => {
    console.log(chalk.blue.bold('Initializing Visual Checker'));

    const dirs = ['configs', 'snapshots', 'diffs'];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(chalk.green(`✓ Created ${dir}/`));
      } catch (error) {
        console.log(chalk.yellow(`⚠ ${dir}/ already exists`));
      }
    }

    // サンプル設定ファイルをコピー
    const exampleConfigSrc = path.join(__dirname, '../configs/example.config.json');
    const exampleConfigDest = './configs/visual-check.config.json';
    
    try {
      await fs.copyFile(exampleConfigSrc, exampleConfigDest);
      console.log(chalk.green(`✓ Created ${exampleConfigDest}`));
    } catch (error) {
      console.log(chalk.yellow(`⚠ Config file already exists`));
    }

    console.log(chalk.green('\n✓ Visual Checker initialized successfully'));
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('1. Edit configs/visual-check.config.json'));
    console.log(chalk.gray('2. Run: visual-checker update -c configs/visual-check.config.json'));
    console.log(chalk.gray('3. Run: visual-checker test -c configs/visual-check.config.json'));
  });

program.parse(process.argv);