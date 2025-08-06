import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration template
const DEFAULT_CONFIG = {
  "$schema": "node_modules/@mizchi/visc/schema.json",
  "viewports": {
    "mobile": {
      "name": "Mobile",
      "width": 375,
      "height": 667,
      "deviceScaleFactor": 2,
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
    },
    "desktop": {
      "name": "Desktop",
      "width": 1280,
      "height": 800,
      "deviceScaleFactor": 1,
      "userAgent": ""
    }
  },
  "testCases": [
    {
      "id": "homepage",
      "url": "https://example.com",
      "description": "Homepage visual test"
    }
  ],
  "browserOptions": {
    "headless": true
  },
  "captureOptions": {
    "waitUntil": "networkidle2",
    "waitForLCP": true,
    "additionalWait": 500,
    "timeout": 30000
  },
  "compareOptions": {
    "threshold": 10,
    "similarityThreshold": 90,
    "useVisualGroups": true
  },
  "calibrationOptions": {
    "enabled": true,
    "samples": 3,
    "strictness": "medium"
  },
  "cacheDir": ".visc/cache",
  "outputDir": ".visc/output"
};

export async function init(options: {
  force?: boolean;
  minimal?: boolean;
}) {
  const configPath = path.join(process.cwd(), "visc.config.json");
  
  // Check if config already exists
  try {
    await fs.access(configPath);
    if (!options.force) {
      console.error("❌ visc.config.json already exists. Use --force to overwrite.");
      process.exit(1);
    }
  } catch {
    // File doesn't exist, which is fine
  }
  
  // Create config based on options
  let config = DEFAULT_CONFIG;
  
  if (options.minimal) {
    // Minimal config with just the essentials
    config = {
      "$schema": "node_modules/@mizchi/visc/schema.json",
      "viewports": {
        "default": {
          "name": "Default",
          "width": 1280,
          "height": 800
        }
      },
      "testCases": [
        {
          "id": "example",
          "url": "https://example.com"
        }
      ]
    } as any;
  }
  
  // Write config file
  await fs.writeFile(
    configPath,
    JSON.stringify(config, null, 2) + "\n",
    "utf-8"
  );
  
  console.log("✅ Created visc.config.json");
  
  // Create cache and output directories
  const cacheDir = config.cacheDir || ".visc/cache";
  const outputDir = config.outputDir || ".visc/output";
  
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  
  console.log(`📁 Created directories:`);
  console.log(`   - ${cacheDir}`);
  console.log(`   - ${outputDir}`);
  
  // Add .visc to .gitignore if it exists
  try {
    const gitignorePath = path.join(process.cwd(), ".gitignore");
    let gitignoreContent = "";
    
    try {
      gitignoreContent = await fs.readFile(gitignorePath, "utf-8");
    } catch {
      // .gitignore doesn't exist yet
    }
    
    if (!gitignoreContent.includes(".visc")) {
      const updatedContent = gitignoreContent
        ? gitignoreContent.trimEnd() + "\n\n# Visual Checker\n.visc/\n"
        : "# Visual Checker\n.visc/\n";
      
      await fs.writeFile(gitignorePath, updatedContent, "utf-8");
      console.log("📝 Added .visc/ to .gitignore");
    }
  } catch (error) {
    // Ignore .gitignore errors
  }
  
  console.log("\n💡 Next steps:");
  console.log("   1. Edit visc.config.json to add your test URLs");
  console.log("   2. Run 'visc check' to create initial baselines");
  console.log("   3. Make changes and run 'visc check' again to detect differences");
  
  // Copy schema file to node_modules if we're running from source
  try {
    const schemaSource = path.join(__dirname, "../../../visc.config.schema.json");
    const schemaDest = path.join(process.cwd(), "node_modules/@mizchi/visc/schema.json");
    
    // Check if source schema exists
    await fs.access(schemaSource);
    
    // Create destination directory
    await fs.mkdir(path.dirname(schemaDest), { recursive: true });
    
    // Copy schema file
    await fs.copyFile(schemaSource, schemaDest);
  } catch {
    // Ignore schema copy errors (package might already have it)
  }
}