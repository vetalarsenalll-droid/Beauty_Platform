import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "../node_modules/typescript/lib/typescript.js";

const root = process.cwd();
const inspectorPath = path.join(root, "apps/web/lib/crm-agent-v2/core/inspector.ts");
const inspectorSource = fs.readFileSync(inspectorPath, "utf8");
const compiled = ts.transpileModule(inspectorSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});

const actions = new Map();
const tools = new Map();
const moduleExports = {};
const sandbox = {
  exports: moduleExports,
  module: { exports: moduleExports },
  require(specifier) {
    if (specifier === "../actions") {
      return {
        canUseCrmAgentCatalogAction(action, permissions) {
          return action.permission === "self" || permissions.includes("crm.all") || permissions.includes(action.permission);
        },
        getCrmAgentCatalogAction(name) {
          return actions.get(name) ?? null;
        },
      };
    }

    if (specifier === "./tools") {
      return {
        canUseCrmAgentTool(name, permissions) {
          const tool = tools.get(name);
          return Boolean(tool && (permissions.includes("crm.all") || permissions.includes(tool.permission)));
        },
        getCrmAgentTool(name) {
          return tools.get(name) ?? null;
        },
      };
    }

    throw new Error(`Unexpected require in inspector unit test: ${specifier}`);
  },
};

vm.runInNewContext(compiled.outputText, sandbox, { filename: inspectorPath });
const { inspectCrmAgentPlan } = sandbox.module.exports;

function actionFixture(name, status, overrides = {}) {
  return {
    name,
    domain: "test",
    kind: "write",
    intent: "update",
    status,
    risk: "medium",
    permission: "crm.test.manage",
    confirmation: "medium_plus",
    requiredSlots: [],
    optionalSlots: [],
    description: `${name} fixture`,
    plannerHints: [],
    ...overrides,
  };
}

function planFor(actionName, type = "draft", args = {}) {
  return {
    goal: {
      type: actionName,
      intent: "update",
      confidence: 1,
      slots: {},
      userFacingSummary: actionName,
    },
    status: "planned",
    answer: "",
    missingSlots: [],
    steps: [{ order: 1, type, actionName, args, reason: "unit test" }],
  };
}

function assertFinding(result, code, label) {
  if (!result.findings.some((finding) => finding.code === code)) {
    throw new Error(`${label}: expected finding ${code}, got ${result.findings.map((finding) => finding.code).join(", ")}`);
  }
}

function assertOk(result, label) {
  if (!result.ok) {
    throw new Error(`${label}: expected ok inspection, got ${result.findings.map((finding) => finding.code).join(", ")}`);
  }
}

actions.set("action.implemented", actionFixture("action.implemented", "implemented"));
actions.set("action.draft_only", actionFixture("action.draft_only", "draft_only"));
actions.set("action.read_only", actionFixture("action.read_only", "read_only", { kind: "read", intent: "read" }));
actions.set("action.planned", actionFixture("action.planned", "planned"));
actions.set("action.blocked", actionFixture("action.blocked", "blocked"));
actions.set("action.unsupported", actionFixture("action.unsupported", "unsupported"));
actions.set("action.required_slot", actionFixture("action.required_slot", "implemented", { requiredSlots: ["entityId"] }));

const permissions = ["crm.test.manage"];

assertOk(inspectCrmAgentPlan({ plan: planFor("action.implemented"), permissions }), "implemented action");
assertOk(inspectCrmAgentPlan({ plan: planFor("action.draft_only"), permissions }), "draft_only draft step");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.draft_only", "execute"), permissions }), "draft_only_action_cannot_execute", "draft_only execute step");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.read_only", "draft"), permissions }), "read_only_action_cannot_mutate", "read_only draft step");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.planned"), permissions }), "action_not_available", "planned action");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.blocked"), permissions }), "action_not_available", "blocked action");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.unsupported"), permissions }), "action_not_available", "unsupported action");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.required_slot"), permissions }), "missing_action_slots", "required slot action");
assertFinding(inspectCrmAgentPlan({ plan: planFor("action.implemented"), permissions: [] }), "missing_action_permission", "permission check");

console.log("CRM Agent v2 inspector status tests passed.");
