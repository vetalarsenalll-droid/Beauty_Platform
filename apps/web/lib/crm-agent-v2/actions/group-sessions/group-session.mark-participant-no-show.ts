import { defineCrmAgentAction } from "../define-action";
import { executeGroupSessionAction, previewGroupSessionAction } from "./group-session-helpers";

export const groupSessionMarkParticipantNoShowAction = defineCrmAgentAction({
  name: "group_session.mark_participant_no_show",
  domain: "group-sessions",
  kind: "write",
  intent: "execute",
  status: "implemented",
  risk: "high",
  permission: "crm.group_sessions.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Отметить неявку участника.",
  plannerHints: ["Use group_session.mark_participant_no_show only after required slots are resolved and the user intent matches: Отметить неявку участника."],
  preview: (payload, ctx) => previewGroupSessionAction("group_session.mark_participant_no_show", payload, ctx),
  execute: (payload, ctx) => executeGroupSessionAction("group_session.mark_participant_no_show", payload, ctx),
});
