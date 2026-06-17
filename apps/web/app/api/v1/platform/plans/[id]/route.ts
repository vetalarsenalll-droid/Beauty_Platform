/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

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

export async function GET(_request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id тарифа", null, 400);
  }

  const db = prisma as any;
  const plan = await db.platformPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return jsonError("NOT_FOUND", "Тариф не найден", null, 404);
  }

  const response = jsonOk(mapPlan(plan as DbPlan));
  return applyAccessCookie(response, auth);
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id тарифа", null, 400);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const data: {
    name?: string;
    description?: string | null;
    priceMonthly?: Prisma.Decimal;
    billingPeriodMonths?: number;
    trialPeriodDays?: number;
    gracePeriodDays?: number;
    currency?: string;
    isTrial?: boolean;
    isActive?: boolean;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim() : null;
  }
  if (body.currency !== undefined) data.currency = String(body.currency).trim();
  if (body.isTrial !== undefined) data.isTrial = Boolean(body.isTrial);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.billingPeriodMonths !== undefined) {
    const value = Number(body.billingPeriodMonths);
    if (!Number.isInteger(value) || value <= 0) {
      return jsonError("VALIDATION_FAILED", "Некорректный срок тарифа", {
        fields: [{ path: "billingPeriodMonths", issue: "invalid" }],
      });
    }
    data.billingPeriodMonths = value;
  }
  if (body.trialPeriodDays !== undefined) {
    const value = Number(body.trialPeriodDays);
    if (!Number.isInteger(value) || value <= 0) {
      return jsonError("VALIDATION_FAILED", "Некорректный срок пробного тарифа", {
        fields: [{ path: "trialPeriodDays", issue: "invalid" }],
      });
    }
    data.trialPeriodDays = value;
  }
  if (body.gracePeriodDays !== undefined) {
    const value = Number(body.gracePeriodDays);
    if (!Number.isInteger(value) || value < 0) {
      return jsonError("VALIDATION_FAILED", "Некорректный льготный период", {
        fields: [{ path: "gracePeriodDays", issue: "invalid" }],
      });
    }
    data.gracePeriodDays = value;
  }
  if (body.priceMonthly !== undefined) {
    try {
      data.priceMonthly = new Prisma.Decimal(body.priceMonthly);
    } catch {
      return jsonError("VALIDATION_FAILED", "Некорректная цена", {
        fields: [{ path: "priceMonthly", issue: "invalid" }],
      });
    }
  }

  try {
    const db = prisma as any;
    const updated = await db.platformPlan.update({
      where: { id: planId },
      data,
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Обновлен тариф",
      targetType: "plan",
      targetId: updated.id,
      diffJson: {
        ...data,
        priceMonthly: data.priceMonthly?.toString(),
      },
    });

    const response = jsonOk(mapPlan(updated as DbPlan));
    return applyAccessCookie(response, auth);
  } catch (error: unknown) {
    const caught = error as { code?: string };
    if (caught.code === "P2025") {
      return jsonError("NOT_FOUND", "Тариф не найден", null, 404);
    }
    return jsonError("SERVER_ERROR", "Не удалось обновить тариф", null, 500);
  }
}
