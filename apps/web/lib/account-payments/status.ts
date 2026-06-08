import type { PaymentIntentStatus, RefundStatus } from "@prisma/client";
import type { NormalizedPaymentStatus } from "./types";

export function paymentIntentStatusFromNormalized(status: NormalizedPaymentStatus): PaymentIntentStatus {
  switch (status) {
    case "succeeded":
    case "refunded":
    case "partially_refunded":
      return "SUCCEEDED";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    case "expired":
      return "EXPIRED";
    case "processing":
      return "PROCESSING";
    case "requires_action":
      return "REQUIRES_ACTION";
    case "created":
      return "CREATED";
  }
}

export function refundStatusFromNormalized(status: NormalizedPaymentStatus): RefundStatus {
  switch (status) {
    case "refunded":
    case "succeeded":
      return "SUCCEEDED";
    case "failed":
    case "cancelled":
    case "expired":
      return "FAILED";
    default:
      return "PENDING";
  }
}

export function normalizeTbankStatus(status: string | null | undefined): NormalizedPaymentStatus {
  switch (String(status ?? "").toUpperCase()) {
    case "CONFIRMED":
    case "AUTHORIZED":
      return "succeeded";
    case "NEW":
    case "FORM_SHOWED":
      return "created";
    case "DEADLINE_EXPIRED":
      return "expired";
    case "CANCELED":
    case "REVERSED":
      return "cancelled";
    case "REJECTED":
      return "failed";
    case "REFUNDED":
      return "refunded";
    case "PARTIAL_REFUNDED":
      return "partially_refunded";
    case "AUTHORIZING":
    case "CONFIRMING":
    case "3DS_CHECKING":
      return "processing";
    default:
      return "processing";
  }
}

export function normalizeYooKassaStatus(status: string | null | undefined, paid?: boolean): NormalizedPaymentStatus {
  switch (String(status ?? "").toLowerCase()) {
    case "succeeded":
      return "succeeded";
    case "waiting_for_capture":
    case "pending":
      return "processing";
    case "canceled":
      return "cancelled";
    default:
      return paid ? "succeeded" : "created";
  }
}

export function normalizeRbsStatus(status: string | number | null | undefined): NormalizedPaymentStatus {
  switch (String(status ?? "").toLowerCase()) {
    case "2":
    case "deposited":
    case "approved":
    case "paid":
    case "success":
    case "succeeded":
      return "succeeded";
    case "0":
    case "registered":
      return "requires_action";
    case "1":
    case "5":
    case "authorized":
    case "processing":
      return "processing";
    case "3":
    case "cancelled":
    case "canceled":
    case "reversed":
      return "cancelled";
    case "4":
    case "refunded":
      return "refunded";
    case "6":
    case "declined":
    case "failed":
    case "error":
      return "failed";
    default:
      return "processing";
  }
}
