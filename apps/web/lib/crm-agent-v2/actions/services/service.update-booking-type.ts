import { prisma } from "@/lib/prisma";
import { requiredNumber, type JsonRecord } from "../action-helpers";
import { defineCrmAgentAction } from "../define-action";
import { bookingType, previewServiceUpdate } from "./service-write-helpers";

export const serviceUpdateBookingTypeAction = defineCrmAgentAction({
  name: "service.update_booking_type",
  domain: "services",
  kind: "write",
  intent: "update",
  status: "implemented",
  risk: "high",
  permission: "crm.services.update",
  confirmation: "always",
  requiredSlots: ["serviceId", "bookingType"],
  optionalSlots: ["groupCapacityDefault", "allowMultiServiceBooking"],
  description: "Изменить тип записи/бронирования.",
  plannerHints: ["Use service.update_booking_type only after required slots are resolved and the user intent matches: Изменить тип записи/бронирования."],
  preview: previewServiceUpdate,
  execute: async (payload: JsonRecord, ctx) => {
    const serviceId = requiredNumber(payload.serviceId, "serviceId");
    const updated = await prisma.service.updateMany({
      where: { id: serviceId, accountId: ctx.accountId },
      data: {
        bookingType: bookingType(payload),
        ...(payload.groupCapacityDefault !== undefined ? { groupCapacityDefault: requiredNumber(payload.groupCapacityDefault, "groupCapacityDefault") } : {}),
        ...(payload.allowMultiServiceBooking !== undefined ? { allowMultiServiceBooking: payload.allowMultiServiceBooking === true } : {}),
      },
    });
    if (!updated.count) throw new Error("Service not found.");
    return { status: "DONE", data: { serviceId } };
  },
});
