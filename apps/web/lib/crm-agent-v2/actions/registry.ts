import type { CrmAgentActionDefinition, CrmAgentCatalogSummaryAction } from "./types";
import { isExecutableAction, isPlannerVisibleAction } from "./action-status";
import { accountActions } from "./account";
import { agentSettingsActions } from "./agent-settings";
import { analyticsActions } from "./analytics";
import { appointmentsActions } from "./appointments";
import { clientsActions } from "./clients";
import { domainsActions } from "./domains";
import { financeActions } from "./finance";
import { groupSessionsActions } from "./group-sessions";
import { integrationsActions } from "./integrations";
import { legalActions } from "./legal";
import { locationsActions } from "./locations";
import { loyaltyActions } from "./loyalty";
import { marketingActions } from "./marketing";
import { mediaActions } from "./media";
import { notificationsActions } from "./notifications";
import { promosActions } from "./promos";
import { reviewsActions } from "./reviews";
import { scheduleActions } from "./schedule";
import { servicesActions } from "./services";
import { siteActions } from "./site";
import { specialistsActions } from "./specialists";
import { usersActions } from "./users";

export const crmAgentActionCatalog: CrmAgentActionDefinition[] = [
  ...accountActions,
  ...agentSettingsActions,
  ...analyticsActions,
  ...appointmentsActions,
  ...clientsActions,
  ...domainsActions,
  ...financeActions,
  ...groupSessionsActions,
  ...integrationsActions,
  ...legalActions,
  ...locationsActions,
  ...loyaltyActions,
  ...marketingActions,
  ...mediaActions,
  ...notificationsActions,
  ...promosActions,
  ...reviewsActions,
  ...scheduleActions,
  ...servicesActions,
  ...siteActions,
  ...specialistsActions,
  ...usersActions,
];

const actionsByName = new Map<string, CrmAgentActionDefinition>(crmAgentActionCatalog.map((action) => [action.name, action]));

export function listCrmAgentCatalogActions() {
  return [...crmAgentActionCatalog];
}

export function listPlannerVisibleCrmAgentCatalogActions() {
  return crmAgentActionCatalog.filter(isPlannerVisibleAction);
}

export function listPlannerVisibleCrmAgentCatalogActionsForPermissions(permissions: string[]) {
  const actions = listPlannerVisibleCrmAgentCatalogActions();
  if (permissions.includes("crm.all")) return actions;
  return actions.filter((action) => action.permission === "self" || permissions.includes(action.permission));
}

export function listExecutableCrmAgentCatalogActions() {
  return crmAgentActionCatalog.filter(isExecutableAction);
}

export function getCrmAgentCatalogAction(name: string) {
  return actionsByName.get(name) ?? null;
}

export function summarizeCrmAgentCatalogAction(action: CrmAgentActionDefinition): CrmAgentCatalogSummaryAction {
  return {
    name: action.name,
    domain: action.domain,
    kind: action.kind,
    intent: action.intent,
    status: action.status,
    risk: action.risk,
    permission: action.permission,
    confirmation: action.confirmation,
    requiredSlots: action.requiredSlots,
    optionalSlots: action.optionalSlots,
    description: action.description,
    plannerHints: action.plannerHints,
  };
}
