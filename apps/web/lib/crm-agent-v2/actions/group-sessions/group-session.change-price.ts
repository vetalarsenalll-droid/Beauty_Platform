import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionChangePriceAction = defineCrmAgentAction({
  name: "group_session.change_price",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.group_sessions.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить цену.",
  plannerHints: ["Use group_session.change_price only after required slots are resolved and the user intent matches: Изменить цену."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.change_price", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.change_price", payload, ctx),
});
