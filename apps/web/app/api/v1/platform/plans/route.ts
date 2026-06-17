/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";
import { generatePlatformPlanCode } from "@/lib/platform-subscriptions";
import { Prisma } from "@prisma/client";

type DbPlan = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: Prisma.Decimal;
  billingPeriodMonths: number;
  trialPeriodDays: number;
  gracePeriodDays: number;
  currency: string;
  isTrial: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapPlan(plan: DbPlan) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly.toString(),
    billingPeriodMonths: plan.billingPeriodMonths,
    trialPeriodDays: plan.trialPeriodDays,
    gracePeriodDays: plan.gracePeriodDays,
    currency: plan.currency,
    isTrial: plan.isTrial,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;

  const db = prisma as any;
  const plans = await db.platformPlan.findMany({
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(plans.map((plan: DbPlan) => mapPlan(plan)));
  return applyAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const name = String(body.name ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const currency = String(body.currency ?? "RUB").trim();
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;
  const isTrial = body.isTrial !== undefined ? Boolean(body.isTrial) : false;
  const billingPeriodMonths = Number(body.billingPeriodMonths ?? 1);
  const trialPeriodDays = Number(body.trialPeriodDays ?? 14);
  const gracePeriodDays = Number(body.gracePeriodDays ?? 5);

  if (!name || body.priceMonthly === undefined) {
    return jsonError("VALIDATION_FAILED", "Название, цена и срок подписки обязательны", {
      fields: [
        { path: "name", issue: name ? null : "required" },
        {
          path: "priceMonthly",
          issue: body.priceMonthly !== undefined ? null : "required",
        },
        {
          path: "billingPeriodMonths",
          issue: Number.isInteger(billingPeriodMonths) && billingPeriodMonths > 0 ? null : "invalid",
        },
      ],
    });
  }

  if (!Number.isInteger(billingPeriodMonths) || billingPeriodMonths <= 0) {
    return jsonError("VALIDATION_FAILED", "Некорректный срок тарифа", {
      fields: [{ path: "billingPeriodMonths", issue: "invalid" }],
    });
  }

  if (!Number.isInteger(trialPeriodDays) || trialPeriodDays <= 0) {
    return jsonError("VALIDATION_FAILED", "Некорректный срок пробного тарифа", {
      fields: [{ path: "trialPeriodDays", issue: "invalid" }],
    });
  }

  if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0) {
    return jsonError("VALIDATION_FAILED", "Некорректный льготный период", {
      fields: [{ path: "gracePeriodDays", issue: "invalid" }],
    });
  }

  let price: Prisma.Decimal;
  try {
    price = new Prisma.Decimal(body.priceMonthly);
  } catch {
    return jsonError("VALIDATION_FAILED", "Некорректная цена", {
      fields: [{ path: "priceMonthly", issue: "invalid" }],
    });
  }

  try {
    const db = prisma as any;
    const created = await db.$transaction(async (tx: any) => {
      const code = await generatePlatformPlanCode(name, tx);
      return tx.platformPlan.create({
        data: {
          name,
          code,
          description: description || undefined,
          priceMonthly: price,
          billingPeriodMonths,
          trialPeriodDays,
          gracePeriodDays,
          currency,
          isTrial,
          isActive,
        },
      });
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Создан тариф",
      targetType: "plan",
      targetId: created.id,
      diffJson: {
        name,
        code: created.code,
        description,
        priceMonthly: price.toString(),
        billingPeriodMonths,
        trialPeriodDays,
        gracePeriodDays,
        currency,
        isTrial,
        isActive,
      },
    });

    const response = jsonOk(mapPlan(created as DbPlan), 201);
    return applyAccessCookie(response, auth);
  } catch {
    return jsonError("SERVER_ERROR", "Не удалось создать тариф", null, 500);
  }
}
