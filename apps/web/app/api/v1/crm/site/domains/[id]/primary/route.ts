import { NextResponse } from "next/server";
import { requireCrmPermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id?: string }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
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

  await prisma.$transaction([
    prisma.accountDomain.updateMany({
      where: { accountId: session.accountId },
      data: { isPrimary: false },
    }),
    prisma.accountDomain.update({
      where: { id },
      data: { isPrimary: true },
    }),
  ]);

  return NextResponse.json({ data: { ok: true } });
}
