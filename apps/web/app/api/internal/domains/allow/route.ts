import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/account-domains";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = process.env.DOMAIN_TLS_ASK_SECRET?.trim();
  if (secret && url.searchParams.get("secret") !== secret) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const domain = normalizeHost(url.searchParams.get("domain"));
  if (!domain) {
    return new NextResponse("bad request", { status: 400 });
  }

  const record = await prisma.accountDomain.findFirst({
    where: {
      domain,
      verifiedAt: { not: null },
      account: { status: "ACTIVE" },
    },
    select: { id: true },
  });

  return new NextResponse(record ? "ok" : "forbidden", {
    status: record ? 200 : 403,
  });
}
