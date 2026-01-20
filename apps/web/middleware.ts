import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/platform/:path*"],
};
