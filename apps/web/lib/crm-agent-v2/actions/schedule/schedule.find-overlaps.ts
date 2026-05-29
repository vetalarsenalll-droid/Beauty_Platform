import { defineCrmAgentAction } from "../define-action";
import { readOverlaps } from "./schedule-helpers";

export const scheduleFindOverlapsAction = defineCrmAgentAction({
  name: "schedule.find_overlaps",
  domain: "schedule",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.schedule.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["date", "dateFrom", "dateTo", "specialistId", "locationId", "take"],
  description: "Найти пересечения графика/записей.",
  plannerHints: ["Use schedule.find_overlaps to inspect overlapping schedule entries."],
  read: async (payload, ctx) => readOverlaps(ctx.accountId, payload),
});
