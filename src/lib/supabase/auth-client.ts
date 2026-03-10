import { createBrowserClient } from "@supabase/ssr";

export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Use implicit flow so magic link tokens come as hash fragments (#access_token=...)
        // instead of PKCE codes (?code=...). PKCE requires the code_verifier cookie from
        // the original browser session, which is missing on mobile when the magic link
        // opens in a different browser context (in-app browser, different tab).
        flowType: "implicit",
      },
    },
  );
}
