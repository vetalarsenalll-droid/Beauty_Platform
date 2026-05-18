import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCrmPermission } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  getPlatformPublicIp,
  getPlatformPublicOrigin,
  normalizeDomainInput,
} from "@/lib/account-domains";

function serializeDomain(domain: {
  id: number;
  domain: string;
  isPrimary: boolean;
  status: string;
  sslStatus: string;
  verifiedAt: Date | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...domain,
    verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await requireCrmPermission("crm.settings.read");
  const domains = await prisma.accountDomain.findMany({
    where: { accountId: session.accountId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({
    data: {
      platformPublicOrigin: getPlatformPublicOrigin(),
      platformPublicIp: getPlatformPublicIp(),
      domains: domains.map(serializeDomain),
    },
  });
}

export async function POST(request: Request) {
  const session = await requireCrmPermission("crm.settings.update");
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const normalized = normalizeDomainInput(body?.domain);
  if (normalized.error) {
    return jsonError("INVALID_DOMAIN", normalized.error, { domain: normalized.domain }, 400);
  }

  const existing = await prisma.accountDomain.findUnique({
    where: { domain: normalized.domain },
  });
  if (existing && existing.accountId !== session.accountId) {
    return jsonError("DOMAIN_TAKEN", "Этот домен уже подключен к другому аккаунту.", null, 409);
  }
  if (existing && existing.accountId === session.accountId) {
    return NextResponse.json({ data: serializeDomain(existing) });
  }

  try {
    const count = await prisma.accountDomain.count({
      where: { accountId: session.accountId },
    });
    const created = await prisma.accountDomain.create({
      data: {
        accountId: session.accountId,
        domain: normalized.domain,
        isPrimary: count === 0,
        status: "PENDING",
        sslStatus: "PENDING",
      },
    });
    return NextResponse.json({ data: serializeDomain(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("DOMAIN_TAKEN", "Этот домен уже подключен.", null, 409);
    }
    throw error;
  }
}
