import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/platform") && pathname !== "/platform/login") {
    const session = request.cookies.get("bp_session");
    if (!session) {
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
