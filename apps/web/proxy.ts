import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_FILE = /\.(?:.*)$/;

function normalizeHost(value: string | null) {
  const host = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return host.replace(/:\d+$/, "").replace(/\.$/, "");
}

function shouldSkipCustomDomainRewrite(pathname: string) {
  const isRootHtmlVerificationFile =
    /^\/[a-zA-Z0-9._-]+\.html$/.test(pathname) &&
    !pathname.includes("..");
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/uploads/") ||
    pathname.startsWith("/crm") ||
    pathname.startsWith("/platform") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    (!isRootHtmlVerificationFile && PUBLIC_FILE.test(pathname))
  );
}

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function getInternalAppOrigin(fallback: string) {
  return (
    process.env.APP_INTERNAL_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.PLATFORM_PUBLIC_ORIGIN?.trim() ||
    fallback
  ).replace(/\/+$/, "");
}

async function resolveCustomDomainRewrite(request: NextRequest) {
  const { nextUrl } = request;
  if (shouldSkipCustomDomainRewrite(nextUrl.pathname)) {
    return null;
  }

  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  );
  if (!host) return null;
  if (isLocalHost(host)) return null;

  const resolveUrl = new URL(
    "/api/internal/domains/resolve",
    getInternalAppOrigin(nextUrl.origin)
  );
  resolveUrl.searchParams.set("host", host);

  const response = await fetch(resolveUrl, {
    headers: { accept: "application/json" },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;

  const payload = (await response.json().catch(() => null)) as
    | { data?: { publicSlug?: string; primaryDomain?: string } | null }
    | null;
  const resolved = payload?.data;
  if (!resolved?.publicSlug) return null;

  const technicalPath = `/${resolved.publicSlug}`;
  if (
    nextUrl.pathname === technicalPath ||
    nextUrl.pathname.startsWith(`${technicalPath}/`)
  ) {
    const headers = new Headers(request.headers);
    headers.set("x-bp-custom-domain", host);
    headers.set("x-bp-public-base-path", "");
    headers.set("x-forwarded-host", host);
    return NextResponse.next({
      request: { headers },
    });
  }

  if (resolved.primaryDomain && host !== resolved.primaryDomain) {
    const redirectUrl = nextUrl.clone();
    redirectUrl.hostname = resolved.primaryDomain;
    return NextResponse.redirect(redirectUrl, 308);
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname =
    nextUrl.pathname === "/"
      ? technicalPath
      : `${technicalPath}${nextUrl.pathname}`;
  rewriteUrl.searchParams.set("__bp_custom_domain", "1");

  const headers = new Headers(request.headers);
  headers.set("x-bp-custom-domain", host);
  headers.set("x-bp-public-base-path", "");
  headers.set("x-forwarded-host", host);

  return NextResponse.rewrite(rewriteUrl, {
    request: { headers },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/platform") && pathname !== "/platform/login") {
    const access = request.cookies.get("bp_access");
    const refresh = request.cookies.get("bp_refresh");
    if (!access && !refresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/platform/login";
      return NextResponse.redirect(url);
    }
  }

  if (
    pathname.startsWith("/crm") &&
    pathname !== "/crm/login" &&
    pathname !== "/crm/register"
  ) {
    const access = request.cookies.get("bp_crm_access");
    const refresh = request.cookies.get("bp_crm_refresh");
    if (!access && !refresh) {
      const url = request.nextUrl.clone();
      url.pathname = "/crm/login";
      return NextResponse.redirect(url);
    }
  }

  return (await resolveCustomDomainRewrite(request)) ?? NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
