"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import {
  ClipboardList, Calendar, LayoutDashboard, StickyNote, Truck,
  Shield, Users, Check, Store, ChevronRight, ArrowLeft,
} from "lucide-react";

/** WILDBIRD bird-feet logo (actual brand asset) */
function WildbirdLogo({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/icons/wildbird-logo.png"
      alt="WILDBIRD"
      width={size}
      height={size}
      className="rounded"
    />
  );
}

interface StoreOption {
  id: number;
  name: string;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", icon: Shield },
  { value: "gm", label: "Manager", icon: Users },
  { value: "driver", label: "Driver", icon: Truck },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { effectiveRole, actualRole, setViewAs } = useAuth();
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const notesUrl = "https://www.icloud.com/notes/0e4btpmmAnAk2Eoii2LRIYKdg#CATERING_ORDERS:";

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowRolePicker(false);
        setShowStorePicker(false);
      }
    }
    if (showRolePicker || showStorePicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showRolePicker, showStorePicker]);

  const isAdmin = actualRole === "admin";
  const currentViewRole = effectiveRole || "admin";

  const handleRoleSelect = async (role: string) => {
    if (role === currentViewRole) {
      setShowRolePicker(false);
      return;
    }

    if (role === "gm") {
      // Show store picker for GM view
      setLoadingStores(true);
      setShowStorePicker(true);
      try {
        const res = await fetch("/api/stores");
        const stores = await res.json();
        setStoreOptions(stores);
      } catch {
        setStoreOptions([]);
      } finally {
        setLoadingStores(false);
      }
      return;
    }

    setShowRolePicker(false);
    setShowStorePicker(false);
    await setViewAs(role === "admin" ? null : role);
  };

  const handleStoreSelect = async (storeId: number) => {
    setShowRolePicker(false);
    setShowStorePicker(false);
    await setViewAs("gm", storeId);
  };

  const handleBackToRoles = () => {
    setShowStorePicker(false);
  };

  // Render the role/store picker popup
  const renderPicker = () => {
    if (!showRolePicker && !showStorePicker) return null;

    return (
      <div className="absolute bottom-full mb-2 right-0 bg-dark-700 border border-dark-500 rounded-xl shadow-xl p-1 min-w-[180px] z-50">
        {showStorePicker ? (
          <>
            <button
              onClick={handleBackToRoles}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-dark-600 transition-colors mb-1"
            >
              <ArrowLeft size={14} />
              <span className="text-xs font-medium">Back</span>
            </button>
            <p className="px-3 py-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Select Store</p>
            {loadingStores ? (
              <p className="px-3 py-2.5 text-sm text-gray-400">Loading...</p>
            ) : storeOptions.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-gray-400">No stores found</p>
            ) : (
              storeOptions.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleStoreSelect(store.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-gray-300 hover:bg-dark-600"
                >
                  <Store size={16} />
                  <span className="flex-1 text-left text-sm font-medium">{store.name}</span>
                </button>
              ))
            )}
          </>
        ) : (
          ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = currentViewRole === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => handleRoleSelect(opt.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isSelected
                    ? "bg-chicken-primary/20 text-chicken-primary"
                    : "text-gray-300 hover:bg-dark-600"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left text-sm font-medium">{opt.label}</span>
                {opt.value === "gm" && !isSelected && (
                  <ChevronRight size={14} className="text-gray-500" />
                )}
                {isSelected && <Check size={16} />}
              </button>
            );
          })
        )}
      </div>
    );
  };

  // Driver nav — simplified
  if (effectiveRole === "driver") {
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

          {/* WILDBIRD logo — role switcher (admin only) */}
          {isAdmin && (
            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => {
                  setShowRolePicker(!showRolePicker);
                  setShowStorePicker(false);
                }}
                className="flex flex-col items-center justify-center w-full h-full transition-colors text-chicken-primary hover:text-chicken-light"
              >
                <WildbirdLogo size={26} />
                <span className="text-[10px] font-medium mt-0.5">Switch</span>
              </button>
              {renderPicker()}
            </div>
          )}
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

        {/* WILDBIRD logo — role switcher (admin only) */}
        {isAdmin ? (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => {
                setShowRolePicker(!showRolePicker);
                setShowStorePicker(false);
              }}
              className="flex flex-col items-center justify-center w-full h-full transition-colors text-chicken-primary hover:text-chicken-light"
            >
              <WildbirdLogo size={26} />
              <span className="text-[10px] font-medium mt-0.5">Switch</span>
            </button>
            {renderPicker()}
          </div>
        ) : (
          <a
            href={notesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center w-full h-full transition-colors text-gray-400 hover:text-gray-200"
          >
            <StickyNote size={24} className="mb-1" />
            <span className="text-xs font-medium">{t("orders.notes")}</span>
          </a>
        )}
      </div>
    </nav>
  );
}
