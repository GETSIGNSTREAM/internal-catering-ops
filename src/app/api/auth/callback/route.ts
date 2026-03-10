import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/orders";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    console.error("[Auth callback] Code exchange failed:", error.message);
  }

  // If no code or code exchange failed, redirect to client-side callback page
  // which can handle hash-fragment tokens (mobile magic links often use implicit flow)
  const clientCallbackUrl = new URL("/auth/callback", request.url);
  if (redirectTo !== "/orders") {
    clientCallbackUrl.searchParams.set("redirect", redirectTo);
  }
  // Pass along any error info for debugging
  if (code) {
    clientCallbackUrl.searchParams.set("code_failed", "true");
  }
  return NextResponse.redirect(clientCallbackUrl);
}
