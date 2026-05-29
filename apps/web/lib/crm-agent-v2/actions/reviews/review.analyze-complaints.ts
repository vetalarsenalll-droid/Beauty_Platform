import { defineCrmAgentAction } from "../define-action";
import { readComplaintAnalysis } from "./review-write-helpers";

export const reviewAnalyzeComplaintsAction = defineCrmAgentAction({
  name: "review.analyze_complaints",
  domain: "reviews",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.assistant.analytics.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: ["dateFrom", "dateTo", "clientId", "appointmentId", "take"],
  description: "Проанализировать жалобы.",
  plannerHints: ["Use review.analyze_complaints to summarize negative review themes."],
  read: async (payload, ctx) => ({ complaintAnalysis: await readComplaintAnalysis(ctx.accountId, payload) }),
});
