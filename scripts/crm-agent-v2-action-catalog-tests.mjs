import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const planPath = path.join(root, "CRM_AGENT_V2_FULL_ACTION_CATALOG_PLAN.md");
const actionsRoot = path.join(root, "apps/web/lib/crm-agent-v2/actions");
const planText = fs.readFileSync(planPath, "utf8");
const start = planText.indexOf("### 8.1 ");
const end = planText.indexOf("## 9. ");

if (start < 0 || end < 0 || end <= start) {
  throw new Error("Cannot find section 8 action catalog in CRM_AGENT_V2_FULL_ACTION_CATALOG_PLAN.md.");
}

const rows = [];
for (const line of planText.slice(start, end).split(/\r?\n/)) {
  if (!line.startsWith("| ")) continue;
  if (line.includes("---") || line.includes("Action | Meaning")) continue;

  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells.length !== 7) continue;

  const [name, meaning, kind, risk, confirmation, permission, file] = cells;
  rows.push({ name, meaning, kind, risk, confirmation, permission, file });
}

const failures = [];
const seen = new Set();

for (const row of rows) {
  if (seen.has(row.name)) failures.push(`Duplicate action in plan: ${row.name}`);
  seen.add(row.name);

  const relativeFile = row.file.replace(/^actions\//, "");
  const actionPath = path.join(actionsRoot, ...relativeFile.split("/"));
  if (!fs.existsSync(actionPath)) {
    failures.push(`Missing action file for ${row.name}: ${row.file}`);
    continue;
  }

  const source = fs.readFileSync(actionPath, "utf8");
  const expectations = [
    ["name", row.name],
    ["kind", row.kind],
    ["risk", row.risk],
    ["permission", row.permission],
    ["confirmation", row.confirmation],
    ["description", row.meaning],
  ];

  for (const [field, value] of expectations) {
    if (!source.includes(`${field}: ${JSON.stringify(value)}`)) {
      failures.push(`Action ${row.name} file does not declare ${field}: ${value}`);
    }
  }
}

const registryPath = path.join(actionsRoot, "registry.ts");
const registrySource = fs.readFileSync(registryPath, "utf8");
const domains = new Set(rows.map((row) => row.file.replace(/^actions\//, "").split("/")[0]));

for (const domain of domains) {
  if (!fs.existsSync(path.join(actionsRoot, domain, "index.ts"))) {
    failures.push(`Missing domain index: actions/${domain}/index.ts`);
  }

  if (!registrySource.includes(`from "./${domain}"`)) {
    failures.push(`Registry does not import domain actions: ${domain}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`CRM Agent v2 action catalog skeleton is complete: ${rows.length} actions across ${domains.size} domains.`);
