import type { 
  ThresholdConfig,
  VisualDifference,
  SemanticDifferenceDetection,
  VisualTreeAnalysis
} from './types.js';

export interface ThresholdEvaluation {
  passed: boolean;
  failures: ThresholdFailure[];
  warnings: ThresholdWarning[];
}

export interface ThresholdFailure {
  type: string;
  message: string;
  measuredValue: number;
  threshold: number;
  severity: 'error';
}

export interface ThresholdWarning {
  type: string;
  message: string;
  measuredValue: number;
  threshold?: number;
  severity: 'warning';
}

/**
 * Evaluates differences against threshold configuration
 */
export function evaluateThresholds(
  config: ThresholdConfig,
  differences: VisualDifference[],
  similarity: number,
  currentAnalysis?: VisualTreeAnalysis,
  previousAnalysis?: VisualTreeAnalysis
): ThresholdEvaluation {
  const failures: ThresholdFailure[] = [];
  const warnings: ThresholdWarning[] = [];
  
  // Evaluate similarity threshold (percentage-based)
  if (config.similarityThreshold !== undefined) {
    if (similarity < config.similarityThreshold) {
      failures.push({
        type: 'similarity',
        message: `類似度が閾値を下回っています (${similarity.toFixed(1)}% < ${config.similarityThreshold}%)`,
        measuredValue: similarity,
        threshold: config.similarityThreshold,
        severity: 'error'
      });
    }
  }
  
  // Evaluate position threshold (absolute pixels)
  if (config.positionThreshold?.enabled) {
    const positionDiffs = differences
      .filter(d => d.positionDiff !== undefined)
      .map(d => d.positionDiff!);
    
    const maxPositionDiff = Math.max(...positionDiffs, 0);
    
    if (config.positionThreshold.strict) {
      // Strict mode: any position change above threshold fails
      if (maxPositionDiff > config.positionThreshold.value) {
        failures.push({
          type: 'position',
          message: `位置の変更が閾値を超えています (${maxPositionDiff}px > ${config.positionThreshold.value}px)`,
          measuredValue: maxPositionDiff,
          threshold: config.positionThreshold.value,
          severity: 'error'
        });
      }
    } else {
      // Non-strict mode: warn about position changes
      const significantShifts = positionDiffs.filter(d => d > config.positionThreshold!.value);
      if (significantShifts.length > 0) {
        warnings.push({
          type: 'position',
          message: `${significantShifts.length}個の要素で位置変更を検出 (最大: ${maxPositionDiff}px)`,
          measuredValue: maxPositionDiff,
          threshold: config.positionThreshold.value,
          severity: 'warning'
        });
      }
    }
  }
  
  // Evaluate size threshold (absolute pixels and optional percentage)
  if (config.sizeThreshold?.enabled) {
    const sizeDiffs = differences
      .filter(d => d.sizeDiff !== undefined)
      .map(d => d.sizeDiff!);
    
    const maxSizeDiff = Math.max(...sizeDiffs, 0);
    
    if (maxSizeDiff > config.sizeThreshold.value) {
      const message = config.sizeThreshold.percentage 
        ? `サイズ変更が閾値を超えています (${maxSizeDiff}px > ${config.sizeThreshold.value}px)`
        : `サイズ変更を検出 (${maxSizeDiff}px)`;
      
      failures.push({
        type: 'size',
        message,
        measuredValue: maxSizeDiff,
        threshold: config.sizeThreshold.value,
        severity: 'error'
      });
    }
  }
  
  // Evaluate element count thresholds
  if (config.elementCountThreshold) {
    const addedCount = differences.filter(d => d.type === 'added').length;
    const removedCount = differences.filter(d => d.type === 'removed').length;
    const modifiedCount = differences.filter(d => d.type === 'modified').length;
    
    if (config.elementCountThreshold.added !== undefined && addedCount > config.elementCountThreshold.added) {
      failures.push({
        type: 'elementCount',
        message: `追加要素数が閾値を超えています (${addedCount} > ${config.elementCountThreshold.added})`,
        measuredValue: addedCount,
        threshold: config.elementCountThreshold.added,
        severity: 'error'
      });
    }
    
    if (config.elementCountThreshold.removed !== undefined && removedCount > config.elementCountThreshold.removed) {
      failures.push({
        type: 'elementCount',
        message: `削除要素数が閾値を超えています (${removedCount} > ${config.elementCountThreshold.removed})`,
        measuredValue: removedCount,
        threshold: config.elementCountThreshold.removed,
        severity: 'error'
      });
    }
    
    if (config.elementCountThreshold.modified !== undefined && modifiedCount > config.elementCountThreshold.modified) {
      failures.push({
        type: 'elementCount',
        message: `変更要素数が閾値を超えています (${modifiedCount} > ${config.elementCountThreshold.modified})`,
        measuredValue: modifiedCount,
        threshold: config.elementCountThreshold.modified,
        severity: 'error'
      });
    }
  }
  
  // Evaluate scroll threshold
  if (config.scrollThreshold?.enabled && currentAnalysis) {
    const scrollableElements = currentAnalysis.elements.filter(e => e.isScrollable).length;
    
    if (config.scrollThreshold.maxScrollableElements !== undefined && 
        scrollableElements > config.scrollThreshold.maxScrollableElements) {
      failures.push({
        type: 'scroll',
        message: `スクロール可能要素数が閾値を超えています (${scrollableElements} > ${config.scrollThreshold.maxScrollableElements})`,
        measuredValue: scrollableElements,
        threshold: config.scrollThreshold.maxScrollableElements,
        severity: 'error'
      });
    }
  }
  
  // Evaluate z-index threshold
  if (config.zIndexThreshold?.enabled && !config.zIndexThreshold.allowChanges) {
    const zIndexChanges = differences.filter(d => {
      if (d.changes) {
        return d.changes.some(c => c.property === 'zIndex');
      }
      return false;
    });
    
    if (zIndexChanges.length > 0) {
      failures.push({
        type: 'zIndex',
        message: `z-indexの変更が検出されました (${zIndexChanges.length}件)`,
        measuredValue: zIndexChanges.length,
        threshold: 0,
        severity: 'error'
      });
    }
  }
  
  return {
    passed: failures.length === 0,
    failures,
    warnings
  };
}

/**
 * Creates a default threshold configuration
 */
export function createDefaultThresholds(): ThresholdConfig {
  return {
    similarityThreshold: 95, // 95% similarity required
    positionThreshold: {
      enabled: true,
      value: 5, // 5px tolerance
      strict: false
    },
    sizeThreshold: {
      enabled: true,
      value: 10, // 10px tolerance
      percentage: 5 // or 5% change
    },
    elementCountThreshold: {
      added: 10,
      removed: 10,
      modified: 20
    },
    scrollThreshold: {
      enabled: false,
      maxScrollableElements: 5
    },
    zIndexThreshold: {
      enabled: false,
      allowChanges: true
    }
  };
}

/**
 * Creates a strict threshold configuration for critical pages
 */
export function createStrictThresholds(): ThresholdConfig {
  return {
    similarityThreshold: 99, // 99% similarity required
    positionThreshold: {
      enabled: true,
      value: 1, // Only 1px tolerance
      strict: true
    },
    sizeThreshold: {
      enabled: true,
      value: 2, // 2px tolerance
      percentage: 1 // 1% change
    },
    elementCountThreshold: {
      added: 0,
      removed: 0,
      modified: 5
    },
    scrollThreshold: {
      enabled: true,
      maxScrollableElements: 0
    },
    zIndexThreshold: {
      enabled: true,
      allowChanges: false
    }
  };
}

/**
 * Creates a relaxed threshold configuration for dynamic pages
 */
export function createRelaxedThresholds(): ThresholdConfig {
  return {
    similarityThreshold: 85, // 85% similarity required
    positionThreshold: {
      enabled: true,
      value: 20, // 20px tolerance
      strict: false
    },
    sizeThreshold: {
      enabled: true,
      value: 50, // 50px tolerance
      percentage: 10 // 10% change
    },
    elementCountThreshold: {
      added: 50,
      removed: 50,
      modified: 100
    },
    scrollThreshold: {
      enabled: false
    },
    zIndexThreshold: {
      enabled: false,
      allowChanges: true
    }
  };
}

/**
 * Merges threshold configurations
 */
export function mergeThresholds(
  base: ThresholdConfig,
  overrides: Partial<ThresholdConfig>
): ThresholdConfig {
  return {
    ...base,
    ...overrides,
    positionThreshold: overrides.positionThreshold ? {
      ...base.positionThreshold,
      ...overrides.positionThreshold
    } : base.positionThreshold,
    sizeThreshold: overrides.sizeThreshold ? {
      ...base.sizeThreshold,
      ...overrides.sizeThreshold
    } : base.sizeThreshold,
    elementCountThreshold: overrides.elementCountThreshold ? {
      ...base.elementCountThreshold,
      ...overrides.elementCountThreshold
    } : base.elementCountThreshold,
    scrollThreshold: overrides.scrollThreshold ? {
      ...base.scrollThreshold,
      ...overrides.scrollThreshold
    } : base.scrollThreshold,
    zIndexThreshold: overrides.zIndexThreshold ? {
      ...base.zIndexThreshold,
      ...overrides.zIndexThreshold
    } : base.zIndexThreshold
  };
}