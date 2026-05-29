import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionCancelAction = defineCrmAgentAction({
  name: "group_session.cancel",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.group_sessions.cancel",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Отменить групповое занятие.",
  plannerHints: ["Use group_session.cancel only after required slots are resolved and the user intent matches: Отменить групповое занятие."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.cancel", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.cancel", payload, ctx),
});
