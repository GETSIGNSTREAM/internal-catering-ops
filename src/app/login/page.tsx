"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    errorParam === "auth_failed" ? "Authentication failed. Please try again." : "",
  );
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createAuthClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        router.push("/orders");
        router.refresh();
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError("Please enter your email");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const supabase = createAuthClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center text-3xl">
          ✉️
        </div>
        <h2 className="text-xl font-semibold text-white">Check your email</h2>
        <p className="text-gray-400 text-sm">
          We sent a magic link to <span className="text-white">{email}</span>
        </p>
        <button
          onClick={() => setMagicLinkSent(false)}
          className="text-chicken-primary text-sm hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handlePasswordLogin} className="space-y-4">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary"
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary"
        required
      />

      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-chicken-primary text-dark-900 font-semibold py-3 rounded-xl hover:bg-chicken-secondary transition-colors disabled:opacity-50"
      >
        {loading ? "Please wait..." : "Sign In"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dark-600" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-dark-900 text-gray-500">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={loading}
        className="w-full bg-dark-700 text-white font-medium py-3 rounded-xl hover:bg-dark-600 transition-colors disabled:opacity-50"
      >
        Send Magic Link
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-dark-700 rounded-2xl flex items-center justify-center text-3xl">
            🐔
          </div>
          <h1 className="text-2xl font-bold text-white">WILDBIRD</h1>
          <p className="text-gray-400 text-sm">Catering Operations</p>
        </div>

        <Suspense
          fallback={
            <div className="text-center">
              <p className="text-gray-400">Loading...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
