import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/api";
import { requirePlatformApiPermission } from "@/lib/platform-api";
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

export async function GET() {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;

  const accounts = await prisma.account.findMany({
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  return jsonOk(accounts.map((account) => mapAccount(account as DbAccount)));
}

export async function POST(request: Request) {
  const auth = await requirePlatformApiPermission("platform.accounts");
  if ("response" in auth) return auth.response;
  const session = auth.session;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("INVALID_BODY", "Invalid JSON body", null, 400);
  }

  const name = String(body.name ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  const timeZone = String(body.timeZone ?? "Europe/Moscow").trim();
  const planId =
    body.planId !== undefined && body.planId !== null && body.planId !== ""
      ? Number(body.planId)
      : null;

  if (!name || !slug) {
    return jsonError("VALIDATION_FAILED", "Name and slug are required", {
      fields: [
        { path: "name", issue: name ? null : "required" },
        { path: "slug", issue: slug ? null : "required" },
      ],
    });
  }

  if (planId !== null && !Number.isInteger(planId)) {
    return jsonError("VALIDATION_FAILED", "Invalid planId", {
      fields: [{ path: "planId", issue: "invalid" }],
    });
  }

  try {
    const created = await prisma.account.create({
      data: {
        name,
        slug,
        timeZone,
        planId: planId ?? undefined,
      },
      include: { plan: true },
    });

    await logPlatformAudit({
      adminId: session.adminId,
      action: "Создан аккаунт",
      targetType: "account",
      targetId: created.id,
      diffJson: { name, slug, timeZone, planId },
    });

    return jsonOk(mapAccount(created as DbAccount), 201);
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
    return jsonError("SERVER_ERROR", "Failed to create account", null, 500);
  }
}
