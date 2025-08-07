/**
 * Configuration loader for visual regression tests
 */

import * as fs from "fs/promises";
import type { ViscConfig } from "../../config.js";
import { DEFAULT_CONFIG } from "../../config.js";

/**
 * Load and validate configuration from a JSON file
 * @param configPath Path to the configuration file
 * @returns Validated and merged configuration
 */
export async function loadConfig(configPath: string): Promise<ViscConfig> {
  try {
    const content = await fs.readFile(configPath, "utf-8");
    const rawConfig = JSON.parse(content);
    
    // Import validation function from schema
    const { validateConfig } = await import("../../../schema/config.js");
    
    // Validate config with Zod schema
    const validatedConfig = validateConfig(rawConfig);

    // Merge with defaults and ensure all viewports have required fields
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...validatedConfig,
      outputDir: validatedConfig.outputDir || DEFAULT_CONFIG.outputDir,
      cacheDir: validatedConfig.cacheDir || DEFAULT_CONFIG.cacheDir,
      captureOptions: {
        ...DEFAULT_CONFIG.captureOptions,
        ...validatedConfig.captureOptions,
      },
      compareOptions: {
        ...DEFAULT_CONFIG.compareOptions,
        ...validatedConfig.compareOptions,
      },
      browserOptions: {
        ...DEFAULT_CONFIG.browserOptions,
        ...validatedConfig.browserOptions,
      },
    } as ViscConfig;

    // Ensure all viewports have required fields with defaults
    for (const key in mergedConfig.viewports) {
      const viewport = mergedConfig.viewports[key];
      mergedConfig.viewports[key] = {
        ...viewport,
        deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
        userAgent: viewport.userAgent ?? "",
      };
    }

    return mergedConfig;
  } catch (error) {
    // Check if it's a Zod validation error
    if (error && typeof error === 'object' && 'issues' in error) {
      const zodError = error as any;
      const issues = zodError.issues.map((issue: any) => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      throw new Error(`Invalid configuration in ${configPath}:\n${issues}`);
    }
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}