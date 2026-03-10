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

  // No code or code exchange failed — the token may be in the URL hash fragment
  // (implicit flow: #access_token=...). Hash fragments are never sent to the server,
  // so we can't redirect (302/303 strips the hash). Instead, return an HTML page
  // that reads the hash client-side and forwards it to the client-side callback.
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Signing in...</title></head>
<body>
<script>
  // Forward hash fragment to client-side callback that can process it
  var hash = window.location.hash;
  var dest = "/auth/callback";
  if (hash) {
    dest += hash;
  } else {
    dest += "?error=no_token";
  }
  window.location.replace(dest);
</script>
<p>Signing you in...</p>
</body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
