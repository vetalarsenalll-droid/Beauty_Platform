import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : "https";
  const sitemapUrl = `${protocol}://${host}/sitemap.xml`;

  const body = [
    "User-Agent: *",
    "Disallow: /crm",
    "Disallow: /platform",
    "Disallow: /api",
    "Disallow: /booking",
    "Disallow: /legal",
    "Disallow: /_next",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");

  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
