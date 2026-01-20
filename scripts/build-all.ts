#!/usr/bin/env bun
// Build script for all platforms

import { $ } from "bun";

const platforms = [
  { target: "bun-darwin-arm64", output: "hba-macos-arm64" },
  { target: "bun-darwin-x64", output: "hba-macos-x64" },
  { target: "bun-linux-x64", output: "hba-linux-x64" },
  { target: "bun-linux-arm64", output: "hba-linux-arm64" },
  { target: "bun-windows-x64", output: "hba-windows-x64.exe" },
];

console.log("🚀 Building for all platforms...\n");

for (const platform of platforms) {
  console.log(`Building ${platform.output}...`);

  try {
    await $`bun build --compile --minify --target=${platform.target} src/cli.ts --outfile dist/${platform.output}`;
    console.log(`✅ ${platform.output} built successfully\n`);
  } catch (error) {
    console.error(`❌ Failed to build ${platform.output}`);
    console.error(error);
  }
}

console.log("✨ Build complete!");
console.log("📦 Binaries are in dist/ directory");
