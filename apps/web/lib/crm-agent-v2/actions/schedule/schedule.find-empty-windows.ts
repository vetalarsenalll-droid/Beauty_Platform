import { defineCrmAgentAction } from "../define-action";
import { readEmptyWindows } from "./schedule-helpers";

export const scheduleFindEmptyWindowsAction = defineCrmAgentAction({
  name: "schedule.find_empty_windows",
  domain: "schedule",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["date", "dateFrom", "dateTo", "specialistId", "locationId", "take"],
  description: "Найти пустые окна.",
  plannerHints: ["Use schedule.find_empty_windows to inspect open capacity in working entries."],
  read: async (payload, ctx) => readEmptyWindows(ctx.accountId, payload),
});
