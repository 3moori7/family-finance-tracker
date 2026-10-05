import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap first gate: requests without a session cookie never reach owner pages.
 * Cookie signatures are verified in the server code (requireOwner / father session checks).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/view") ||
    pathname.startsWith("/api/cron") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/robots.txt" ||
    pathname === "/sw.js" ||
    pathname === "/offline.html" ||
    pathname.startsWith("/icons");
  if (isPublic) return NextResponse.next();
  if (!request.cookies.get("ff_owner")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
