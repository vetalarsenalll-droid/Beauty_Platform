import { defineCrmAgentAction } from "../define-action";
import { readClientHistory } from "./client-write-helpers";

export const clientViewHistoryAction = defineCrmAgentAction({
  name: "client.view_history",
  domain: "clients",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.clients.read",
  confirmation: "never",
  requiredSlots: ["clientId"],
  optionalSlots: ["take"],
  description: "Показать историю изменений/контактов клиента.",
  plannerHints: ["Use client.view_history when the user asks for notes, consents or tag history for a client."],
  read: async (payload, ctx) => ({ history: await readClientHistory(ctx.accountId, payload) }),
});
