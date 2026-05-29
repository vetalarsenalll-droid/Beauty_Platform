import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const actionsRoot = path.join(root, "apps/web/lib/crm-agent-v2/actions");
const planPath = path.join(root, "CRM_AGENT_V2_FULL_ACTION_CATALOG_PLAN.md");
const planText = fs.readFileSync(planPath, "utf8");
const failures = [];

const actions = [];
for (const file of walk(actionsRoot)) {
  if (!file.endsWith(".ts")) continue;
  if (path.basename(file) === "index.ts") continue;
  if (path.basename(file).includes("helpers") || path.basename(file).startsWith("action-") || ["types.ts", "registry.ts", "define-action.ts"].includes(path.basename(file))) continue;
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes("defineCrmAgentAction")) continue;
  const action = {
    file,
    rel: path.relative(root, file).replaceAll(path.sep, "/"),
    source,
    name: field(source, "name"),
    kind: field(source, "kind"),
    status: field(source, "status"),
    risk: field(source, "risk"),
    permission: field(source, "permission"),
    confirmation: field(source, "confirmation"),
  };
  actions.push(action);
}

for (const action of actions) {
  check(Boolean(action.name), action, "missing action name");
  check(Boolean(action.status), action, "missing status");
  check(!action.source.includes('status: "planned"'), action, "planned status is not allowed after Step 9");
  check(Boolean(action.permission), action, "missing permission");
  check(Boolean(action.confirmation), action, "missing confirmation policy");

  if (action.status === "implemented") {
    check(hasHandler(action.source, "preview"), action, "implemented action must define preview");
    check(hasHandler(action.source, "execute"), action, "implemented action must define execute");
    check(action.kind !== "read", action, "read action must not use implemented status");
  }

  if (action.status === "draft_only") {
    check(hasHandler(action.source, "preview"), action, "draft_only action must define preview");
    check(!hasHandler(action.source, "execute"), action, "draft_only action must not define execute");
  }

  if (action.status === "read_only") {
    check(action.kind === "read" || action.kind === "generate", action, "read_only action should be read/generate");
    check(action.confirmation === "never", action, "read_only action must not require confirmation");
    check(hasHandler(action.source, "read"), action, "read_only action must define read handler");
    check(!hasHandler(action.source, "execute"), action, "read_only action must not define execute");
  }

  if (action.status === "blocked") {
    check(action.source.includes("Blocked:"), action, "blocked action must document blocker in plannerHints");
    check(!hasHandler(action.source, "execute"), action, "blocked action must not define execute");
  }

  if (["write", "system", "export"].includes(action.kind) && action.status !== "blocked") {
    check(action.permission !== "self" || action.name === "user.change_own_password", action, "mutating action cannot use self permission");
    check(hasHandler(action.source, "preview"), action, "mutating action must define preview");
  }

  if (action.risk === "medium") {
    check(action.confirmation !== "never" || action.kind === "read", action, "medium mutating action must require confirmation");
  }
  if (action.risk === "high" || action.risk === "critical") {
    check(action.confirmation === "always" || action.confirmation === "separate_sensitive_confirm", action, "high/critical action must require strong confirmation");
  }
  if (action.risk === "critical") {
    check(action.confirmation === "separate_sensitive_confirm", action, "critical action must require separate sensitive confirmation");
  }

  if (isSensitive(action) && action.kind !== "read") {
    check(action.confirmation === "always" || action.confirmation === "separate_sensitive_confirm", action, "sensitive action must require explicit confirmation");
  }

  if ((action.status === "implemented" || action.status === "read_only") && action.permission !== "self") {
    const combined = action.source + "\n" + importedLocalSources(action.file, action.source);
    check(combined.includes("accountId") || combined.includes("ctx.accountId"), action, "implemented/read action must be account scoped in action or helper source");
  }
}

const summary = countBy(actions, (action) => action.status);
check(summary.planned == null, { rel: "catalog" }, "catalog must not contain planned actions");
check(planText.includes("### Step 11. Production hardening"), { rel: "plan" }, "plan must contain Step 11");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `CRM Agent v2 hardening checks passed: ${actions.length} actions, ` +
    Object.entries(summary)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([status, count]) => `${status}=${count}`)
      .join(", "),
);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function field(source, name) {
  return source.match(new RegExp(`${name}: "([^"]+)"`))?.[1] ?? null;
}

function hasHandler(source, name) {
  return new RegExp(`\\b${name}:`).test(source);
}

function check(condition, action, message) {
  if (!condition) failures.push(`${action.rel}: ${message}`);
}

function isSensitive(action) {
  return /password|permission|role\.delete|refund|payment|export|legal|campaign\.send|notification\.send_segment|webhook\.delete/.test(action.name ?? "");
}

function importedLocalSources(file, source) {
  const dir = path.dirname(file);
  const chunks = [];
  for (const match of source.matchAll(/from "(\.\/[^"]+)"/g)) {
    const imported = path.join(dir, `${match[1]}.ts`);
    if (fs.existsSync(imported)) chunks.push(fs.readFileSync(imported, "utf8"));
  }
  return chunks.join("\n");
}

function countBy(items, fn) {
  const counts = {};
  for (const item of items) counts[fn(item)] = (counts[fn(item)] ?? 0) + 1;
  return counts;
}
