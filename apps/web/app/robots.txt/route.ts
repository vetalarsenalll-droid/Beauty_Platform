import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSystemHost, normalizeHost } from "@/lib/account-domains";

export async function GET(request: Request) {
  const host = normalizeHost(request.headers.get("host") ?? "localhost:3000");
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";
  const sitemapUrl = `${protocol}://${host}/sitemap.xml`;
  const isCustomDomain = host && !isSystemHost(host);

  const customDomain = isCustomDomain
    ? await prisma.accountDomain.findFirst({
        where: {
          domain: host,
          verifiedAt: { not: null },
          account: { status: "ACTIVE" },
        },
        select: {
          account: {
            select: {
              seoSettings: { select: { robots: true, sitemapEnabled: true } },
            },
          },
        },
      })
    : null;

  const customRobots = customDomain?.account.seoSettings?.robots?.trim();
  if (customRobots) {
    return new NextResponse(customRobots, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const body = [
    "User-Agent: *",
    ...(isCustomDomain ? [] : ["Disallow: /crm", "Disallow: /platform"]),
    "Disallow: /_next",
    "Disallow: /api",
    "",
    ...(customDomain?.account.seoSettings?.sitemapEnabled === false
      ? []
      : [`Sitemap: ${sitemapUrl}`]),
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
