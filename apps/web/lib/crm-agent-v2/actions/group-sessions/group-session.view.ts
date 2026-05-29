import { defineCrmAgentAction } from "../define-action";
import { readGroupSessionAction } from "./group-session-helpers";

export const groupSessionViewAction = defineCrmAgentAction({
  name: "group_session.view",
  domain: "group-sessions",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.group_sessions.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Показать групповое занятие.",
  plannerHints: ["Use group_session.view when the user asks to inspect: Показать групповое занятие."],
  read: (payload, ctx) => readGroupSessionAction("group_session.view", payload, ctx),
});
