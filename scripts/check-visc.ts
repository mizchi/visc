#!/usr/bin/env tsx
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../tests/fixtures');

const PORT = 8080;
const HOST = 'localhost';

const mimeTypes: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function getMimeType(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return mimeTypes[ext] || 'text/plain';
}

async function startServer(): Promise<void> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let filePath = url.pathname;
    
    if (filePath === '/') {
      filePath = '/index.html';
    }
    
    const fullPath = join(fixturesDir, filePath);
    
    try {
      const content = await readFile(fullPath);
      const contentType = getMimeType(fullPath);
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  });
  
  return new Promise((resolve) => {
    server.listen(PORT, HOST, () => {
      console.log(`Test server running at http://${HOST}:${PORT}`);
      console.log(`Serving files from ${fixturesDir}`);
      resolve();
    });
  });
}

async function runVisualCheck(): Promise<void> {
  console.log('Starting visual check for test fixtures...\n');
  
  const testConfig = {
    version: '1.0',
    viewports: {
      mobile: {
        name: 'Mobile',
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
      },
      desktop: {
        name: 'Desktop',
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      },
    },
    screenshotOptions: {
      fullPage: false,
      format: 'jpeg',
      quality: 70,
      cacheDir: '.visc/test-cache/screenshots',
    },
    captureOptions: {
      waitUntil: 'networkidle2',
      waitForLCP: false,
      timeout: 10000,
    },
    testCases: [
      {
        id: 'baseline',
        url: `http://${HOST}:${PORT}/baseline/basic-layout.html`,
      },
      {
        id: 'text-change',
        url: `http://${HOST}:${PORT}/changed/basic-layout-text-change.html`,
      },
      {
        id: 'style-change',
        url: `http://${HOST}:${PORT}/changed/basic-layout-style-change.html`,
      },
      {
        id: 'structure-change',
        url: `http://${HOST}:${PORT}/changed/basic-layout-structure-change.html`,
      },
      {
        id: 'position-shift',
        url: `http://${HOST}:${PORT}/patterns/position-shift.html`,
      },
      {
        id: 'z-index',
        url: `http://${HOST}:${PORT}/patterns/z-index-changes.html`,
      },
      {
        id: 'overflow',
        url: `http://${HOST}:${PORT}/patterns/overflow-scroll.html`,
      },
      {
        id: 'accessibility',
        url: `http://${HOST}:${PORT}/patterns/accessibility-based.html`,
      },
    ],
  };
  
  const configPath = join(__dirname, '../visc.test.config.json');
  await writeConfig(configPath, testConfig);
  
  return new Promise((resolve, reject) => {
    const visc = spawn('node', ['dist/cli.js', 'check', '--config', configPath], {
      stdio: 'inherit',
      shell: true,
    });
    
    visc.on('close', (code) => {
      if (code === 0) {
        console.log('\nVisual check completed successfully!');
        resolve();
      } else {
        reject(new Error(`Visual check failed with code ${code}`));
      }
    });
    
    visc.on('error', (error) => {
      reject(error);
    });
  });
}

async function writeConfig(path: string, config: any): Promise<void> {
  const { writeFile } = await import('fs/promises');
  await writeFile(path, JSON.stringify(config, null, 2));
}

async function main() {
  try {
    await startServer();
    await runVisualCheck();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();