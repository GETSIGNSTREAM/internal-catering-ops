"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import "@/i18n";
import i18n from "@/i18n";

export default function I18nProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.language && i18n.language !== session.user.language) {
      i18n.changeLanguage(session.user.language);
    }
  }, [session?.user?.language]);

  return <>{children}</>;
}
