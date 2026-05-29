import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { getLocationById, serializeLocation } from "./location-read-helpers";

export const locationViewAction = defineCrmAgentAction({
  name: "location.view",
  domain: "locations",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.locations.read",
  confirmation: "never",
  requiredSlots: ["locationId"],
  optionalSlots: [],
  description: "Показать филиал.",
  plannerHints: ["Use location.view when the user asks to inspect: Показать филиал."],
  read: async (payload: JsonRecord, ctx) => {
    const locationId = requiredNumber(payload.locationId ?? payload.id, "locationId");
    const location = await getLocationById(ctx.accountId, locationId);
    if (!location) throw new Error("Location not found.");
    return { location: serializeLocation(location) };
  },
});
