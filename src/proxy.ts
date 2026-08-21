import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login", "/forgot-password"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isStaticAsset = /\.[a-zA-Z0-9]+$/.test(pathname);
  const isPublic =
    isStaticAsset || PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && req.auth.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
