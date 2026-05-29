import { defineCrmAgentAction } from "../define-action";
import { readLocationWorkload } from "./location-write-helpers";

export const locationViewWorkloadAction = defineCrmAgentAction({
  name: "location.view_workload",
  domain: "locations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: ["locationId"],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Показать загрузку филиала.",
  plannerHints: ["Use location.view_workload when the user asks to inspect: Показать загрузку филиала."],
  read: async (payload, ctx) => ({ workload: await readLocationWorkload(ctx.accountId, payload) }),
});
