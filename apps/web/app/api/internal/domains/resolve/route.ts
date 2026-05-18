import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildAccountPublicSlug,
  isSystemHost,
  normalizeHost,
} from "@/lib/account-domains";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = normalizeHost(url.searchParams.get("host"));
  if (!host || isSystemHost(host)) {
    return NextResponse.json({ data: null });
  }

  const record = await prisma.accountDomain.findFirst({
    where: {
      domain: host,
      verifiedAt: { not: null },
      account: { status: "ACTIVE" },
    },
    select: {
      domain: true,
      isPrimary: true,
      account: { select: { id: true, slug: true } },
    },
  });

  if (!record) {
    return NextResponse.json({ data: null });
  }

  const primary = record.isPrimary
    ? record
    : await prisma.accountDomain.findFirst({
        where: {
          accountId: record.account.id,
          isPrimary: true,
          verifiedAt: { not: null },
        },
        select: { domain: true },
      });

  return NextResponse.json({
    data: {
      domain: record.domain,
      primaryDomain: primary?.domain ?? record.domain,
      publicSlug: buildAccountPublicSlug(record.account),
    },
  });
}
