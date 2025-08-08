# Calculation Utilities

Visual Checker provides a comprehensive set of calculation utilities for layout analysis, text comparison, and set operations. These utilities are available both as CLI commands and as importable functions.

## CLI Usage

The `visc calc` command provides direct access to all calculation functions.

### Point Distance Calculations

Calculate distances between two points in various metrics:

```bash
# Euclidean distance (default)
visc calc point-distance 0,0 100,100
# Output: 141.42

# Manhattan distance
visc calc point-distance --manhattan 0,0 100,100
# Output: 200.00

# All metrics at once
visc calc point-distance --all 0,0 100,100
# Output:
#   Euclidean: 141.42
#   Manhattan: 200.00
#   Chebyshev: 100.00
```

### Rectangle Calculations

#### Rectangle Distance

```bash
# Center-to-center distance
visc calc rect-distance 0,0,100,100 150,150,100,100
# Output: 212.13

# Minimum edge-to-edge distance
visc calc rect-distance --min 0,0,100,100 150,150,100,100
# Output: 70.71
```

#### Rectangle Overlap and IoU

```bash
# Calculate overlap area
visc calc rect-overlap 0,0,100,100 50,50,100,100
# Output:
#   Overlap Area: 2500 px²
#   Rect1 Area: 10000 px²
#   Rect2 Area: 10000 px²

# Calculate Intersection over Union
visc calc rect-iou 0,0,100,100 50,50,100,100
# Output:
#   IoU: 14.3%
#   Assessment: Low overlap
```

### Text Similarity Calculations

#### Edit Distance

```bash
# Levenshtein distance
visc calc text-distance "button" "buton"
# Output: 1

# Normalized distance (0-1)
visc calc text-distance --normalized "button" "buton"
# Output: 0.167
```

#### Similarity Metrics

```bash
# Fuzzy string match (default, combines multiple metrics)
visc calc text-similarity "Submit Button" "Submitt Buttn"
# Output: 0.854

# Jaro-Winkler similarity
visc calc text-similarity --jaro-winkler "button" "buton"
# Output: 0.944

# All metrics comparison
visc calc text-similarity --all "hello" "helo"
# Output:
#   Levenshtein: 0.800
#   Jaro: 0.933
#   Jaro-Winkler: 0.960
#   Dice: 0.778
#   Token: 0.000
#   Fuzzy: 0.668
#   LCS Length: 4
#   LCSS Length: 3
```

### Set Operations

#### Set Similarity

```bash
# Jaccard similarity (default)
visc calc set-similarity "btn primary large" "btn primary disabled"
# Output: 0.500

# Dice coefficient
visc calc set-similarity --dice "apple banana orange" "apple banana grape"
# Output: 0.667

# All metrics
visc calc set-similarity --all "a b c" "b c d"
# Output:
#   Jaccard: 0.500
#   Dice: 0.667
#   Overlap: 0.667
#   Cosine: 0.577
#   Edit Distance: 2
#   Normalized Edit: 0.333
```

#### Accessibility Attributes

```bash
# Compare ARIA attributes
visc calc aria-similarity "role=button aria-label=Submit" "role=button aria-label=Submit aria-disabled=true"
# Output:
#   Similarity: 83.3%
#   Matched: role, aria-label
#   Only in first: none
#   Only in second: aria-disabled
```

### Size and Aspect Ratio

```bash
# Compare sizes and aspect ratios
visc calc size-diff 1920,1080 1280,720
# Output:
#   Size 1: 1920×1080 (ratio: 1.78)
#   Size 2: 1280×720 (ratio: 1.78)
#   Size Difference: 33.3%
#   Aspect Ratio Diff: 0.0%
```

## Programmatic Usage

All calculation functions are available for import from the `@visual-checker/core` module.

### Basic Import

```typescript
import { 
  euclideanDistance, 
  rectIoU, 
  fuzzyStringMatch,
  jaccardSimilarity 
} from 'visual-checker/core';
```

### Layout Distance Examples

```typescript
import { 
  euclideanDistance,
  manhattanDistance,
  rectIoU,
  weightedLayoutDistance
} from 'visual-checker/core';

// Calculate point distances
const p1 = { x: 0, y: 0 };
const p2 = { x: 100, y: 100 };
const distance = euclideanDistance(p1, p2); // 141.42

// Rectangle comparison
const rect1 = { x: 0, y: 0, width: 100, height: 100 };
const rect2 = { x: 50, y: 50, width: 100, height: 100 };
const iou = rectIoU(rect1, rect2); // 0.143

// Weighted layout distance
const layoutDistance = weightedLayoutDistance(rect1, rect2, {
  position: 0.4,
  size: 0.4,
  aspectRatio: 0.2
});
```

### Text Similarity Examples

```typescript
import {
  levenshteinDistance,
  jaroWinklerSimilarity,
  fuzzyStringMatch,
  areStringsSimilar
} from 'visual-checker/core';

// Edit distance
const editDist = levenshteinDistance("kitten", "sitting"); // 3

// Jaro-Winkler for typo detection
const similarity = jaroWinklerSimilarity("button", "buton"); // 0.944

// Fuzzy matching with combined metrics
const fuzzyScore = fuzzyStringMatch("Submit Button", "Submitt Buttn"); // 0.854

// Threshold-based similarity check
const isSimilar = areStringsSimilar("hello", "helo", 0.8); // true
```

### Set Operations Examples

```typescript
import {
  jaccardSimilarity,
  diceSimilarity,
  accessibilitySimilarity,
  setEditDistance
} from 'visual-checker/core';

// CSS class comparison
const classes1 = new Set(['btn', 'btn-primary', 'large']);
const classes2 = new Set(['btn', 'btn-primary', 'disabled']);
const jaccard = jaccardSimilarity(classes1, classes2); // 0.5

// Accessibility attribute comparison
const attrs1 = { role: 'button', 'aria-label': 'Submit' };
const attrs2 = { role: 'button', 'aria-label': 'Submit', 'aria-disabled': 'true' };
const a11yResult = accessibilitySimilarity(attrs1, attrs2);
// a11yResult.similarity: 0.833
// a11yResult.matchedAttributes: Set(['role', 'aria-label'])

// Measure changes
const before = new Set(['feat1', 'feat2', 'feat3']);
const after = new Set(['feat2', 'feat3', 'feat4']);
const changes = setEditDistance(before, after); // 2 operations
```

### High-Level Utilities

```typescript
import {
  calculateElementSimilarity,
  findBestMatch,
  calculateLayoutShift,
  findElementClusters
} from 'visual-checker/core';

// Comprehensive element comparison
const element1 = {
  position: { x: 100, y: 100 },
  size: { width: 200, height: 50 },
  text: "Submit",
  classes: ['btn', 'primary']
};

const element2 = {
  position: { x: 105, y: 102 },
  size: { width: 200, height: 50 },
  text: "Submit",
  classes: ['btn', 'primary', 'hover']
};

const similarity = calculateElementSimilarity(element1, element2);
// Returns weighted similarity score considering all factors

// Find best matching element
const target = { text: "Login", classes: ['btn'] };
const candidates = [
  { text: "Login", classes: ['btn', 'primary'] },
  { text: "Sign In", classes: ['btn'] },
  { text: "Register", classes: ['btn'] }
];
const bestMatch = findBestMatch(target, candidates);
// Returns: { element: candidates[0], similarity: 0.85 }

// Calculate layout shift (CLS-like metric)
const beforeLayout = [
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 0, y: 100, width: 100, height: 100 }
];
const afterLayout = [
  { x: 0, y: 10, width: 100, height: 100 },  // Shifted down
  { x: 0, y: 110, width: 100, height: 100 }
];
const viewport = { width: 1920, height: 1080 };
const cls = calculateLayoutShift(beforeLayout, afterLayout, viewport);

// Find clusters of nearby elements
const elements = [
  { x: 0, y: 0, width: 50, height: 50 },
  { x: 60, y: 0, width: 50, height: 50 },
  { x: 200, y: 200, width: 50, height: 50 }
];
const clusters = findElementClusters(elements, 100);
// Returns: [[elements[0], elements[1]], [elements[2]]]
```

## Algorithm Selection Guide

### Distance Metrics

- **Euclidean**: Standard geometric distance, use for general position comparison
- **Manhattan**: Grid-based distance, use for keyboard navigation or grid layouts
- **Chebyshev**: Maximum coordinate difference, use for diagonal movement detection
- **IoU**: Area-based overlap, use for element matching and visual regression

### Text Similarity

- **Levenshtein**: General edit distance, good for typo detection
- **Jaro-Winkler**: Optimized for short strings and typos at the beginning
- **Dice Coefficient**: Character bigram comparison, good for reordered text
- **Fuzzy Match**: Combined metrics, best for general text similarity
- **Token Similarity**: Word-level comparison, good for sentence matching

### Set Operations

- **Jaccard**: Standard set similarity, size-sensitive
- **Dice**: Emphasizes common elements, good for small sets
- **Overlap**: Subset relationships, use for "contains all" checks
- **Cosine**: Normalized similarity, good for different-sized sets
- **Edit Distance**: Measure of change operations needed

## Performance Considerations

### Batch Operations

For multiple comparisons, use batch functions to improve performance:

```typescript
import { batchCalculateDistances } from 'visual-checker/core';

const points = [
  { x: 0, y: 0 },
  { x: 100, y: 100 },
  { x: 200, y: 50 }
];

// Calculate all pairwise distances efficiently
const distanceMatrix = batchCalculateDistances(points, 'euclidean');
// Returns 3x3 matrix of distances
```

### Caching Results

When comparing many elements, cache similarity calculations:

```typescript
const similarityCache = new Map();

function getCachedSimilarity(id1: string, id2: string, calc: () => number) {
  const key = `${id1}-${id2}`;
  if (!similarityCache.has(key)) {
    similarityCache.set(key, calc());
  }
  return similarityCache.get(key);
}
```

## Use Cases

### Visual Regression Testing

```typescript
// Detect significant layout changes
const threshold = 0.05; // 5% tolerance
const iou = rectIoU(oldPosition, newPosition);
if (iou < 1 - threshold) {
  console.log('Layout shift detected');
}
```

### Element Matching Across Versions

```typescript
// Find corresponding elements after UI update
const oldElements = extractElements(oldVersion);
const newElements = extractElements(newVersion);

const matches = oldElements.map(old => ({
  old,
  new: findBestMatch(old, newElements, 0.7)
}));
```

### Accessibility Validation

```typescript
// Ensure ARIA attributes are preserved
const a11yCheck = accessibilitySimilarity(oldAttrs, newAttrs);
if (a11yCheck.similarity < 0.9) {
  console.warn('Accessibility attributes changed:', a11yCheck.uniqueToSecond);
}
```

### Content Similarity Detection

```typescript
// Find duplicate or similar content
const contents = getAllTextContent();
const duplicates = [];

for (let i = 0; i < contents.length; i++) {
  for (let j = i + 1; j < contents.length; j++) {
    if (fuzzyStringMatch(contents[i], contents[j]) > 0.9) {
      duplicates.push([i, j]);
    }
  }
}
```

## Integration with Visual Checker

These utilities form the foundation of Visual Checker's comparison engine. They are used internally for:

1. **Layout Comparison**: Detecting position and size changes
2. **Text Validation**: Identifying content modifications
3. **Attribute Matching**: Tracking CSS and ARIA changes
4. **Element Correspondence**: Matching elements across versions
5. **Change Quantification**: Measuring the degree of visual changes

By exposing these as standalone utilities, you can:
- Build custom comparison logic
- Create specialized validators
- Implement domain-specific metrics
- Integrate with other testing frameworks
- Perform ad-hoc calculations during debugging