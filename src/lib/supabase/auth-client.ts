import { createBrowserClient } from "@supabase/ssr";

export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Use PKCE flow (default for @supabase/ssr). The magic link redirects to
    // /api/auth/callback?code=... where the server exchanges the code for a session.
    // The code_verifier is stored in cookies by @supabase/ssr automatically.
  );
}
