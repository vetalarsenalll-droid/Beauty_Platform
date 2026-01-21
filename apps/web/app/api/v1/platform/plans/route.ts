import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
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

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.plans");
  if ("response" in auth) return auth.response;

  const plans = await prisma.platformPlan.findMany({
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(plans.map((plan) => mapPlan(plan as DbPlan)));
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
  const code = String(body.code ?? "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const currency = String(body.currency ?? "RUB").trim();
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

  if (!name || !code || body.priceMonthly === undefined) {
    return jsonError("VALIDATION_FAILED", "Название, код и цена обязательны", {
      fields: [
        { path: "name", issue: name ? null : "required" },
        { path: "code", issue: code ? null : "required" },
        {
          path: "priceMonthly",
          issue: body.priceMonthly !== undefined ? null : "required",
        },
      ],
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
    const created = await prisma.platformPlan.create({
      data: {
        name,
        code,
        description: description || undefined,
        priceMonthly: price,
        currency,
        isActive,
      },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Создан тариф",
      targetType: "plan",
      targetId: created.id,
      diffJson: {
        name,
        code,
        description,
        priceMonthly: price.toString(),
        currency,
        isActive,
      },
    });

    const response = jsonOk(mapPlan(created as DbPlan), 201);
    return applyAccessCookie(response, auth);
  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = Array.isArray(error?.meta?.target)
        ? error.meta.target[0]
        : error?.meta?.target;
      const field = target === "name" ? "name" : "code";
      const message =
        field === "name" ? "Название уже используется" : "Код уже используется";
      return jsonError("DUPLICATE", message, { field }, 409);
    }
    return jsonError("SERVER_ERROR", "Не удалось создать тариф", null, 500);
  }
}
