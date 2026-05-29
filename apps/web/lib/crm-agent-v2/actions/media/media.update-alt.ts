import { defineCrmAgentAction } from "../define-action";

export const mediaUpdateAltAction = defineCrmAgentAction({
  name: "media.update_alt",
  domain: "media",
  kind: "write",
  intent: "update",
  status: "blocked",
  risk: "low",
  permission: "crm.media.update",
  confirmation: "never",
  requiredSlots: [],
  optionalSlots: [],
  description: "Изменить alt-текст.",
  plannerHints: ["Use media.update_alt only after required slots are resolved and the user intent matches: Изменить alt-текст.", "Blocked: current Prisma schema has MediaAsset without archive/alt/metadata fields, so this action needs schema support before execution."],
});
