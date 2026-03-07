"use client";

import { useAuth } from "@/components/providers/supabase-auth-provider";
import { X, Eye } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gm: "Manager",
  driver: "Driver",
};

export default function ViewAsBanner() {
  const { user, actualRole, effectiveRole, setViewAs } = useAuth();

  // Only show when an admin is viewing as a different role
  if (!user || actualRole !== "admin" || !user.viewAsRole || effectiveRole === "admin") {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-chicken-primary/90 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-2 h-8 px-4 text-dark-900">
        <Eye size={14} strokeWidth={2.5} />
        <span className="text-xs font-semibold">
          Viewing as {ROLE_LABELS[effectiveRole || ""] || effectiveRole}
        </span>
        <button
          onClick={() => setViewAs(null)}
          className="ml-2 flex items-center gap-1 bg-dark-900/20 hover:bg-dark-900/30 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
        >
          Exit <X size={12} />
        </button>
      </div>
    </div>
  );
}
