import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
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
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl?: string;
  failUrl?: string;
};

function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

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

function receiptItemsForAppointment(input: {
  description: string;
  amountRub: number;
  services: Array<{ service: { name: string }; price: Prisma.Decimal; durationMin: number }>;
}): AccountReceiptItemInput[] {
  if (!input.services.length) {
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

  return input.services.map((item) => {
    const amountRub = decimalToNumber(item.price);
    return {
      name: item.service.name,
      quantity: 1,
      unitPriceRub: amountRub,
      amountRub,
      vat: "NONE",
      paymentSubject: "service",
      paymentMethod: "full_payment",
    };
  });
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
      const appointment = await prisma.appointment.findFirst({
        where: {
          id: appointmentId,
          accountId: resolved.account.id,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        include: {
          client: true,
          services: {
            include: { service: { select: { name: true } } },
            orderBy: { orderIndex: "asc" },
          },
        },
      });

      if (!appointment) {
        return jsonError("APPOINTMENT_NOT_FOUND", "Запись не найдена.", null, 404);
      }

      const amountRub = decimalToNumber(appointment.priceTotal);
      if (!Number.isFinite(amountRub) || amountRub <= 0) {
        return jsonError("INVALID_AMOUNT", "У записи нет суммы для оплаты.", null, 400);
      }

      const serviceNames = appointment.services.map((item) => item.service.name).filter(Boolean);
      const description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : serviceNames.length
            ? `Оплата записи: ${serviceNames.join(", ")}`.slice(0, 250)
            : `Оплата записи #${appointment.id}`;

      const intent = await createAccountCheckout({
        accountId: resolved.account.id,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        amountRub,
        description,
        scenario: body.scenario === "appointment_prepayment" ? "appointment_prepayment" : "appointment_full_payment",
        method,
        customer: {
          fullName: body.customerName ?? appointment.client.firstName ?? null,
          email: body.customerEmail ?? appointment.client.email ?? null,
          phone: body.customerPhone ?? appointment.client.phone ?? null,
        },
        receiptItems: receiptItemsForAppointment({
          description,
          amountRub,
          services: appointment.services,
        }),
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
      receiptItems: [
        {
          name: description,
          quantity: 1,
          unitPriceRub: amountRub,
          amountRub,
          vat: "NONE",
          paymentSubject: "service",
          paymentMethod: "full_payment",
        },
      ],
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
