import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { getSpecialistById, serializeSpecialist } from "./specialist-read-helpers";

export const specialistViewAction = defineCrmAgentAction({
  name: "specialist.view",
  domain: "specialists",
  kind: "read",
  intent: "read",
  status: "read_only",
  risk: "low",
  permission: "crm.specialists.read",
  confirmation: "never",
  requiredSlots: ["specialistId"],
  optionalSlots: [],
  description: "Показать карточку специалиста.",
  plannerHints: ["Use specialist.view when the user asks to inspect: Показать карточку специалиста."],
  read: async (payload: JsonRecord, ctx) => {
    const specialistId = requiredNumber(payload.specialistId ?? payload.id, "specialistId");
    const specialist = await getSpecialistById(ctx.accountId, specialistId);
    if (!specialist) throw new Error("Specialist not found.");
    return { specialist: serializeSpecialist(specialist) };
  },
});
