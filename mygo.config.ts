import { defineConfig } from "mygo-cli";

export default defineConfig({
  name: "Morilo",
  slug: "morilo",
  identifier: "dev.morilo.app",
  version: "0.1.0",
  macos: {
    infoPlist: {
      NSMicrophoneUsageDescription: "Morilo uses the microphone for the input level test in Settings.",
    },
  },

  devUrl: "http://localhost:3000",
  devCommand: "npm --prefix frontend run dev",
  buildCommand: "npm --prefix frontend run build",
  frontendDist: "frontend/dist",
  bindings: "frontend/src/mygo.ts",
  out: "build",
});
