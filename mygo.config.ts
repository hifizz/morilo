import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "Grokbot",
  slug: "grokbot",
  identifier: "dev.grokbot.app",
  version: "0.1.0",

  devUrl: "http://localhost:3000",
  devCommand: "npm --prefix frontend run dev",
  buildCommand: "npm --prefix frontend run build",
  frontendDist: "frontend/dist",
  bindings: "frontend/src/mygo.ts",
  out: "build",
});
