import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptAccountPaymentCredentials } from "@/lib/account-payments/credentials";
import { toConnectionSnapshot } from "@/lib/account-payments/connections";
import { applyAccountPaymentState } from "@/lib/account-payments/checkout";
import { getAccountPaymentProvider } from "@/lib/account-payments/provider";
import { normalizeProviderCode } from "@/lib/account-payments/types";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params;
  const body = await parseWebhookBody(request);
  return handleWebhook(request, providerRaw, body);
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerRaw } = await params;
  const url = new URL(request.url);
  const body = Object.fromEntries(url.searchParams.entries());
  return handleWebhook(request, providerRaw, body);
}

async function handleWebhook(request: Request, providerRaw: string, body: unknown) {
  const provider = normalizeProviderCode(providerRaw);

  const event = await prisma.paymentWebhookEvent.create({
    data: {
      provider,
      providerEventId: `${provider}:${Date.now()}:${crypto.randomUUID()}`,
      payload: jsonOrNull(body),
      processingStatus: "received",
    },
  });

  try {
    const providerRef = extractProviderRef(provider, body);
    const intentId = extractIntentId(body);
    const intent = await prisma.paymentIntent.findFirst({
      where: {
        ...(intentId ? { id: intentId } : {}),
        ...(providerRef ? { providerRef } : {}),
        provider,
      },
      include: { connection: true },
      orderBy: { id: "desc" },
    });

    if (!intent?.connection) {
      await prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: "ignored",
          intentId: intent?.id ?? null,
          accountId: intent?.accountId ?? null,
          processedAt: new Date(),
        },
      });
      return NextResponse.json({ ok: true, ignored: true });
    }

    const snapshot = toConnectionSnapshot(intent.connection);
    const credentials = decryptAccountPaymentCredentials(intent.connection.credentialsEncrypted);
    const adapter = getAccountPaymentProvider(snapshot.provider);
    const verified = await adapter.verifyWebhook({
      connection: snapshot,
      credentials,
      body,
      headers: request.headers,
    });

    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        accountId: intent.accountId,
        intentId: intent.id,
        processingStatus: "verified",
      },
    });

    if (verified.normalizedStatus && verified.providerStatus) {
      await applyAccountPaymentState({
        intentId: intent.id,
        providerStatus: verified.providerStatus,
        normalizedStatus: verified.normalizedStatus,
        raw: verified.raw,
      });
    }

    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { processingStatus: "processed", processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: {
        processingStatus: "failed",
        processingError: error instanceof Error ? error.message : String(error),
        processedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

async function parseWebhookBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) as unknown;
  }
  const text = await request.text().catch(() => "");
  if (!text) return null;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}

function extractProviderRef(provider: string, body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (provider === "tbank") {
    return typeof record.PaymentId === "string" ? record.PaymentId : null;
  }
  if (provider === "yookassa") {
    const object = record.object;
    if (object && typeof object === "object" && "id" in object) {
      const objectRecord = object as Record<string, unknown>;
      const event = typeof record.event === "string" ? record.event : "";
      const value = event.startsWith("refund.") ? objectRecord.payment_id : objectRecord.id;
      return typeof value === "string" ? value : null;
    }
  }
  if (provider === "sber" || provider === "alfa") {
    const value = record.mdOrder ?? record.orderId ?? record.orderID;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function extractIntentId(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const data = record.DATA;
  if (data && typeof data === "object") {
    const value = (data as Record<string, unknown>).paymentIntentId;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  const object = record.object;
  if (object && typeof object === "object") {
    const metadata = (object as Record<string, unknown>).metadata;
    if (metadata && typeof metadata === "object") {
      const value = (metadata as Record<string, unknown>).paymentIntentId;
      if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    }
  }
  const orderNumber = record.orderNumber ?? record.OrderNumber;
  if (typeof orderNumber === "string") {
    const match = orderNumber.match(/^account_intent_(\d+)_/);
    if (match) return Number(match[1]);
  }
  const jsonParams = record.jsonParams ?? record.JsonParams;
  if (typeof jsonParams === "string") {
    try {
      const parsed = JSON.parse(jsonParams) as Record<string, unknown>;
      const value = parsed.paymentIntentId;
      if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
    } catch {
      return null;
    }
  }
  return null;
}

function jsonOrNull(value: unknown): typeof Prisma.JsonNull | Prisma.InputJsonValue {
  return value === undefined || value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}
