import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only pages
    const adminPaths = ["/team", "/stores", "/store-performance"];
    if (adminPaths.some((p) => path.startsWith(p)) && token?.role !== "admin") {
      return NextResponse.redirect(new URL("/orders", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/((?!login|track|api/auth|api/health|api/push/vapid-public-key|_next/static|_next/image|favicon.ico|manifest.json|icons|push-handler.js).*)",
  ],
};
