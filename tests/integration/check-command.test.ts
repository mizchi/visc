import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "fs";
import * as path from "path";
import { check } from "../../src/cli/commands/check.js";

describe("Check Command Integration Tests", { timeout: 30000 }, () => {
  const testCacheDir = ".visc-test/cache";
  const testOutputDir = ".visc-test/output";

  beforeAll(async () => {
    // Clean up test directories
    await fs.rm(testCacheDir, { recursive: true, force: true });
    await fs.rm(testOutputDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    // Clean up test directories
    await fs.rm(testCacheDir, { recursive: true, force: true });
    await fs.rm(testOutputDir, { recursive: true, force: true });
  });

  it("should run check with network controls", async () => {
    const configPath = path.join(
      process.cwd(),
      "tests/fixtures/test-configs/network-controls.config.json"
    );

    // First run - create baseline
    await check(configPath, {
      update: true,
    });

    // Verify baseline was created
    const cacheExists = await fs
      .access(testCacheDir)
      .then(() => true)
      .catch(() => false);
    expect(cacheExists).toBe(true);
  });

  it("should apply phase-specific overrides", async () => {
    const configPath = path.join(
      process.cwd(),
      "tests/fixtures/test-configs/phase-specific.config.json"
    );

    // Create phase-specific config
    const config = {
      version: "1.0",
      cacheDir: ".visc-test/cache-phase",
      outputDir: ".visc-test/output-phase",
      viewports: {
        desktop: {
          name: "Desktop",
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          userAgent: "Mozilla/5.0",
        },
      },
      testCases: [
        {
          id: "phase-test",
          url: "https://example.com",
          description: "Phase-specific test",
          captureOptions: {
            networkBlocks: ["**/ads/**"],
          },
          compareOptions: {
            overrides: {
              "**/*.css": "./tests/fixtures/test-overrides/modified.css",
            },
          },
        },
      ],
      captureOptions: {
        waitUntil: "networkidle0",
        additionalWait: 100,
      },
      compareOptions: {
        ignoreText: true,
        threshold: 5,
        similarityThreshold: 98,
      },
    };

    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));

    try {
      // Run check
      await check(configPath, { update: true });

      // Verify it ran without errors
      const cacheExists = await fs
        .access(".visc-test/cache-phase")
        .then(() => true)
        .catch(() => false);
      expect(cacheExists).toBe(true);
    } finally {
      // Cleanup
      await fs.rm(".visc-test/cache-phase", { recursive: true, force: true });
      await fs.rm(".visc-test/output-phase", { recursive: true, force: true });
      await fs.unlink(configPath).catch(() => {});
    }
  });
});
