import type { VisualCheckConfig } from './src/types';

const config: VisualCheckConfig = {
  baseUrl: "http://localhost:3000",
  snapshotDir: "./snapshots",
  playwright: {
    browser: "chromium",
    headless: true,
    viewport: {
      width: 1280,
      height: 720
    }
  },
  comparison: {
    threshold: 0.1,
    generateDiff: true,
    diffDir: "./diffs"
  },
  urls: [
    {
      name: "home",
      url: "/",
      waitFor: {
        networkIdle: true
      }
    },
    {
      name: "about",
      url: "/about",
      waitFor: {
        networkIdle: true
      }
    },
    {
      name: "contact",
      url: "/contact",
      waitFor: {
        selector: ".contact-form",
        timeout: 5000
      }
    }
  ]
};

export default config;