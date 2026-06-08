import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  bookingChainPaymentMetadata,
  bookingPaymentMetadata,
  bookingPaymentReceiptItem,
  calculateAppointmentOnlinePayment,
  normalizeBookingPaymentOption,
} from "@/lib/account-payments/booking-payment";
import { createAccountCheckout } from "@/lib/account-payments/checkout";
import { prisma } from "@/lib/prisma";
import { resolvePublicAccount } from "@/lib/public-booking";
import type { AccountPaymentMethodCode, AccountReceiptItemInput } from "@/lib/account-payments/types";

export const runtime = "nodejs";

type CheckoutBody = {
  appointmentId?: number;
  appointmentIds?: number[];
  amountRub?: number;
  description?: string;
  scenario?: string;
  method?: string;
  paymentOption?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  returnUrl?: string;
  failUrl?: string;
};

function normalizeMethod(value: unknown): AccountPaymentMethodCode {
  return value === "sbp" || value === "tpay" || value === "sberpay" ? value : "card";
}

function intentMethod(value: unknown): AccountPaymentMethodCode | null {
  if (!value || typeof value !== "object") return null;
  const method = (value as { method?: unknown }).method;
  return method === "card" || method === "sbp" || method === "tpay" || method === "sberpay" ? method : null;
}

function paymentMethodsFromPayload(value: unknown) {
  if (!value || typeof value !== "object") {
    return { cardPaymentUrl: null, sbpQrSvg: null, sbpPayload: null };
  }
  const methods = (value as { paymentMethods?: unknown }).paymentMethods;
  const source = methods && typeof methods === "object" ? methods : value;
  const cardUrl = (source as { cardUrl?: unknown }).cardUrl;
  const sbpQrSvg = (source as { sbpQrSvg?: unknown }).sbpQrSvg;
  const sbpPayload = (source as { sbpPayload?: unknown }).sbpPayload;
  return {
    cardPaymentUrl: typeof cardUrl === "string" && cardUrl.trim() ? cardUrl : null,
    sbpQrSvg: typeof sbpQrSvg === "string" && sbpQrSvg.trim() ? sbpQrSvg : null,
    sbpPayload: typeof sbpPayload === "string" && sbpPayload.trim() ? sbpPayload : null,
  };
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function receiptItemsForManualCheckout(input: { description: string; amountRub: number }): AccountReceiptItemInput[] {
  return [
    {
      name: input.description,
      quantity: 1,
      unitPriceRub: input.amountRub,
      amountRub: input.amountRub,
      vat: "NONE",
      paymentSubject: "service",
      paymentMethod: "full_payment",
    },
  ];
}

function bodyCustomer(body: CheckoutBody) {
  return {
    fullName: body.customer?.name ?? body.customerName ?? null,
    email: body.customer?.email ?? body.customerEmail ?? null,
    phone: body.customer?.phone ?? body.customerPhone ?? null,
  };
}

function normalizeAppointmentIds(body: CheckoutBody) {
  const ids = Array.isArray(body.appointmentIds) ? body.appointmentIds : [body.appointmentId];
  return Array.from(
    new Set(
      ids
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );
}

function metadataAppointmentIds(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const ids = (value as { appointmentIds?: unknown }).appointmentIds;
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0);
}

function isPendingPaymentMetadata(value: unknown) {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { appointmentPendingPayment?: unknown }).appointmentPendingPayment === true
  );
}

function hasPendingPaymentIntent(appointment: Awaited<ReturnType<typeof prismaAppointmentsForCheckout>>[number]) {
  return appointment.paymentIntents.some((intent) => isPendingPaymentMetadata(intent.metadata));
}

function sameIds(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  if (!body) return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);

  const appointmentIds = normalizeAppointmentIds(body);
  const method = normalizeMethod(body.method);

  try {
    if (appointmentIds.length > 0) {
      const appointments = await prismaAppointmentsForCheckout(appointmentIds, resolved.account.id);
      if (appointments.length !== appointmentIds.length) {
        return jsonError("APPOINTMENT_NOT_FOUND", "Запись не найдена.", null, 404);
      }

      const appointmentById = new Map(appointments.map((item) => [item.id, item]));
      const orderedAppointments = appointmentIds.map((id) => appointmentById.get(id)!);
      if (orderedAppointments.some((item) => item.status === "CANCELLED" && !hasPendingPaymentIntent(item))) {
        return jsonError("APPOINTMENT_NOT_FOUND", "Запись не найдена.", null, 404);
      }
      const appointment = orderedAppointments[0];
      const hasMixedClients = orderedAppointments.some((item) => item.clientId !== appointment.clientId);
      if (hasMixedClients) {
        return jsonError("VALIDATION_FAILED", "Нельзя оплатить одним платежом записи разных клиентов.", null, 400);
      }

      const calculation = calculateAppointmentOnlinePayment({
        appointmentTotalRub: orderedAppointments.reduce((sum, item) => sum + Number(item.priceTotal), 0),
        settings: appointment.account.settings,
        paymentOption: normalizeBookingPaymentOption(body.paymentOption),
      });
      if (!calculation) {
        return jsonError("ONLINE_PAYMENT_DISABLED", "Онлайн-оплата для записи не включена.", null, 400);
      }

      const serviceNames = orderedAppointments
        .flatMap((item) => item.services.map((serviceItem) => serviceItem.service.name))
        .filter(Boolean);
      const description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : serviceNames.length
            ? `${calculation.descriptionPrefix}: ${serviceNames.join(", ")}`.slice(0, 250)
            : `${calculation.descriptionPrefix} #${appointmentIds.join(",")}`;

      const existingIntent = appointment.paymentIntents[0] ?? null;
      const existingAppointmentIds = existingIntent ? metadataAppointmentIds(existingIntent.metadata) : [];
      const existingMatchesAppointments =
        appointmentIds.length === 1
          ? existingAppointmentIds.length === 0 || sameIds(existingAppointmentIds, appointmentIds)
          : sameIds(existingAppointmentIds, appointmentIds);
      if (
        existingIntent?.paymentUrl &&
        existingMatchesAppointments &&
        (intentMethod(existingIntent.providerPayload) ?? "card") === method
      ) {
        const methods = paymentMethodsFromPayload(existingIntent.providerPayload);
        return NextResponse.json({
          data: {
            intentId: existingIntent.id,
            status: existingIntent.status,
            paymentUrl: existingIntent.paymentUrl,
            cardPaymentUrl: methods.cardPaymentUrl ?? existingIntent.paymentUrl,
            sbpQrSvg: methods.sbpQrSvg,
            sbpPayload: methods.sbpPayload,
            provider: existingIntent.provider,
            providerStatus: existingIntent.providerStatus,
            amountRub: calculation.amountRub,
            originalAmountRub: calculation.originalAmountRub,
            discountAmountRub: calculation.discountAmountRub,
            remainingAmountRub: calculation.remainingAmountRub,
            scenario: calculation.scenario,
          },
        });
      }

      const customer = bodyCustomer(body);
      const shouldKeepSlotFreeUntilPaid = Boolean(appointment.account.settings?.requirePaymentToConfirm);
      const metadata = (appointmentIds.length > 1
        ? bookingChainPaymentMetadata({
            calculation,
            appointmentIds,
            primaryAppointmentId: appointment.id,
          })
        : bookingPaymentMetadata(calculation)) as Record<string, unknown>;
      const intent = await createAccountCheckout({
        accountId: resolved.account.id,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        amountRub: calculation.amountRub,
        description,
        scenario: calculation.scenario,
        method,
        customer: {
          fullName: customer.fullName ?? appointment.client.firstName ?? null,
          email: customer.email ?? appointment.client.email ?? null,
          phone: customer.phone ?? appointment.client.phone ?? null,
        },
        receiptItems: [bookingPaymentReceiptItem({ description, calculation })],
        metadata: {
          ...metadata,
          appointmentPendingPayment: shouldKeepSlotFreeUntilPaid,
        },
        returnUrl: cleanUrl(body.returnUrl),
        failUrl: cleanUrl(body.failUrl),
        idempotencyKey: request.headers.get("idempotency-key") || undefined,
      });

      if (shouldKeepSlotFreeUntilPaid) {
        await prisma.appointment.updateMany({
          where: {
            id: { in: appointmentIds },
            accountId: resolved.account.id,
            status: "NEW",
          },
          data: { status: "CANCELLED" },
        });
      }

      return NextResponse.json({
        data: {
          intentId: intent.id,
          status: intent.status,
          paymentUrl: intent.paymentUrl,
          cardPaymentUrl: paymentMethodsFromPayload(intent.providerPayload).cardPaymentUrl ?? intent.paymentUrl,
          sbpQrSvg: paymentMethodsFromPayload(intent.providerPayload).sbpQrSvg,
          sbpPayload: paymentMethodsFromPayload(intent.providerPayload).sbpPayload,
          provider: intent.provider,
          providerStatus: intent.providerStatus,
          amountRub: calculation.amountRub,
          originalAmountRub: calculation.originalAmountRub,
          discountAmountRub: calculation.discountAmountRub,
          remainingAmountRub: calculation.remainingAmountRub,
          scenario: calculation.scenario,
        },
      });
    }

    const amountRub = Number(body.amountRub);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (!Number.isFinite(amountRub) || amountRub <= 0 || !description) {
      return jsonError("VALIDATION_FAILED", "Нужны amountRub и description.", null, 400);
    }

    const intent = await createAccountCheckout({
      accountId: resolved.account.id,
      amountRub,
      description,
      scenario: typeof body.scenario === "string" && body.scenario.trim() ? body.scenario.trim() : "public_checkout",
      method,
      customer: bodyCustomer(body),
      receiptItems: receiptItemsForManualCheckout({ description, amountRub }),
      returnUrl: cleanUrl(body.returnUrl),
      failUrl: cleanUrl(body.failUrl),
      idempotencyKey: request.headers.get("idempotency-key") || undefined,
    });

    return NextResponse.json({
      data: {
        intentId: intent.id,
        status: intent.status,
        paymentUrl: intent.paymentUrl,
        cardPaymentUrl: paymentMethodsFromPayload(intent.providerPayload).cardPaymentUrl ?? intent.paymentUrl,
        sbpQrSvg: paymentMethodsFromPayload(intent.providerPayload).sbpQrSvg,
        sbpPayload: paymentMethodsFromPayload(intent.providerPayload).sbpPayload,
        provider: intent.provider,
        providerStatus: intent.providerStatus,
      },
    });
  } catch (error) {
    return jsonError(
      "PUBLIC_PAYMENT_CHECKOUT_FAILED",
      error instanceof Error ? error.message : "Не удалось создать оплату.",
      null,
      400,
    );
  }
}

async function prismaAppointmentsForCheckout(appointmentIds: number[], accountId: number) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.appointment.findMany({
    where: {
      id: { in: appointmentIds },
      accountId,
      status: { not: "NO_SHOW" },
    },
    include: {
      client: true,
      account: {
        select: {
          settings: {
            select: {
              bookingOnlinePaymentMode: true,
              bookingAllowPayLater: true,
              bookingAllowPrepaymentFixed: true,
              bookingAllowPrepaymentPercent: true,
              bookingAllowFullPayment: true,
              bookingPrepaymentAmount: true,
              bookingPrepaymentPercent: true,
              bookingFullPaymentDiscountPercent: true,
              requirePaymentToConfirm: true,
            },
          },
        },
      },
      services: {
        include: { service: { select: { name: true } } },
        orderBy: { orderIndex: "asc" },
      },
      paymentIntents: {
        where: { status: { in: ["CREATED", "REQUIRES_ACTION", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          provider: true,
          providerStatus: true,
          paymentUrl: true,
          providerPayload: true,
          metadata: true,
        },
      },
    },
  });
}
