import type { CrmAgentActionDefinition } from "./types";
import { CrmAgentValidationError } from "./action-errors";

export function defineCrmAgentAction<TPayload extends Record<string, unknown>>(
  definition: CrmAgentActionDefinition<TPayload>,
): CrmAgentActionDefinition<TPayload> {
  validateActionDefinition(definition);
  return definition;
}

export function requireSlots(payload: Record<string, unknown>, slots: string[], actionName: string) {
  const missing = slots.filter((slot) => payload[slot] === undefined || payload[slot] === null || payload[slot] === "");
  if (!missing.length) return;
  throw new CrmAgentValidationError(`Action ${actionName} is missing required slots: ${missing.join(", ")}.`, {
    actionName,
    missingSlots: missing,
  });
}

export function inputJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null)) as unknown;
}

function validateActionDefinition<TPayload extends Record<string, unknown>>(definition: CrmAgentActionDefinition<TPayload>) {
  if (!definition.name.trim()) throw new CrmAgentValidationError("Action name is required.");
  if (!definition.domain.trim()) throw new CrmAgentValidationError(`Action ${definition.name} domain is required.`);
  if (!definition.description.trim()) throw new CrmAgentValidationError(`Action ${definition.name} description is required.`);
  if (definition.kind !== "read" && definition.kind !== "generate" && definition.kind !== "write" && definition.kind !== "export" && definition.kind !== "system") {
    throw new CrmAgentValidationError(`Action ${definition.name} has invalid kind.`);
  }
}
