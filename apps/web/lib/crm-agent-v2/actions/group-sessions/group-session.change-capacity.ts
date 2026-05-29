import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionChangeCapacityAction = defineCrmAgentAction({
  name: "group_session.change_capacity",
  domain: "group-sessions",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "medium",
  permission: "crm.group_sessions.update",
  confirmation: "medium_plus",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить вместимость.",
  plannerHints: ["Use group_session.change_capacity only after required slots are resolved and the user intent matches: Изменить вместимость."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.change_capacity", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.change_capacity", payload, ctx),
});
