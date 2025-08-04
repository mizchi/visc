
/**
 * @type {import('./v2/index.js').StabilityCheckOptions}
 */
export default {
  minIterations: 3,
  maxIterations: 10,
  viewport: { width: 1280, height: 720 },
  delay: 1000, // 1 second delay between checks
  targetStability: 95, // 95% stability
};
