import { defineConfig } from "mygo-cli";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const bundleVersion = version.split("-")[0];
const notaryProfile = process.env.MORILO_NOTARY_PROFILE;

export default defineConfig({
  name: "Morilo",
  slug: "morilo",
  identifier: "dev.morilo.app",
  version,
  updates: {
    publicKey: "lpLJF9W47ZAJT9LyUgaZr8muqN8ErcW6PM6vL9chWQY=",
    github: "hifizz/morilo",
  },
  macos: {
    minimumSystemVersion: "13.5",
    signingIdentity: process.env.MORILO_SIGN_IDENTITY || "-",
    helperEntitlements: {
      "runtime/bin/node": "runtime/node.entitlements.plist",
    },
    notarize: notaryProfile ? {
      keychainProfile: notaryProfile,
      keychain: process.env.MORILO_NOTARY_KEYCHAIN,
    } : undefined,
    infoPlist: {
      CFBundleVersion: bundleVersion,
      CFBundleShortVersionString: bundleVersion,
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
