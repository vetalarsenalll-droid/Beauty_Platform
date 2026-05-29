import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionCreateAction = defineCrmAgentAction({
  name: "group_session.create",
  domain: "group-sessions",
  kind: "write",
  intent: "create",
  status: "implemented",
  risk: "high",
  permission: "crm.group_sessions.create",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Создать групповое занятие.",
  plannerHints: ["Use group_session.create only after required slots are resolved and the user intent matches: Создать групповое занятие."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.create", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.create", payload, ctx),
});
