import { NextResponse } from "next/server";
import { requireCrmPermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { checkDomainDns, getDomainStatusFromDns } from "@/lib/account-domains";

type RouteContext = {
  params: Promise<{ id?: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const session = await requireCrmPermission("crm.settings.update");
  const params = await context.params;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonError("INVALID_DOMAIN_ID", "Некорректный домен.", null, 400);
  }

  const domain = await prisma.accountDomain.findFirst({
    where: { id, accountId: session.accountId },
  });
  if (!domain) {
    return jsonError("DOMAIN_NOT_FOUND", "Домен не найден.", null, 404);
  }

  const check = await checkDomainDns(domain.domain);
  const status = getDomainStatusFromDns(check);
  const updated = await prisma.accountDomain.update({
    where: { id: domain.id },
    data: {
      status,
      verifiedAt: check.ok ? new Date() : null,
      lastCheckedAt: new Date(),
      lastError: check.error ?? check.warning,
    },
  });

  return NextResponse.json({
    data: {
      domain: {
        ...updated,
        verifiedAt: updated.verifiedAt?.toISOString() ?? null,
        lastCheckedAt: updated.lastCheckedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      check,
    },
  });
}
