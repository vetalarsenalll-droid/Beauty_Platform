import { defineCrmAgentAction } from "../define-action";

export const mediaArchiveAction = defineCrmAgentAction({
  name: "media.archive",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "blocked",
  risk: "high",
  permission: "crm.media.update",
  confirmation: "always",
  requiredSlots: [],
  optionalSlots: [],
  description: "Архивировать медиа.",
  plannerHints: ["Use media.archive only after required slots are resolved and the user intent matches: Архивировать медиа.", "Blocked: current Prisma schema has MediaAsset without archive/alt/metadata fields, so this action needs schema support before execution."],
});
