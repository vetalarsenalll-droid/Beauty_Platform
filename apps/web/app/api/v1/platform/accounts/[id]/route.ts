import { AccountOnboardingStatus, AccountStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import {
  applyAccessCookie,
  requirePlatformApiPermission,
} from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

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

function isAccountStatus(value: string): value is AccountStatus {
  return value === "ACTIVE" || value === "SUSPENDED" || value === "ARCHIVED";
}

function isOnboardingStatus(value: string): value is AccountOnboardingStatus {
  return value === "DRAFT" || value === "INVITED" || value === "ACTIVE";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id аккаунта", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { plan: true },
  });

  if (!account) {
    return jsonError("NOT_FOUND", "Аккаунт не найден", null, 404);
  }

  const response = jsonOk(mapAccount(account as DbAccount));
  return applyAccessCookie(response, auth);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id аккаунта", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Некорректное тело запроса", null, 400);
  }

  const data: Prisma.AccountUpdateInput = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.slug !== undefined) data.slug = String(body.slug).trim();
  if (body.status !== undefined) {
    const parsedStatus = String(body.status).trim();
    if (!isAccountStatus(parsedStatus)) {
      return jsonError("VALIDATION_FAILED", "Некорректный статус", {
        fields: [{ path: "status", issue: "invalid" }],
      });
    }
    data.status = parsedStatus;
  }
  if (body.onboardingStatus !== undefined) {
    const parsedOnboardingStatus = String(body.onboardingStatus).trim();
    if (!isOnboardingStatus(parsedOnboardingStatus)) {
      return jsonError("VALIDATION_FAILED", "Некорректный onboarding-статус", {
        fields: [{ path: "onboardingStatus", issue: "invalid" }],
      });
    }
    data.onboardingStatus = parsedOnboardingStatus;
  }
  if (body.timeZone !== undefined) data.timeZone = String(body.timeZone).trim();
  if (body.planId !== undefined) {
    if (body.planId === null || body.planId === "") {
      data.plan = { disconnect: true };
    } else {
      const parsedPlanId = Number(body.planId);
      if (!Number.isInteger(parsedPlanId)) {
        return jsonError("VALIDATION_FAILED", "Некорректный тариф", {
          fields: [{ path: "planId", issue: "invalid" }],
        });
      }
      data.plan = { connect: { id: parsedPlanId } };
    }
  }

  try {
    const updated = await prisma.account.update({
      where: { id: accountId },
      data,
      include: { plan: true },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Обновлен аккаунт",
      targetType: "account",
      targetId: updated.id,
      diffJson: data,
    });

    const response = jsonOk(mapAccount(updated as DbAccount));
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
    if (prismaError?.code === "P2025") {
      return jsonError("NOT_FOUND", "Аккаунт не найден", null, 404);
    }
    return jsonError("SERVER_ERROR", "Не удалось обновить аккаунт", null, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId)) {
    return jsonError("VALIDATION_FAILED", "Некорректный id аккаунта", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  try {
    const archived = await prisma.account.update({
      where: { id: accountId },
      data: { status: "ARCHIVED" },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Аккаунт архивирован",
      targetType: "account",
      targetId: archived.id,
      diffJson: { status: "ARCHIVED" },
    });

    const response = jsonOk({ id: accountId, status: "ARCHIVED" });
    return applyAccessCookie(response, auth);
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2025") {
      return jsonError("NOT_FOUND", "Аккаунт не найден", null, 404);
    }
    return jsonError("SERVER_ERROR", "Не удалось архивировать аккаунт", null, 500);
  }
}
