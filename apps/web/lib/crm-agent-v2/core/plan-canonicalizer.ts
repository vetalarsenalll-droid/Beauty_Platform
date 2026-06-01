import type { Prisma } from "@prisma/client";
import type { CrmAgentCatalogSummaryAction } from "../actions";
import type { CrmAgentPlannerPlan, CrmAgentPlannerStep } from "./planner";
import type { CrmAgentRegisteredToolDefinition } from "./tools";

export type CrmAgentPlanCanonicalizationSeverity = "info" | "warning" | "error";

export type CrmAgentPlanCanonicalizationFinding = {
  severity: CrmAgentPlanCanonicalizationSeverity;
  code: string;
  message: string;
  stepOrder?: number;
  toolName?: string | null;
  actionName?: string | null;
};

type CanonicalizeInput = {
  plan: CrmAgentPlannerPlan;
  actions: CrmAgentCatalogSummaryAction[];
  tools?: CrmAgentRegisteredToolDefinition[];
  message: string;
};

type ActionCanonicalRule = {
  action: string;
  aliasesFrom?: string[];
  messageHints?: RegExp[];
  idSlots?: string[];
  allowedReadTools?: string[];
  forbiddenReadTools?: string[];
};

const actionCanonicalRules: ActionCanonicalRule[] = [
  {
    action: "client.delete_contact",
    idSlots: ["contactId"],
    allowedReadTools: [],
    forbiddenReadTools: ["clients.get", "clients.search", "client.view_history"],
  },
  {
    action: "client.update_contact",
    idSlots: ["contactId"],
    allowedReadTools: [],
    forbiddenReadTools: ["clients.get", "clients.search", "client.view_history"],
  },
  {
    action: "client.add_note",
    aliasesFrom: ["client.update"],
    messageHints: [/(добавь|добавить|зафиксируй|запиши|комментар|заметк)/iu],
    idSlots: ["clientId"],
  },
  {
    action: "client.delete_note",
    aliasesFrom: ["client.update", "client.note.delete"],
    messageHints: [/удал[\p{L}\p{N}_-]*\s+заметк/iu],
    idSlots: ["noteId"],
    allowedReadTools: [],
    forbiddenReadTools: ["clients.get", "clients.search", "client.view_history"],
  },
  {
    action: "client.update_note",
    aliasesFrom: ["client.update", "client.note.update"],
    messageHints: [/(измени|изменить|обнови|обновить)[\p{L}\p{N}_-]*\s+заметк/iu],
    idSlots: ["noteId"],
  },
  {
    action: "client.add_tag",
    aliasesFrom: ["client.update", "client.tag.add"],
    messageHints: [/(добавь|добавить)[\p{L}\p{N}_-]*.*\sтег\s/iu],
    idSlots: ["clientId"],
  },
  {
    action: "client.remove_tag",
    aliasesFrom: ["client.update", "client.tag.remove"],
    messageHints: [/(убери|убрать|сними|снять)[\p{L}\p{N}_-]*.*\sтег\s/iu],
    idSlots: ["clientId"],
  },
  {
    action: "client.create_tag",
    aliasesFrom: ["client.tag.create", "client.tags.create", "client.create-tag", "client.tag"],
  },
  {
    action: "client.update_consent",
    aliasesFrom: ["client.update"],
    messageHints: [/согласи/iu, /consent/i],
    idSlots: ["clientId"],
  },
  {
    action: "client.merge_duplicates",
    idSlots: ["targetClientId", "sourceClientId"],
  },
  {
    action: "client.create_segment",
    allowedReadTools: [],
  },
  {
    action: "client.export_segment",
    aliasesFrom: ["client.export"],
    allowedReadTools: [],
  },
];

const actionAliases: Record<string, string> = {
  "client.history.view": "client.view_history",
  "client.export": "client.export_segment",
  "clients.export": "client.export_segment",
};

const supportedReadToolNames = new Set([
  "clients.search",
  "clients.get",
  "client.view_history",
  "client.view_visits",
  "client.view_payments",
  "client.view_reviews",
  "client.view_loyalty",
  "services.search",
  "services.get",
  "specialists.search",
  "specialists.get",
  "locations.search",
  "appointments.search",
  "appointments.findAvailableSlots",
  "reviews.search",
  "promos.search",
  "analytics.workload",
  "analytics.retention",
  "site.health",
  "memory.search",
]);

export function canonicalizeCrmAgentPlan(input: CanonicalizeInput) {
  const findings: CrmAgentPlanCanonicalizationFinding[] = [];
  const toolNames = new Set(input.tools?.map((tool) => tool.name) ?? []);
  const plan =
    input.plan.goal.intent === "read"
      ? canonicalizeReadPlan(input.plan, input.message, findings, toolNames)
      : canonicalizeMutationPlan(input.plan, input.actions, input.message, findings, toolNames);
  const validated = validateCanonicalPlan(plan, input.actions, findings, toolNames);
  return { plan: validated, findings };
}

function canonicalizeReadPlan(
  plan: CrmAgentPlannerPlan,
  message: string,
  findings: CrmAgentPlanCanonicalizationFinding[],
  toolNames: Set<string>,
): CrmAgentPlannerPlan {
  const scopedTool = clientScopedReadToolForMessage(plan.goal.type, message);
  const stepsWithNormalizedArgs = normalizeReadStepArgs(plan.steps, findings);
  const normalizedPlan = stepsWithNormalizedArgs === plan.steps ? plan : { ...plan, steps: stepsWithNormalizedArgs };
  if (!scopedTool || (toolNames.size && !toolNames.has(scopedTool))) return normalizedPlan;
  return {
    ...normalizedPlan,
    goal: { ...normalizedPlan.goal, type: scopedTool },
    steps: normalizedPlan.steps.map((step) => {
      if (step.type !== "read" || (step.toolName !== "clients.search" && step.toolName !== "clients.get")) return step;
      findings.push(finding("info", "client_scoped_read_tool", `Replaced ${step.toolName} with ${scopedTool}.`, step));
      return {
        ...step,
        toolName: scopedTool,
        args: {
          ...(step.args ?? {}),
          query: extractClientQueryFromQuestion(message) ?? step.args?.query ?? message,
        },
      };
    }),
  };
}

function normalizeReadStepArgs(steps: CrmAgentPlannerStep[], findings: CrmAgentPlanCanonicalizationFinding[]) {
  let changed = false;
  const normalized = steps.map((step) => {
    if (step.type !== "read" || (step.toolName !== "clients.search" && step.toolName !== "clients.get")) return step;
    const query = step.args?.query ?? step.args?.q ?? step.args?.phone ?? step.args?.email;
    if (query == null || step.args?.query != null) return step;
    changed = true;
    findings.push(finding("info", "normalized_client_read_query", `Moved ${step.toolName} alternate lookup arg to query.`, step));
    return { ...step, args: { ...(step.args ?? {}), query } };
  });
  return changed ? normalized : steps;
}

function canonicalizeMutationPlan(
  plan: CrmAgentPlannerPlan,
  actions: CrmAgentCatalogSummaryAction[],
  message: string,
  findings: CrmAgentPlanCanonicalizationFinding[],
  toolNames: Set<string>,
): CrmAgentPlannerPlan {
  if (!["create", "update", "delete", "notify", "execute"].includes(plan.goal.intent)) return plan;

  const canonicalGoalType = canonicalActionName(plan.goal.type, message);
  const action = actions.find((item) => item.name === canonicalGoalType);
  if (!action || action.status === "read_only" || action.status === "planned" || action.status === "blocked" || action.status === "unsupported") {
    return plan;
  }
  if (plan.status !== "planned" && !canPromoteClarificationToResolvablePlan(plan, action)) return plan;

  const rule = ruleForAction(action.name);
  const readSteps = ensureResolvableReadSteps(
    filterReadSteps(removePlannerConfirmSteps(plan.steps, findings), action, rule, findings, toolNames),
    plan.goal,
    action,
  );
  const steps: CrmAgentPlannerStep[] = readSteps.map((step) => {
    if (step.type !== "draft" && step.toolName !== "actions.prepare" && step.toolName !== "actions.preview") return step;
    const candidateActionName = step.actionName ? canonicalActionName(step.actionName, message) : action.name;
    const actionName = actions.some((item) => item.name === candidateActionName) ? candidateActionName : action.name;
    const payload = {
      ...payloadFromGoalSlots(plan.goal.slots, payloadSlotsForAction(action), readSteps, plan.goal.userFacingSummary),
      ...(isJsonObject(step.args?.payload) ? step.args.payload : {}),
    };
    normalizeActionPayloadFromMessage(payload, action, message);
    fillMissingIdPlaceholders(payload, action.requiredSlots, readSteps);
    return {
      ...step,
      type: step.type === "preview" ? "preview" : "draft",
      toolName: step.type === "preview" || step.toolName === "actions.preview" ? "actions.preview" : "actions.prepare",
      actionName,
      args: {
        ...(step.args ?? {}),
        actionType: actionName,
        payload,
      },
    };
  });

  if (!steps.some((step) => step.type === "draft" || step.toolName === "actions.prepare")) {
    steps.push({
      order: steps.length + 1,
      type: "draft",
      toolName: "actions.prepare",
      actionName: action.name,
      args: {
        actionType: action.name,
        summary: plan.goal.userFacingSummary || action.name,
        payload: normalizedActionPayloadFromMessage(
          payloadFromGoalSlots(plan.goal.slots, payloadSlotsForAction(action), readSteps, plan.goal.userFacingSummary),
          action,
          message,
        ),
      },
      reason: "Prepare action draft after required entities are resolved.",
    });
  }

  return {
    ...plan,
    goal: { ...plan.goal, type: action.name },
    status: "planned",
    missingSlots: [],
    clarificationQuestion: "",
    steps: steps.map((step, index) => ({ ...step, order: index + 1 })),
  };
}

function validateCanonicalPlan(
  plan: CrmAgentPlannerPlan,
  actions: CrmAgentCatalogSummaryAction[],
  findings: CrmAgentPlanCanonicalizationFinding[],
  toolNames: Set<string>,
) {
  const actionNames = new Set(actions.map((action) => action.name));
  let hasError = false;
  for (const step of plan.steps) {
    if (step.type === "execute") {
      findings.push(finding("error", "model_execute_step", "Planner output must not execute directly.", step));
      hasError = true;
    }
    if (step.type === "read" && step.toolName && toolNames.size && !toolNames.has(step.toolName)) {
      findings.push(finding("error", "unknown_read_tool", `Unknown read tool: ${step.toolName}.`, step));
      hasError = true;
    }
    if ((step.type === "draft" || step.toolName === "actions.prepare") && step.actionName) {
      const action = actions.find((item) => item.name === step.actionName);
      const payload = isJsonObject(step.args?.payload) ? step.args.payload : {};
      if (!actionNames.has(step.actionName)) {
        findings.push(finding("error", "unknown_draft_action", `Unknown draft action: ${step.actionName}.`, step));
        hasError = true;
      }
      if (step.args?.actionType !== step.actionName) {
        findings.push(finding("error", "draft_action_type_mismatch", "Draft actionType must match actionName.", step));
        hasError = true;
      }
      if (action) {
        for (const slot of action.requiredSlots) {
          if (!hasResolvableSlot(slot, payload, plan.steps)) {
            findings.push(finding("error", "missing_canonical_slot", `Canonical plan is missing slot: ${slot}.`, step));
            hasError = true;
          }
        }
        for (const slot of payloadSlotsForAction(action)) {
          const value = payload[slot];
          if (slot.endsWith("Id") && typeof value === "string" && /^\d+$/.test(value.trim())) {
            findings.push(finding("error", "string_numeric_id_slot", `ID slot ${slot} must be a number, not a numeric string.`, step));
            hasError = true;
          }
        }
      }
    }
  }
  if (!hasError) return plan;
  return {
    ...plan,
    status: "needs_clarification" as const,
    clarificationQuestion: "Нужно уточнить параметры действия перед выполнением.",
    missingSlots: [...new Set(findings.filter((item) => item.severity === "error").map((item) => item.code))],
    steps: [],
  };
}

function hasResolvableSlot(slot: string, payload: Prisma.JsonObject, steps: CrmAgentPlannerStep[]) {
  const value = payload[slot];
  if (isResolvablePayloadSlotValue(slot, value)) return true;
  if (!slot.endsWith("Id")) return false;
  return hasReadStepForEntity(steps, slot.slice(0, -2));
}

function isResolvablePayloadSlotValue(slot: string, value: unknown) {
  if (value === undefined || value === null || value === "") return false;
  if (!slot.endsWith("Id")) return true;
  return typeof value === "number" || isIdPlaceholder(value);
}

function canonicalActionName(value: string, message = "") {
  for (const rule of actionCanonicalRules) {
    if (rule.aliasesFrom?.includes(value) && (!rule.messageHints?.length || rule.messageHints.some((pattern) => pattern.test(message)))) {
      return rule.action;
    }
  }
  return actionAliases[value] ?? value;
}

function ruleForAction(actionName: string) {
  return actionCanonicalRules.find((rule) => rule.action === actionName) ?? null;
}

function removePlannerConfirmSteps(steps: CrmAgentPlannerStep[], findings: CrmAgentPlanCanonicalizationFinding[]) {
  return steps.filter((step) => {
    if (step.type !== "execute") return true;
    findings.push(finding("warning", "removed_execute_step", "Removed model-proposed execute step.", step));
    return false;
  });
}

function filterReadSteps(
  steps: CrmAgentPlannerStep[],
  action: CrmAgentCatalogSummaryAction,
  rule: ActionCanonicalRule | null,
  findings: CrmAgentPlanCanonicalizationFinding[],
  toolNames: Set<string>,
) {
  const required = new Set(action.requiredSlots);
  return steps.filter((step) => {
    if (step.type !== "read" || !step.toolName) return true;
    if (!supportedReadToolNames.has(step.toolName) || (toolNames.size && !toolNames.has(step.toolName))) {
      findings.push(finding("warning", "removed_unsupported_read_tool", `Removed unsupported read tool ${step.toolName}.`, step));
      return false;
    }
    if (rule?.forbiddenReadTools?.includes(step.toolName)) {
      findings.push(finding("info", "removed_forbidden_read_tool", `Removed forbidden read tool ${step.toolName} for ${action.name}.`, step));
      return false;
    }
    if (rule?.allowedReadTools && !rule.allowedReadTools.includes(step.toolName)) {
      findings.push(finding("info", "removed_unlisted_read_tool", `Removed unlisted read tool ${step.toolName} for ${action.name}.`, step));
      return false;
    }
    if (!required.has("clientId") && (required.has("contactId") || required.has("noteId"))) {
      if (step.toolName === "clients.get" || step.toolName === "clients.search" || step.toolName === "client.view_history") {
        findings.push(finding("info", "removed_unneeded_context_read", `Removed unneeded client read ${step.toolName}.`, step));
        return false;
      }
    }
    return true;
  });
}

function normalizedActionPayloadFromMessage(
  payload: Prisma.JsonObject,
  action: CrmAgentCatalogSummaryAction,
  message: string,
) {
  normalizeActionPayloadFromMessage(payload, action, message);
  return payload;
}

function normalizeActionPayloadFromMessage(
  payload: Prisma.JsonObject,
  action: CrmAgentCatalogSummaryAction,
  message: string,
) {
  normalizeIdPayloadSlots(payload, action);
  sanitizeDateRangePayloadSlots(payload);
  if (action.name === "service.update_description") {
    const exactDescription = message.match(/(?:^|\s)на:\s*(.+?)\s*$/iu)?.[1]?.trim();
    if (exactDescription) payload.description = exactDescription;
  }
  if (action.name === "service.update_price") {
    if (payload.basePrice == null && payload.priceTotal != null) payload.basePrice = payload.priceTotal;
    const exactPrice = message.match(/(?:^|\s)на\s+(\d+(?:[.,]\d+)?)\s*(?:руб|р\b|₽|$)/iu)?.[1]?.replace(",", ".");
    if (exactPrice) payload.basePrice = exactPrice;
  }
  if (action.name === "appointment.create") {
    const normalizedStartAt =
      typeof payload.startAt === "string" ? normalizePlannerDateValue(payload.startAt) ?? extractMessageDateTime(message) : extractMessageDateTime(message);
    if (normalizedStartAt) payload.startAt = normalizedStartAt;
  }
  if (action.requiredSlots.includes("contactId") && payload.contactId == null) {
    const contactId = message.match(/(?:контакт|contact)\s*#?\s*(\d+)/iu)?.[1] ?? message.match(/#\s*(\d+)/)?.[1];
    if (contactId) payload.contactId = Number(contactId);
  }
  if (action.requiredSlots.includes("noteId") && payload.noteId == null) {
    const noteId = message.match(/(?:заметк[ауи]?|note)\s*#?\s*(\d+)/iu)?.[1] ?? message.match(/#\s*(\d+)/)?.[1];
    if (noteId) payload.noteId = Number(noteId);
  }
  if (action.name === "client.update_note" && payload.note == null) {
    const note = message.match(/:\s*(.+?)[.!?]?\s*$/u)?.[1]?.trim();
    if (note) payload.note = note;
  }
  if (action.name === "client.add_note" && (payload.note == null || isPlannerPathReference(payload.note))) {
    const note = extractClientNoteText(message);
    if (note) payload.note = note;
  }
  if (action.name === "client.add_tag" || action.name === "client.remove_tag" || action.name === "client.create_tag") {
    const tagName = extractClientTagName(message, action.name);
    if (tagName && (payload.name == null || payload.name === "")) payload.name = tagName;
  }
  if (action.name === "client.update_consent") {
    const consentType = message.match(/:\s*([A-Za-z0-9_.:-]+)\s+/u)?.[1]?.trim();
    if (consentType && (payload.type == null || payload.type === "")) payload.type = consentType;
    if (payload.granted == null) {
      if (/(разрешено|дать|выдать|granted|true|yes)/iu.test(message)) payload.granted = true;
      if (/(запрещено|отозвать|снять|false|no)/iu.test(message)) payload.granted = false;
    }
  }
  if (action.name === "client.notify") {
    if (payload.channel == null && /\bSMS\b|смс/iu.test(message)) payload.channel = "sms";
    if (typeof payload.channel === "string") payload.channel = payload.channel.trim().toLowerCase();
  }
  if (action.name === "client.create_segment" || action.name === "client.export_segment") {
    if (typeof payload.format === "string") payload.format = payload.format.trim().toLowerCase();
    if (typeof payload.query === "string" && typeof payload.tagName === "string" && payload.query.trim() === payload.tagName.trim()) {
      delete payload.query;
    }
  }
  sanitizeDateRangePayloadSlots(payload);
  normalizeIdPayloadSlots(payload, action);
}

function normalizeIdPayloadSlots(payload: Prisma.JsonObject, action: CrmAgentCatalogSummaryAction) {
  for (const slot of payloadSlotsForAction(action)) {
    if (!slot.endsWith("Id")) continue;
    const value = payload[slot];
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
      payload[slot] = Number(value.trim());
      continue;
    }
    if (typeof value === "string" && !isIdPlaceholder(value)) delete payload[slot];
  }
}

function sanitizeDateRangePayloadSlots(payload: Prisma.JsonObject) {
  for (const slot of ["createdFrom", "createdTo", "dateFrom", "dateTo"]) {
    const value = payload[slot];
    if (typeof value !== "string") continue;
    if (!normalizePlannerDateValue(value)) delete payload[slot];
  }
}

function extractClientTagName(message: string, actionName: string) {
  const patterns =
    actionName === "client.remove_tag"
      ? [/тег\s+(.+?)\s+у\s+клиент/iu, /тег\s+(.+?)[.!?]?\s*$/iu]
      : actionName === "client.add_tag"
        ? [/тег\s+(.+?)(?:[.!?]\s*$|\s+клиенту|\s+у\s+клиент|$)/iu]
        : [/тег\s+(.+?)[.!?]?\s*$/iu];
  for (const pattern of patterns) {
    const value = message.match(pattern)?.[1]?.trim();
    if (value) return value.replace(/[.!?]+$/u, "").trim();
  }
  return null;
}

function extractClientNoteText(message: string) {
  const patterns = [
    /(?:заметк[ауи]?|комментарий|коммент)\s*:\s*(.+?)[.!?]?\s*$/iu,
    /(?:комментарий|коммент)\s+(.+?)[.!?]?\s*$/iu,
  ];
  for (const pattern of patterns) {
    const value = message.match(pattern)?.[1]?.trim();
    if (value) return value.replace(/[.!?]+$/u, "").trim();
  }
  return null;
}

function isPlannerPathReference(value: unknown) {
  return typeof value === "string" && /^\.[A-Za-z0-9_.[\]-]+$/.test(value.trim());
}

function payloadFromGoalSlots(
  slots: Record<string, unknown>,
  requiredSlots: string[],
  steps: CrmAgentPlannerStep[] = [],
  summary = "",
) {
  const payload: Prisma.JsonObject = {};
  for (const slot of requiredSlots) {
    if (slot.endsWith("Id")) {
      const entity = slot.slice(0, -2);
      const selected = selectedIdSlotValue(slots[slot]);
      if (isConcreteIdValue(selected)) {
        payload[slot] = typeof selected === "number" ? selected : Number(selected.trim());
        continue;
      }
      const entityValue = slotValue(slots[entity]) ?? slotValue(slots[slot]) ?? inferredEntityQueryFromSummary(entity, summary);
      if (entityValue != null && entityValue !== "") payload[slot] = placeholderForEntityId(entity);
      if (payload[slot] === undefined && hasReadStepForEntity(steps, entity)) payload[slot] = placeholderForEntityId(entity);
      continue;
    }

    const direct = slotValue(slots[slot]) ?? nestedSlotValue(slots.filter, slot) ?? aliasedSlotValue(slots, slot);
    if (direct != null && direct !== "") {
      payload[slot] = slot === "startAt" ? normalizePlannerDateValue(direct) ?? direct : direct;
      continue;
    }

    if (slot === "startAt") {
      const startAt = slotValue(slots.startAt) ?? slotValue(slots.time);
      payload.startAt = startAt ? normalizePlannerDateValue(startAt) ?? startAt : "#START_AT#";
    }
  }
  return payload;
}

function payloadSlotsForAction(action: CrmAgentCatalogSummaryAction) {
  return [...new Set([...action.requiredSlots, ...action.optionalSlots])];
}

function canPromoteClarificationToResolvablePlan(plan: CrmAgentPlannerPlan, action: CrmAgentCatalogSummaryAction) {
  if (plan.status !== "needs_clarification") return true;
  return action.requiredSlots.every((slot) => {
    const direct = slotValue(plan.goal.slots[slot]);
    if (direct != null && direct !== "") return true;
    if (!slot.endsWith("Id")) return false;
    const entity = slot.slice(0, -2);
    return Boolean(slotValue(plan.goal.slots[entity]) ?? inferredEntityQueryFromSummary(entity, plan.goal.userFacingSummary));
  });
}

function ensureResolvableReadSteps(
  steps: CrmAgentPlannerStep[],
  goal: CrmAgentPlannerPlan["goal"],
  action: CrmAgentCatalogSummaryAction,
) {
  const next = [...steps];
  const extraReadSteps: CrmAgentPlannerStep[] = [];
  for (const slot of action.requiredSlots) {
    if (!slot.endsWith("Id")) continue;
    const entity = slot.slice(0, -2);
    if (hasReadStepForEntity(next, entity)) continue;
    const query = slotValue(goal.slots[entity]) ?? slotValue(goal.slots[slot]) ?? inferredEntityQueryFromSummary(entity, goal.userFacingSummary);
    const toolName = readToolForEntity(entity);
    if (typeof query === "string" && query.trim() && toolName) {
      extraReadSteps.push({
        order: next.length + extraReadSteps.length + 1,
        type: "read",
        toolName,
        args: { query: query.trim() },
        reason: `Resolve ${entity} before preparing ${action.name}.`,
      });
    }
  }
  if (!extraReadSteps.length) return next;
  const firstDraftIndex = next.findIndex((step) => step.type === "draft" || step.toolName === "actions.prepare" || step.toolName === "actions.preview");
  if (firstDraftIndex < 0) return [...next, ...extraReadSteps];
  return [...next.slice(0, firstDraftIndex), ...extraReadSteps, ...next.slice(firstDraftIndex)];
}

function readToolForEntity(entity: string) {
  const tools: Record<string, string> = {
    client: "clients.search",
    service: "services.search",
    specialist: "specialists.search",
    location: "locations.search",
    appointment: "appointments.search",
  };
  return tools[entity] ?? null;
}

function fillMissingIdPlaceholders(payload: Prisma.JsonObject, requiredSlots: string[], steps: CrmAgentPlannerStep[]) {
  for (const slot of requiredSlots) {
    if (!slot.endsWith("Id") || (payload[slot] != null && payload[slot] !== "")) continue;
    const entity = slot.slice(0, -2);
    if (hasReadStepForEntity(steps, entity)) payload[slot] = placeholderForEntityId(entity);
  }
}

function hasReadStepForEntity(steps: CrmAgentPlannerStep[], entity: string) {
  const toolPrefixByEntity: Record<string, string> = {
    client: "clients.",
    service: "services.",
    specialist: "specialists.",
    location: "locations.",
    appointment: "appointments.",
  };
  const prefix = toolPrefixByEntity[entity];
  return Boolean(prefix && steps.some((step) => step.type === "read" && step.toolName?.startsWith(prefix)));
}

function inferredEntityQueryFromSummary(entity: string, summary: string) {
  if (entity === "service") {
    const match = summary.match(/услуг[аи]?\s+(.+?)(?:\s+на\s+|\s+с\s+|$)/iu);
    return match?.[1]?.trim() || null;
  }
  if (entity === "client") {
    const match = summary.match(/(?:клиент[ауы]?|client)\s+(.+?)(?:\s+(?:из|в|до|на|с)\s+|$)/iu);
    return match?.[1]?.trim() || null;
  }
  return null;
}

function clientScopedReadToolForMessage(goalType: string | undefined, message: string) {
  const normalized = message.toLocaleLowerCase("ru-RU");
  if (!/клиент/u.test(normalized)) return null;
  if (goalType === "reviews.search" || /отзыв/u.test(normalized)) return "client.view_reviews";
  if (/визит/u.test(normalized)) return "client.view_visits";
  if (/плат[её]ж/u.test(normalized)) return "client.view_payments";
  if (/лояльност|бонус/u.test(normalized)) return "client.view_loyalty";
  return null;
}

function extractClientQueryFromQuestion(message: string) {
  const match = message.match(/клиент[а-я]*\s+(.+?)[.!?]?\s*$/iu);
  return match?.[1]?.trim() || null;
}

function slotValue(value: unknown): unknown {
  if (isJsonObject(value)) return value.value ?? value.query ?? value.selectedId ?? null;
  return value ?? null;
}

function selectedIdSlotValue(value: unknown): unknown {
  if (!isJsonObject(value)) return value ?? null;
  return value.selectedId ?? value.value ?? null;
}

function nestedSlotValue(value: unknown, slot: string): unknown {
  if (!isJsonObject(value)) return null;
  return slotValue(value[slot]);
}

function aliasedSlotValue(slots: Record<string, unknown>, slot: string): unknown {
  if (slot === "tagName" && typeof slots.filterTag === "string") return slots.filterTag;
  if (slot === "tagName" && Array.isArray(slots.filterTags)) return slots.filterTags.find((item) => typeof item === "string" && item.trim()) ?? null;
  return null;
}

function isConcreteIdValue(value: unknown): value is number | string {
  return typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value.trim()));
}

function placeholderForEntityId(entity: string) {
  return `#${entity.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}_ID#`;
}

function isIdPlaceholder(value: unknown): value is string {
  return typeof value === "string" && /^#[A-Z0-9_]+_ID#$/.test(value.trim());
}

function normalizePlannerDateValue(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  const match = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  const ruMatch = raw.match(/^(\d{1,2})\s+([а-яё]+)\s+(\d{4})(?:\s+(?:в\s*)?(\d{1,2}):(\d{2}))?$/iu);
  if (!match && !ruMatch) return null;
  const [, day, month, year, hour = "0", minute = "0"] = match ?? ruMatch ?? [];
  const monthIndex = match ? Number(month) - 1 : ruMonthIndex(month);
  if (monthIndex == null) return null;
  const date = new Date(Date.UTC(Number(year), monthIndex, Number(day), Number(hour), Number(minute)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractMessageDateTime(message: string) {
  const numeric = message.match(/(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})(?:\s+(?:в\s*)?(\d{1,2}:\d{2}))?/iu);
  if (numeric) return normalizePlannerDateValue(`${numeric[1]} ${numeric[2] ?? "00:00"}`);
  const ru = message.match(/(\d{1,2}\s+[а-яё]+\s+\d{4})(?:\s+(?:в\s*)?(\d{1,2}:\d{2}))?/iu);
  if (ru) return normalizePlannerDateValue(`${ru[1]} ${ru[2] ?? "00:00"}`);
  return null;
}

function ruMonthIndex(value: string) {
  const months: Record<string, number> = {
    января: 0,
    январь: 0,
    февраля: 1,
    февраль: 1,
    марта: 2,
    март: 2,
    апреля: 3,
    апрель: 3,
    мая: 4,
    май: 4,
    июня: 5,
    июнь: 5,
    июля: 6,
    июль: 6,
    августа: 7,
    август: 7,
    сентября: 8,
    сентябрь: 8,
    октября: 9,
    октябрь: 9,
    ноября: 10,
    ноябрь: 10,
    декабря: 11,
    декабрь: 11,
  };
  return months[value.toLowerCase()] ?? null;
}

function isJsonObject(value: unknown): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finding(
  severity: CrmAgentPlanCanonicalizationSeverity,
  code: string,
  message: string,
  step?: CrmAgentPlannerStep,
): CrmAgentPlanCanonicalizationFinding {
  return {
    severity,
    code,
    message,
    stepOrder: step?.order,
    toolName: step?.toolName ?? null,
    actionName: step?.actionName ?? null,
  };
}
