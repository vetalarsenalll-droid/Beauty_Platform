import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { getServiceById, serializeService } from "./service-read-helpers";

export const serviceViewAction = defineCrmAgentAction({
  name: "service.view",
  domain: "services",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.services.read",
  confirmation: "never",
  requiredSlots: ["serviceId"],
  optionalSlots: [],
  description: "Показать услугу.",
  plannerHints: ["Use service.view when the user asks to inspect: Показать услугу."],
  read: async (payload: JsonRecord, ctx) => {
    const serviceId = requiredNumber(payload.serviceId ?? payload.id, "serviceId");
    const service = await getServiceById(ctx.accountId, serviceId);
    if (!service) throw new Error("Service not found.");
    return { service: serializeService(service) };
  },
});
