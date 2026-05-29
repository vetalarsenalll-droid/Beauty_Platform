import { defineCrmAgentAction } from "../define-action";
import { readLocationSchedule } from "./location-write-helpers";

export const locationViewScheduleAction = defineCrmAgentAction({
  name: "location.view_schedule",
  domain: "locations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: ["locationId"],
  optionalSlots: ["dateFrom", "dateTo"],
  description: "Показать график филиала.",
  plannerHints: ["Use location.view_schedule when the user asks to inspect: Показать график филиала."],
  read: async (payload, ctx) => ({ schedule: await readLocationSchedule(ctx.accountId, payload) }),
});
