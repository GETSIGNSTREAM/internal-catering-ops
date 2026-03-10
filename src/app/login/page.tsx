"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/auth-client";

type LoginMethod = "magic-link" | "password";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<LoginMethod>("password");
  const [error, setError] = useState(
    errorParam === "auth_failed" ? "Authentication failed. Please try again." : "",
  );
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handlePasswordLogin = async () => {
    const supabase = createAuthClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      router.replace("/orders");
    }
  };

  const handleMagicLinkLogin = async () => {
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email");
      return;
    }
    if (method === "password" && !password) {
      setError("Please enter your password");
      return;
    }
    setError("");
    setLoading(true);

    try {
      if (method === "password") {
        await handlePasswordLogin();
      } else {
        await handleMagicLinkLogin();
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
          We sent a sign-in link to <span className="text-white font-medium">{email}</span>
        </p>
        <p className="text-gray-500 text-xs">Click the link in your email to sign in. It may take a moment to arrive.</p>
        <button
          onClick={() => { setMagicLinkSent(false); setError(""); }}
          className="text-chicken-primary text-sm hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary text-center"
        required
        autoFocus
      />

      {method === "password" && (
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary text-center"
          required
        />
      )}

      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-chicken-primary text-dark-900 font-semibold py-3 rounded-xl hover:bg-chicken-secondary transition-colors disabled:opacity-50"
      >
        {loading
          ? (method === "password" ? "Signing in..." : "Sending link...")
          : (method === "password" ? "Sign In" : "Send Sign-In Link")
        }
      </button>

      <button
        type="button"
        onClick={() => {
          setMethod(method === "password" ? "magic-link" : "password");
          setError("");
          setPassword("");
        }}
        className="w-full text-gray-500 text-xs text-center hover:text-gray-400 transition-colors"
      >
        {method === "password"
          ? "Use magic link instead"
          : "Use password instead"
        }
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/icons/wildbird-logo.png"
            alt="WILDBIRD"
            className="w-20 h-20 mx-auto mb-4 rounded-2xl"
          />
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
