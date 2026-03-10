"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { Suspense } from "react";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Signing you in...");

  useEffect(() => {
    const handleAuth = async () => {
      const redirectTo = searchParams.get("redirect") || "/orders";
      const supabase = createAuthClient();

      // Parse hash fragment for implicit flow tokens (#access_token=...&refresh_token=...)
      const hash = window.location.hash.substring(1); // strip leading #
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        // Explicitly set the session from hash fragment tokens
        // (@supabase/ssr's createBrowserClient doesn't auto-parse hash fragments)
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          // Clean the hash from the URL before navigating
          window.history.replaceState(null, "", window.location.pathname);
          router.replace(redirectTo);
          return;
        }
        console.error("[Auth callback] setSession failed:", error.message);
        setStatus("Authentication failed. Redirecting to login...");
        setTimeout(() => router.replace("/login?error=auth_failed"), 1500);
        return;
      }

      // No hash tokens — check if we already have a session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace(redirectTo);
        return;
      }

      // No session and no hash — redirect to login
      setStatus("Authentication failed. Redirecting to login...");
      setTimeout(() => router.replace("/login?error=auth_failed"), 2000);
    };

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 mx-auto border-4 border-chicken-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-chicken-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
