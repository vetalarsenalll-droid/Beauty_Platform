import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";

const root = process.cwd();
const implementationPlanPath = path.join(root, "CRM_AGENT_V2_IMPLEMENTATION_PLAN.md");
const actionsRoot = path.join(root, "apps/web/lib/crm-agent-v2/actions");
const reportPath = path.join(root, "docs/CRM_AGENT_V2_SECTION13_ACTION_CATALOG_TEST_REPORT.md");
const jiti = createJiti(path.join(root, "apps/web/test-entry.js"), {
  alias: { "@": path.join(root, "apps/web") },
});
const {
  listCrmAgentCatalogActions,
  listPlannerVisibleCrmAgentCatalogActions,
  listExecutableCrmAgentCatalogActions,
} = jiti("./lib/crm-agent-v2/actions/registry.ts");

const allowedStatuses = new Set(["implemented", "draft_only", "read_only", "planned", "blocked", "unsupported"]);
const allowedKinds = new Set(["read", "write", "generate", "export", "system"]);
const allowedIntents = new Set(["read", "create", "update", "delete", "analyze", "notify", "execute"]);
const allowedRisks = new Set(["low", "medium", "high", "critical"]);
const allowedConfirmations = new Set(["never", "medium_plus", "always", "separate_sensitive_confirm"]);

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function extractSection13Actions(planText) {
  const start = planText.indexOf("## 13.");
  const end = planText.indexOf("## 14.", start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Cannot find section 13 action catalog in CRM_AGENT_V2_IMPLEMENTATION_PLAN.md.");
  }

  const actions = [];
  let section = "13";
  for (const line of planText.slice(start, end).split(/\r?\n/)) {
    const heading = line.match(/^###\s+(13\.\d+)\s+(.+)$/);
    if (heading) section = `${heading[1]} ${heading[2].trim()}`;
    const action = line.trim().match(/^([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)$/)?.[1];
    if (action) actions.push({ name: action, section });
  }
  return actions;
}

function listActionSourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith(".ts")) files.push(full);
    }
  };
  walk(actionsRoot);
  return files;
}

function normalizePath(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

function markdownTable(rows, columns) {
  if (!rows.length) return "_Нет._";
  return [
    `| ${columns.map((column) => column.title).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(row[column.key] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
}

const planActions = extractSection13Actions(read(implementationPlanPath));
const planByName = new Map(planActions.map((action) => [action.name, action]));
const planNames = new Set(planActions.map((action) => action.name));
const catalog = listCrmAgentCatalogActions();
const catalogByName = new Map(catalog.map((action) => [action.name, action]));
const sourceFiles = listActionSourceFiles();
const sourceByAction = new Map();

for (const file of sourceFiles) {
  const source = read(file);
  for (const match of source.matchAll(/name:\s*"([^"]+)"/g)) {
    if (!sourceByAction.has(match[1])) sourceByAction.set(match[1], file);
  }
}

const failures = [];
const warnings = [];
const rows = [];

for (const action of planActions) {
  const definition = catalogByName.get(action.name);
  const sourceFile = sourceByAction.get(action.name);
  const rowFailures = [];
  const rowWarnings = [];

  if (!definition) {
    rowFailures.push("missing_in_registry");
  } else {
    if (!allowedStatuses.has(definition.status)) rowFailures.push(`invalid_status:${definition.status}`);
    if (!allowedKinds.has(definition.kind)) rowFailures.push(`invalid_kind:${definition.kind}`);
    if (!allowedIntents.has(definition.intent)) rowFailures.push(`invalid_intent:${definition.intent}`);
    if (!allowedRisks.has(definition.risk)) rowFailures.push(`invalid_risk:${definition.risk}`);
    if (!allowedConfirmations.has(definition.confirmation)) rowFailures.push(`invalid_confirmation:${definition.confirmation}`);
    if (!definition.domain?.trim()) rowFailures.push("missing_domain");
    if (!definition.permission?.trim()) rowFailures.push("missing_permission");
    if (!definition.description?.trim()) rowFailures.push("missing_description");
    if (!Array.isArray(definition.requiredSlots)) rowFailures.push("requiredSlots_not_array");
    if (!Array.isArray(definition.optionalSlots)) rowFailures.push("optionalSlots_not_array");
    if (!Array.isArray(definition.plannerHints) || !definition.plannerHints.length) rowWarnings.push("missing_planner_hints");

    if (definition.status === "read_only" && typeof definition.read !== "function") rowFailures.push("read_only_without_read_handler");
    if (definition.status === "implemented" && definition.kind !== "read" && typeof definition.execute !== "function") {
      rowFailures.push("implemented_write_without_execute");
    }
    if (definition.status === "implemented" && definition.kind !== "read" && typeof definition.preview !== "function") {
      rowFailures.push("implemented_write_without_preview");
    }
    if ((definition.risk === "high" || definition.risk === "critical") && definition.confirmation === "never") {
      rowFailures.push("high_risk_without_confirmation");
    }
    if (definition.risk === "critical" && definition.confirmation !== "separate_sensitive_confirm") {
      rowFailures.push("critical_without_separate_confirmation");
    }
  }

  if (!sourceFile) rowFailures.push("missing_action_file");

  for (const issue of rowFailures) failures.push(`${action.name}: ${issue}`);
  for (const issue of rowWarnings) warnings.push(`${action.name}: ${issue}`);

  rows.push({
    section: action.section,
    action: action.name,
    status: definition?.status ?? "missing",
    kind: definition?.kind ?? "",
    risk: definition?.risk ?? "",
    confirmation: definition?.confirmation ?? "",
    permission: definition?.permission ?? "",
    file: sourceFile ? normalizePath(sourceFile) : "",
    result: rowFailures.length ? `FAIL: ${rowFailures.join(", ")}` : rowWarnings.length ? `WARN: ${rowWarnings.join(", ")}` : "PASS",
  });
}

const duplicatePlanActions = planActions
  .map((action) => action.name)
  .filter((name, index, names) => names.indexOf(name) !== index);
for (const name of new Set(duplicatePlanActions)) failures.push(`${name}: duplicate_in_section_13`);

const extraInRegistry = catalog.filter((action) => !planNames.has(action.name)).map((action) => action.name).sort();
for (const action of extraInRegistry) warnings.push(`${action}: extra_in_registry_not_in_section_13`);

const duplicateRegistryActions = catalog
  .map((action) => action.name)
  .filter((name, index, names) => names.indexOf(name) !== index);
for (const name of new Set(duplicateRegistryActions)) failures.push(`${name}: duplicate_in_registry`);

const plannerVisible = listPlannerVisibleCrmAgentCatalogActions();
const executable = listExecutableCrmAgentCatalogActions();
const now = new Date().toISOString();
const report = [
  "# CRM Agent v2 Section 13 Action Catalog Test Report",
  "",
  `Generated: ${now}`,
  "",
  "## Summary",
  "",
  markdownTable(
    [
      { metric: "Section 13 actions", value: planActions.length },
      { metric: "Registry actions", value: catalog.length },
      { metric: "Planner-visible actions", value: plannerVisible.length },
      { metric: "Executable actions", value: executable.length },
      { metric: "Failures", value: failures.length },
      { metric: "Warnings", value: warnings.length },
      { metric: "Extra registry actions", value: extraInRegistry.length },
    ],
    [
      { key: "metric", title: "Metric" },
      { key: "value", title: "Value" },
    ],
  ),
  "",
  "## Status Counts",
  "",
  markdownTable(
    countBy(catalog, (action) => action.status).map(([status, count]) => ({ status, count })),
    [
      { key: "status", title: "Status" },
      { key: "count", title: "Count" },
    ],
  ),
  "",
  "## Domain Counts",
  "",
  markdownTable(
    countBy(catalog, (action) => action.domain).map(([domain, count]) => ({ domain, count })),
    [
      { key: "domain", title: "Domain" },
      { key: "count", title: "Count" },
    ],
  ),
  "",
  "## Failures",
  "",
  failures.length ? failures.map((failure) => `- ${failure}`).join("\n") : "_Нет._",
  "",
  "## Warnings",
  "",
  warnings.length ? warnings.map((warning) => `- ${warning}`).join("\n") : "_Нет._",
  "",
  "## Per-Action Results",
  "",
  markdownTable(rows, [
    { key: "section", title: "Section" },
    { key: "action", title: "Action" },
    { key: "status", title: "Status" },
    { key: "kind", title: "Kind" },
    { key: "risk", title: "Risk" },
    { key: "confirmation", title: "Confirmation" },
    { key: "permission", title: "Permission" },
    { key: "file", title: "File" },
    { key: "result", title: "Result" },
  ]),
  "",
].join("\n");

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report, "utf8");

if (failures.length) {
  console.error(`CRM Agent v2 Section 13 action catalog test failed: ${failures.length} failures. Report: ${normalizePath(reportPath)}`);
  console.error(failures.slice(0, 20).join("\n"));
  process.exit(1);
}

console.log(
  `CRM Agent v2 Section 13 action catalog passed: ${planActions.length} actions, ${catalog.length} registry entries, ${warnings.length} warnings. Report: ${normalizePath(reportPath)}`,
);
