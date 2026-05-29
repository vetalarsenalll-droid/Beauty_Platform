import {
  canUseCrmAgentCatalogAction,
  getCrmAgentCatalogAction,
  listExecutableCrmAgentCatalogActions,
  listPlannerVisibleCrmAgentCatalogActionsForPermissions,
} from "../actions";
import type { CrmAgentActionDefinition } from "../actions/types";

export type CrmAgentActionDomain = string;
export type CrmAgentActionName = string;
export type CrmAgentRegisteredActionDefinition = CrmAgentActionDefinition;

export const crmAgentActionRegistry = listExecutableCrmAgentCatalogActions();

export function isCrmAgentActionName(value: string): value is CrmAgentActionName {
  return getCrmAgentCatalogAction(value) !== null;
}

export function isCrmAgentExecutableAction(name: string): name is CrmAgentActionName {
  return listExecutableCrmAgentCatalogActions().some((action) => action.name === name);
}

export function getCrmAgentAction(name: string) {
  return getCrmAgentCatalogAction(name);
}

export function getCrmAgentExecutableAction(name: string) {
  const action = getCrmAgentCatalogAction(name);
  return action && isCrmAgentExecutableAction(name) ? action : null;
}

export function listCrmAgentActionsByDomain(domain: CrmAgentActionDomain) {
  return listExecutableCrmAgentCatalogActions().filter((definition) => definition.domain === domain);
}

export function listCrmAgentActionsForPermissions(permissions: string[]) {
  return listPlannerVisibleCrmAgentCatalogActionsForPermissions(permissions);
}

export function canUseCrmAgentAction(name: string, permissions: string[]) {
  const definition = getCrmAgentCatalogAction(name);
  return definition ? canUseCrmAgentCatalogAction(definition, permissions) : false;
}

export function getMissingCrmAgentActionSlots(name: string, slots: Record<string, unknown>) {
  const definition = getCrmAgentCatalogAction(name);
  if (!definition) return [];
  return definition.requiredSlots.filter((slot) => slots[slot] === undefined || slots[slot] === null || slots[slot] === "");
}
