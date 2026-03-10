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

      // Listen for auth state changes FIRST (before getSession triggers hash parsing)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
          subscription.unsubscribe();
          router.replace(redirectTo);
        }
      });

      // Check if there's a hash fragment with tokens (implicit flow)
      // The Supabase client auto-detects #access_token=... in the URL
      const hasHashToken = window.location.hash.includes("access_token");

      if (hasHashToken) {
        // Let onAuthStateChange handle it — Supabase client parses the hash automatically
        // Set a timeout in case it fails
        setTimeout(() => {
          subscription.unsubscribe();
          setStatus("Authentication failed. Redirecting to login...");
          setTimeout(() => router.replace("/login?error=auth_failed"), 1500);
        }, 8000);
        return;
      }

      // No hash fragment — check if we already have a session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        subscription.unsubscribe();
        router.replace(redirectTo);
        return;
      }

      // No session and no hash — wait briefly then redirect to login
      setTimeout(() => {
        subscription.unsubscribe();
        setStatus("Authentication failed. Redirecting to login...");
        setTimeout(() => router.replace("/login?error=auth_failed"), 1500);
      }, 5000);
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
