import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { createDefaultDraft } from "@/lib/site-builder";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";

type DbAccount = {
  id: number;
  name: string;
  slug: string;
  status: string;
  onboardingStatus: string;
  timeZone: string;
  planId: number | null;
  createdAt: Date;
  updatedAt: Date;
  plan: { id: number; name: string } | null;
};

function mapAccount(account: DbAccount) {
  return {
    id: account.id,
    name: account.name,
    slug: account.slug,
    status: account.status,
    onboardingStatus: account.onboardingStatus,
    timeZone: account.timeZone,
    plan: account.plan ? { id: account.plan.id, name: account.plan.name } : null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;

  const accounts = await prisma.account.findMany({
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  const response = jsonOk(
    accounts.map((account) => mapAccount(account as DbAccount))
  );
  return applyAccessCookie(response, auth);
}

export async function POST(request: Request) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  const timeZone = String(body.timeZone ?? "Europe/Moscow").trim();
  const planId =
    body.planId !== undefined && body.planId !== null && body.planId !== ""
      ? Number(body.planId)
      : null;

  if (!name || !slug) {
    return jsonError("VALIDATION_FAILED", "Название и ссылка обязательны", {
      fields: [
        { path: "name", issue: name ? null : "required" },
        { path: "slug", issue: slug ? null : "required" },
      ],
    });
  }

  if (planId !== null && !Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный тариф", {
      fields: [{ path: "planId", issue: "invalid" }],
    });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name,
          slug,
          onboardingStatus: "DRAFT",
          timeZone,
          planId: planId ?? undefined,
        },
        include: { plan: true },
      });

      await tx.publicPage.create({
        data: {
          accountId: account.id,
          status: "DRAFT",
          draftJson: createDefaultDraft(name) as Prisma.InputJsonValue,
        },
      });

      return account;
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Создан аккаунт",
      targetType: "account",
      targetId: created.id,
      diffJson: { name, slug, timeZone, planId },
    });

    const response = jsonOk(mapAccount(created as DbAccount), 201);
    return applyAccessCookie(response, auth);
  } catch (error: unknown) {
    const prismaError = error as {
      code?: string;
      meta?: { target?: string | string[] };
    };
    if (prismaError?.code === "P2002") {
      const target = Array.isArray(prismaError?.meta?.target)
        ? prismaError.meta.target[0]
        : prismaError?.meta?.target;
      const field = target === "slug" ? "slug" : "name";
      const message =
        field === "slug"
          ? "Публичная ссылка уже используется"
          : "Название уже используется";
      return jsonError("DUPLICATE", message, { field }, 409);
    }
    if (prismaError?.code === "P2003") {
      return jsonError("VALIDATION_FAILED", "Тариф не найден", {
        fields: [{ path: "planId", issue: "not_found" }],
      });
    }
    return jsonError("SERVER_ERROR", "Не удалось создать аккаунт", null, 500);
  }
}
