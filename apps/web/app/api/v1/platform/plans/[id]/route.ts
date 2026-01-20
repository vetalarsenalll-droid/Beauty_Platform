import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

type DbPlan = {
  id: number;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: Prisma.Decimal;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function mapPlan(plan: DbPlan) {
  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    priceMonthly: plan.priceMonthly.toString(),
    currency: plan.currency,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Invalid plan id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const plan = await prisma.platformPlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return jsonError("NOT_FOUND", "Plan not found", null, 404);
  }

  const response = jsonOk(mapPlan(plan as DbPlan));
  return applyAccessCookie(response, auth);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Invalid plan id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid JSON body", null, 400);
  }

  const data: {
    name?: string;
    code?: string;
    description?: string | null;
    priceMonthly?: Prisma.Decimal;
    currency?: string;
    isActive?: boolean;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.code !== undefined) data.code = String(body.code).trim();
  if (body.description !== undefined)
    data.description = body.description ? String(body.description).trim() : null;
  if (body.currency !== undefined) data.currency = String(body.currency).trim();
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.priceMonthly !== undefined) {
    try {
      data.priceMonthly = new Prisma.Decimal(body.priceMonthly);
    } catch {
      return jsonError("VALIDATION_FAILED", "Invalid price", {
        fields: [{ path: "priceMonthly", issue: "invalid" }],
      });
    }
  }

  try {
    const updated = await prisma.platformPlan.update({
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
        priceMonthly: data.priceMonthly ? data.priceMonthly.toString() : undefined,
      },
    });

    const response = jsonOk(mapPlan(updated as DbPlan));
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = Array.isArray(error?.meta?.target)
        ? error.meta.target[0]
        : error?.meta?.target;
      const field = target === "name" ? "name" : "code";
      const message = field === "name" ? "Name already exists" : "Code already exists";
      return jsonError("DUPLICATE", message, { field }, 409);
    }
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Plan not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to update plan", null, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const planId = Number(id);
  if (!Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Invalid plan id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  try {
    const archived = await prisma.platformPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Тариф отключен",
      targetType: "plan",
      targetId: archived.id,
      diffJson: { isActive: false },
    });

    const response = jsonOk({ id: planId, isActive: false });
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Plan not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to disable plan", null, 500);
  }
}
