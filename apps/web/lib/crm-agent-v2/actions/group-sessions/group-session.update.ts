import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionUpdateAction = defineCrmAgentAction({
  name: "group_session.update",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.group_sessions.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить групповое занятие.",
  plannerHints: ["Use group_session.update only after required slots are resolved and the user intent matches: Изменить групповое занятие."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.update", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.update", payload, ctx),
});
