import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session token
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Role-based routing: admin-only pages and driver redirect
  const adminPaths = ["/team", "/stores", "/store-performance"];
  const needsRoleCheck = adminPaths.some((p) => pathname.startsWith(p)) ||
    pathname === "/" || pathname === "/orders" || pathname === "/driver";

  if (needsRoleCheck) {
    // Read role from Supabase app_metadata (embedded in JWT — no DB query needed)
    const dbRole = user.app_metadata?.role as string | undefined;

    if (!dbRole) {
      console.warn(`[Middleware] No role in app_metadata for user=${user.id} (email: ${user.email})`);
    }

    // Check for admin view-as override (only honored for actual admins)
    const viewAsCookie = request.cookies.get("viewAsRole")?.value;
    const effectiveRole = (dbRole === "admin" && viewAsCookie) ? viewAsCookie : dbRole;

    // Admin-only pages — block non-admins (effective role)
    if (adminPaths.some((p) => pathname.startsWith(p)) && effectiveRole !== "admin") {
      return NextResponse.redirect(new URL("/orders", request.url));
    }

    // Redirect drivers from root/orders to /driver
    if (effectiveRole === "driver" && (pathname === "/" || pathname === "/orders")) {
      return NextResponse.redirect(new URL("/driver", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!login|track|api/auth/callback|api/auth/magic-link|api/health|api/push/vapid-public-key|_next/static|_next/image|favicon.ico|manifest.json|icons|push-handler.js).*)",
  ],
};
