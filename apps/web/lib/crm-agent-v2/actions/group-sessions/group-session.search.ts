import { defineCrmAgentAction } from "../define-action";
import { readGroupSessionAction } from "./group-session-helpers";

export const groupSessionSearchAction = defineCrmAgentAction({
  name: "group_session.search",
  domain: "group-sessions",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.group_sessions.read",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Найти групповые занятия.",
  plannerHints: ["Use group_session.search when the user asks to inspect: Найти групповые занятия."],
  read: (payload, ctx) => readGroupSessionAction("group_session.search", payload, ctx),
});
