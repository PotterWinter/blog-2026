import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readCookie } from "@/lib/cookie";

// /admin/… without a good session cookie → /login (and back after). Only the cookie's
// signature and expiry are checked here, no repo read; admin pages check the device is
// still signed in (currentSession) before they show or change anything.
export function proxy(request: NextRequest) {
  if (readCookie(request.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
