"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import "@/i18n";
import i18n from "@/i18n";

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.language && i18n.language !== user.language) {
      i18n.changeLanguage(user.language);
    }
  }, [user?.language]);

  return <>{children}</>;
}
