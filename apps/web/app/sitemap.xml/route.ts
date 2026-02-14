import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPublicSlugId } from "@/lib/public-slug";

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";

  const pages = await prisma.publicPage.findMany({
    where: {
      status: "PUBLISHED",
      publishedVersionId: { not: null },
    },
    include: {
      account: { select: { id: true, slug: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const urls = pages.map((page) => {
    const slug = buildPublicSlugId(page.account.slug, page.account.id);
    const loc = `${protocol}://${host}/${slug}`;
    const lastmod = page.updatedAt.toISOString();
    return { loc, lastmod };
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (item) =>
        `  <url>\n    <loc>${item.loc}</loc>\n    <lastmod>${item.lastmod}</lastmod>\n  </url>`
    )
    .join("\n")}\n</urlset>\n`;

  return new NextResponse(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
