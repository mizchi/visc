// import { dts } from "rolldown-plugin-dts";

export default {
  input: "./src/index.ts",
  platform: "node",
  // plugins: [dts()], // 一時的に無効化
  output: [{ dir: "dist", format: "es" }],
};