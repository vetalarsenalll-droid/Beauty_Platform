import { spawnSync } from "node:child_process";

const suites = ["core", "booking-e2e", "client-actions"];

for (const suite of suites) {
  const result = spawnSync(process.execPath, ["scripts/aisha-dialog-regression.mjs", `--suite=${suite}`], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`[aisha-matrix] passed ${suites.length} suites.`);
