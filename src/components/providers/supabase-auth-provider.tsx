"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createAuthClient } from "@/lib/supabase/auth-client";
import { useRouter } from "next/navigation";

interface CaUserSession {
  id: string;
  username: string;
  name: string;
  role: string;
  storeId: number | null;
  language: string;
  viewAsRole?: string;
}

interface AuthContextType {
  user: CaUserSession | null;
  loading: boolean;
  /** The effective role (viewAsRole if set, otherwise real role) */
  effectiveRole: string | null;
  /** The real database role (always the true role) */
  actualRole: string | null;
  signOut: () => Promise<void>;
  updateLanguage: (lang: string) => Promise<void>;
  /** Switch view to a different role (admin only). Pass null to reset. */
  setViewAs: (role: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  effectiveRole: null,
  actualRole: null,
  signOut: async () => {},
  updateLanguage: async () => {},
  setViewAs: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CaUserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createAuthClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user: sbUser } } = await supabase.auth.getUser();
      if (sbUser) {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          setUser(await res.json());
        }
      }
      setLoading(false);
    }
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
      } else {
        fetch("/api/auth/me")
          .then((r) => (r.ok ? r.json() : null))
          .then(setUser);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
  };

  const updateLanguage = async (lang: string) => {
    await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: lang }),
    });
    setUser((prev) => (prev ? { ...prev, language: lang } : null));
  };

  const setViewAs = async (role: string | null) => {
    await fetch("/api/auth/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    // Reload to trigger middleware re-evaluation with new cookie
    window.location.reload();
  };

  const actualRole = user?.role || null;
  const effectiveRole = user?.viewAsRole || user?.role || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        effectiveRole,
        actualRole,
        signOut: handleSignOut,
        updateLanguage,
        setViewAs,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
