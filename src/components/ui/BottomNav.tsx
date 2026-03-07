"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { ClipboardList, Calendar, LayoutDashboard, StickyNote, Truck } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();

  const notesUrl = "https://www.icloud.com/notes/0e4btpmmAnAk2Eoii2LRIYKdg#CATERING_ORDERS:";

  // Driver nav — simplified
  if (user?.role === "driver") {
    const driverItems = [
      { path: "/driver", label: "Deliveries", icon: Truck },
      { path: "/orders", label: t("orders.title"), icon: ClipboardList },
    ];

    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 safe-bottom z-40">
        <div className="flex justify-around items-center h-16">
          {driverItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                  isActive ? "text-chicken-primary" : "text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon size={24} className="mb-1" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  // Admin/GM nav — full set
  const navItems = [
    { path: "/orders", label: t("orders.title"), icon: ClipboardList },
    { path: "/calendar", label: t("calendar.title"), icon: Calendar },
    { path: "/dashboard", label: t("dashboard.title"), icon: LayoutDashboard },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-dark-800 border-t border-dark-600 safe-bottom z-40">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.path) || (item.path === "/orders" && pathname === "/");
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? "text-chicken-primary" : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Icon size={24} className="mb-1" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
        <a
          href={notesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center w-full h-full transition-colors text-gray-400 hover:text-gray-200"
        >
          <StickyNote size={24} className="mb-1" />
          <span className="text-xs font-medium">{t("orders.notes")}</span>
        </a>
      </div>
    </nav>
  );
}
