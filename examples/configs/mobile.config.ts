import type { VisualCheckConfig } from '../../src/types';

const config: VisualCheckConfig = {
  baseUrl: "http://localhost:3000",
  snapshotDir: "./snapshots/mobile",
  playwright: {
    browser: "chromium",
    headless: true,
    device: "iPhone 12"
  },
  comparison: {
    threshold: 0.1,
    generateDiff: true,
    diffDir: "./diffs/mobile"
  },
  urls: [
    {
      name: "home-mobile",
      url: "/",
      waitFor: {
        networkIdle: true
      }
    },
    {
      name: "product-mobile",
      url: "/products/1",
      waitFor: {
        selector: ".product-detail",
        networkIdle: true
      }
    }
  ]
};

export default config;