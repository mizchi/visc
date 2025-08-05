export default [
  {
    input: "./src/index.ts",
    platform: "node",
    output: [{ dir: "dist", format: "es" }],
  },
  {
    input: "./src/cli/cli.ts",
    platform: "node",
    output: [{ dir: "dist", format: "es", chunkNames: "[name]" }],
  },
];
