import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { applyAccessCookie, requirePlatformApiPermission } from "@/lib/platform-api";
import { logPlatformAudit } from "@/lib/audit";

type DbAccount = {
  id: number;
  name: string;
  slug: string;
  status: string;
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
    timeZone: account.timeZone,
    plan: account.plan ? { id: account.plan.id, name: account.plan.name } : null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
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
    return jsonError("VALIDATION_FAILED", "Invalid account id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: { plan: true },
  });

  if (!account) {
    return jsonError("NOT_FOUND", "Account not found", null, 404);
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
    return jsonError("VALIDATION_FAILED", "Invalid account id", {
      fields: [{ path: "id", issue: "invalid" }],
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid JSON body", null, 400);
  }

  const data: {
    name?: string;
    slug?: string;
    status?: string;
    timeZone?: string;
    planId?: number | null;
  } = {};

  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.slug !== undefined) data.slug = String(body.slug).trim();
  if (body.status !== undefined) data.status = String(body.status).trim();
  if (body.timeZone !== undefined) data.timeZone = String(body.timeZone).trim();
  if (body.planId !== undefined) {
    if (body.planId === null || body.planId === "") {
      data.planId = null;
    } else {
      const parsedPlanId = Number(body.planId);
      if (!Number.isInteger(parsedPlanId)) {
        return jsonError("VALIDATION_FAILED", "Invalid planId", {
          fields: [{ path: "planId", issue: "invalid" }],
        });
      }
      data.planId = parsedPlanId;
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
  } catch (error: any) {
    if (error?.code === "P2002") {
      const target = Array.isArray(error?.meta?.target)
        ? error.meta.target[0]
        : error?.meta?.target;
      const field = target === "slug" ? "slug" : "name";
      const message = field === "slug" ? "Slug already exists" : "Name already exists";
      return jsonError("DUPLICATE", message, { field }, 409);
    }
    if (error?.code === "P2003") {
      return jsonError("VALIDATION_FAILED", "Plan not found", {
        fields: [{ path: "planId", issue: "not_found" }],
      });
    }
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Account not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to update account", null, 500);
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
    return jsonError("VALIDATION_FAILED", "Invalid account id", {
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
  } catch (error: any) {
    if (error?.code === "P2025") {
      return jsonError("NOT_FOUND", "Account not found", null, 404);
    }
    return jsonError("SERVER_ERROR", "Failed to archive account", null, 500);
  }
}
