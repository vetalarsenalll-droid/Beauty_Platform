import type { PaymentIntentStatus, Prisma } from "@prisma/client";

export const OPEN_PAYMENT_INTENT_STATUSES: PaymentIntentStatus[] = ["CREATED", "REQUIRES_ACTION", "PROCESSING"];

export function pendingPaymentAppointmentWhere(now = new Date()): Prisma.AppointmentWhereInput {
  return {
    status: "CANCELLED",
    paymentIntents: {
      some: {
        status: { in: OPEN_PAYMENT_INTENT_STATUSES },
        scenario: { startsWith: "appointment_" },
        expiresAt: { gt: now },
      },
    },
  };
}
