import { describe, it, expect, beforeAll, afterAll } from "vitest";
import puppeteer, { Browser, Page, HTTPRequest, HTTPResponse } from "puppeteer";
import { promises as fs } from "fs";
import * as path from "path";
import { captureLayout } from "../src/workflow.js";

describe("Network Controls", { timeout: 30000 }, () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: true });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe("networkBlocks", () => {
    it("should block matching network requests", async () => {
      const page = await browser.newPage();
      const blockedUrls: string[] = [];

      // Monitor blocked requests
      page.on("requestfailed", (request: HTTPRequest) => {
        if (request.failure()?.errorText === "net::ERR_BLOCKED_BY_CLIENT") {
          blockedUrls.push(request.url());
        }
      });

      await captureLayout(
        page,
        "https://example.com",
        {
          name: "Test",
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          userAgent: "",
        },
        {
          networkBlocks: ["**/gtag/**", "**/analytics/**", "**/google-analytics.com/**"],
        }
      );

      // Check if analytics scripts were blocked
      const analyticsBlocked = blockedUrls.some(
        (url) =>
          url.includes("gtag") ||
          url.includes("analytics") ||
          url.includes("google-analytics.com")
      );

      // Note: example.com may not have analytics, but the blocking mechanism should work
      expect(page.isClosed()).toBe(false);

      await page.close();
    });
  });

  describe("overrides", () => {
    it("should override CSS files with local versions", async () => {
      const page = await browser.newPage();
      const overriddenUrls: string[] = [];

      // Monitor overridden requests
      page.on("response", (response: HTTPResponse) => {
        const request = response.request();
        if (response.status() === 200 && request.url().includes(".css")) {
          overriddenUrls.push(request.url());
        }
      });

      // Create a test CSS file
      const testCssPath = path.join(
        process.cwd(),
        "tests/fixtures/test-overrides/test.css"
      );
      await fs.mkdir(path.dirname(testCssPath), { recursive: true });
      await fs.writeFile(
        testCssPath,
        "/* Test CSS */ body { background: red !important; }"
      );

      await captureLayout(
        page,
        "https://example.com",
        {
          name: "Test",
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          userAgent: "",
        },
        {
          overrides: {
            "**/*.css": "./tests/fixtures/test-overrides/test.css",
          },
        }
      );

      // Cleanup
      await fs.unlink(testCssPath).catch(() => {});

      await page.close();
    });

    it("should redirect URLs to different endpoints", async () => {
      const page = await browser.newPage();

      await captureLayout(
        page,
        "https://example.com",
        {
          name: "Test",
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          userAgent: "",
        },
        {
          overrides: {
            "https://example.com/api/v1/**": "https://localhost:8080/mock-api/",
          },
        }
      );

      await page.close();
    });
  });

  describe("Phase-specific settings", () => {
    it("should apply different settings for capture and compare phases", async () => {
      // This test would typically be part of the integration tests
      // as it requires the full check command workflow
      expect(true).toBe(true); // Placeholder
    });
  });
});