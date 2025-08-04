export default [
  {
    input: "./src/index.ts",
    platform: "node",
    output: [{ dir: "dist", format: "es" }],
  },
  {
    input: "./v2/cli.ts",
    platform: "node",
    output: [{ dir: "dist/v2", format: "es" }],
  }
];