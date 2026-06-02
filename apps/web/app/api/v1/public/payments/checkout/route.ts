import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import {
  bookingPaymentMetadata,
  bookingPaymentReceiptItem,
  calculateAppointmentOnlinePayment,
  normalizeBookingPaymentOption,
} from "@/lib/account-payments/booking-payment";
import { createAccountCheckout } from "@/lib/account-payments/checkout";
import { resolvePublicAccount } from "@/lib/public-booking";
import type { AccountPaymentMethodCode, AccountReceiptItemInput } from "@/lib/account-payments/types";

export const runtime = "nodejs";

type CheckoutBody = {
  appointmentId?: number;
  amountRub?: number;
  description?: string;
  scenario?: string;
  method?: string;
  paymentOption?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
  failUrl?: string;
};

function normalizeMethod(value: unknown): AccountPaymentMethodCode {
  return value === "sbp" || value === "tpay" || value === "sberpay" ? value : "card";
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

export async function POST(request: Request) {
  const resolved = await resolvePublicAccount(request);
  if (resolved.response) return resolved.response;

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  if (!body) return jsonError("INVALID_BODY", "Некорректный запрос.", null, 400);

  const appointmentId = Number(body.appointmentId);
  const method = normalizeMethod(body.method);

  try {
    if (Number.isInteger(appointmentId) && appointmentId > 0) {
      const appointment = await prismaAppointmentForCheckout(appointmentId, resolved.account.id);
      if (!appointment) {
        return jsonError("APPOINTMENT_NOT_FOUND", "Запись не найдена.", null, 404);
      }

      const calculation = calculateAppointmentOnlinePayment({
        appointmentTotalRub: appointment.priceTotal,
        settings: appointment.account.settings,
        paymentOption: normalizeBookingPaymentOption(body.paymentOption),
      });
      if (!calculation) {
        return jsonError("ONLINE_PAYMENT_DISABLED", "Онлайн-оплата для записи не включена.", null, 400);
      }

      const serviceNames = appointment.services.map((item) => item.service.name).filter(Boolean);
      const description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : serviceNames.length
            ? `${calculation.descriptionPrefix}: ${serviceNames.join(", ")}`.slice(0, 250)
            : `${calculation.descriptionPrefix} #${appointment.id}`;

      const existingIntent = appointment.paymentIntents[0] ?? null;
      if (existingIntent?.paymentUrl) {
        return NextResponse.json({
          data: {
            intentId: existingIntent.id,
            status: existingIntent.status,
            paymentUrl: existingIntent.paymentUrl,
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

      const intent = await createAccountCheckout({
        accountId: resolved.account.id,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        amountRub: calculation.amountRub,
        description,
        scenario: calculation.scenario,
        method,
        customer: {
          fullName: body.customerName ?? appointment.client.firstName ?? null,
          email: body.customerEmail ?? appointment.client.email ?? null,
          phone: body.customerPhone ?? appointment.client.phone ?? null,
        },
        receiptItems: [bookingPaymentReceiptItem({ description, calculation })],
        metadata: bookingPaymentMetadata(calculation),
        returnUrl: cleanUrl(body.returnUrl),
        failUrl: cleanUrl(body.failUrl),
        idempotencyKey: request.headers.get("idempotency-key") || undefined,
      });

      return NextResponse.json({
        data: {
          intentId: intent.id,
          status: intent.status,
          paymentUrl: intent.paymentUrl,
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
      customer: {
        fullName: body.customerName ?? null,
        email: body.customerEmail ?? null,
        phone: body.customerPhone ?? null,
      },
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

async function prismaAppointmentForCheckout(appointmentId: number, accountId: number) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      accountId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
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
        },
      },
    },
  });
}
