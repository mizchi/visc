# Configuration Inheritance

Visual Checker supports three levels of configuration inheritance, allowing you to define settings at different scopes and override them as needed.

## Inheritance Hierarchy

Settings are inherited and overridden in the following order (highest priority wins):

1. **Global Settings** (lowest priority) - Applied to all test cases
2. **Phase-specific Settings** - Can override global settings for capture or compare phases
3. **Test Case Settings** (highest priority) - Override all other settings for specific tests

## Configuration Structure

```json
{
  "version": "1.0",
  
  // Global settings - applied to all test cases
  "captureOptions": {
    "waitUntil": "networkidle0",
    "waitForLCP": true,
    "additionalWait": 1000,
    "networkBlocks": ["**/analytics.js"]
  },
  
  "compareOptions": {
    "ignoreText": true,
    "threshold": 0.05,
    "similarityThreshold": 0.98,
    "useVisualGroups": true
  },
  
  "retry": 2, // Global retry count
  
  "testCases": [
    {
      "id": "homepage",
      "url": "https://example.com",
      
      // Test case specific settings - override global
      "captureOptions": {
        "additionalWait": 2000, // Override global 1000ms
        "timeout": 60000 // Add new setting
      },
      
      "compareOptions": {
        "threshold": 0.10 // Override global 0.05
      },
      
      "retry": 3 // Override global retry count
    }
  ]
}
```

## How Inheritance Works

### Deep Merging
- Objects are deeply merged, allowing partial overrides
- Primitive values (strings, numbers, booleans) are replaced
- Arrays are replaced entirely, not merged

### Example: Network Blocks

```json
{
  // Global
  "captureOptions": {
    "networkBlocks": ["**/global1.js", "**/global2.js"]
  },
  
  "testCases": [{
    "id": "test1",
    "url": "https://example.com",
    // Test case specific - replaces entire array
    "captureOptions": {
      "networkBlocks": ["**/test-specific.js"] // Only this will be used
    }
  }]
}
```

### Example: Overrides Object

```json
{
  // Global
  "captureOptions": {
    "overrides": {
      "pattern1": "file1.js",
      "pattern2": "file2.js"
    }
  },
  
  "testCases": [{
    "id": "test1",
    "url": "https://example.com",
    // Test case specific - merges with global
    "captureOptions": {
      "overrides": {
        "pattern2": "override2.js", // Overrides global
        "pattern3": "file3.js" // Adds new
      }
    }
    // Result: {"pattern1": "file1.js", "pattern2": "override2.js", "pattern3": "file3.js"}
  }]
}
```

## Phase-specific Settings

Compare phase can have different settings than capture phase:

```json
{
  // Capture phase settings
  "captureOptions": {
    "networkBlocks": ["**/analytics.js"],
    "additionalWait": 1000
  },
  
  // Compare phase settings (can override capture settings)
  "compareOptions": {
    "networkBlocks": ["**/analytics.js", "**/ads.js"], // More blocks for compare
    "overrides": {
      "**/*.css": "./modified.css" // Test with modified CSS
    },
    "threshold": 0.10,
    "similarityThreshold": 0.95
  }
}
```

## Real-world Example

```json
{
  "version": "1.0",
  
  // Default settings for most pages
  "captureOptions": {
    "waitUntil": "networkidle0",
    "waitForLCP": true,
    "additionalWait": 500,
    "networkBlocks": [
      "**/gtag/**",
      "**/google-analytics.com/**",
      "**/facebook.com/**"
    ]
  },
  
  "compareOptions": {
    "ignoreText": false,
    "threshold": 0.05,
    "similarityThreshold": 0.98,
    "useVisualGroups": true
  },
  
  "retry": 1,
  
  "testCases": [
    {
      "id": "homepage",
      "url": "https://example.com",
      "description": "Static homepage - use default settings"
      // Uses all global settings
    },
    {
      "id": "dashboard",
      "url": "https://example.com/dashboard",
      "description": "Dynamic dashboard - needs more wait time",
      "captureOptions": {
        "additionalWait": 3000, // Override: wait longer for dynamic content
        "timeout": 60000 // Override: longer timeout
      },
      "compareOptions": {
        "threshold": 0.10, // Override: more lenient for dynamic content
        "ignoreText": true // Override: ignore dynamic text
      },
      "retry": 3 // Override: more retries for flaky page
    },
    {
      "id": "checkout",
      "url": "https://example.com/checkout",
      "description": "Checkout page - strict comparison",
      "compareOptions": {
        "threshold": 0.02, // Override: stricter threshold
        "similarityThreshold": 0.99, // Override: require higher similarity
        "ignoreText": false // Keep text comparison
      }
    }
  ]
}
```

## Debugging Configuration

Set the `DEBUG_CONFIG` environment variable to see the effective configuration for each test case:

```bash
DEBUG_CONFIG=1 visc check
```

This will output the merged configuration for each test case:

```
📋 Effective capture options for test case "dashboard":
{
  "waitUntil": "networkidle0",
  "waitForLCP": true,
  "additionalWait": 3000,
  "timeout": 60000,
  "networkBlocks": ["**/gtag/**", "**/google-analytics.com/**", "**/facebook.com/**"]
}

📋 Effective compare options for test case "dashboard":
{
  "ignoreText": true,
  "threshold": 0.10,
  "similarityThreshold": 0.98,
  "useVisualGroups": true
}
```

## Best Practices

1. **Use global settings for common configurations** - Define defaults that work for most test cases
2. **Override at test case level for exceptions** - Only override what needs to be different
3. **Use phase-specific settings for testing scenarios** - e.g., test with modified CSS in compare phase
4. **Keep arrays simple** - Remember arrays are replaced entirely, not merged
5. **Document overrides** - Use the `description` field to explain why settings are overridden