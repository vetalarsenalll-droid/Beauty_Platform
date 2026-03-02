const { spawnSync } = require("node:child_process");
const path = require("node:path");

function runNodeScript(scriptRelativePath, args = []) {
  const scriptPath = path.resolve(__dirname, scriptRelativePath);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Script failed: ${scriptRelativePath}`);
  }
}

function main() {
  console.log("=== RU reseed: account + data ===");
  runNodeScript("reseed-russian-salon.js");

  console.log("=== RU reseed: account legal docs ===");
  runNodeScript("reseed-legal-docs.js", ["severnaya-orhideya"]);

  console.log("=== RU reseed: platform legal docs ===");
  runNodeScript("seed-platform-legal-docs.js");

  console.log("Full Russian reseed completed.");
}

try {
  main();
} catch (error) {
  console.error("Full reseed failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
