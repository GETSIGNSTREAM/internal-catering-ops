"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import {
  Shield, Users, Truck, Store, Check, ChevronRight,
  ArrowLeft, ChevronDown,
} from "lucide-react";

interface StoreOption {
  id: number;
  name: string;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", icon: Shield },
  { value: "gm", label: "Manager", icon: Users },
  { value: "driver", label: "Driver", icon: Truck },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gm: "GM",
  driver: "Driver",
};

export default function RoleSwitcher() {
  const { actualRole, effectiveRole, setViewAs } = useAuth();
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const isAdmin = actualRole === "admin";

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

  if (!isAdmin) return null;

  const currentViewRole = effectiveRole || "admin";

  const handleRoleSelect = async (role: string) => {
    if (role === currentViewRole) {
      setShowRolePicker(false);
      return;
    }

    if (role === "gm") {
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

  return (
    <div className="relative" ref={pickerRef}>
      <button
        onClick={() => {
          setShowRolePicker(!showRolePicker);
          setShowStorePicker(false);
        }}
        className="flex items-center gap-1 bg-dark-600 hover:bg-dark-500 text-xs font-semibold text-chicken-primary px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <Shield size={12} />
        <span>{ROLE_LABELS[currentViewRole] || currentViewRole}</span>
        <ChevronDown size={12} className={`transition-transform ${showRolePicker || showStorePicker ? "rotate-180" : ""}`} />
      </button>

      {(showRolePicker || showStorePicker) && (
        <div className="absolute top-full mt-1 right-0 bg-dark-700 border border-dark-500 rounded-xl shadow-xl p-1 min-w-[180px] z-50">
          {showStorePicker ? (
            <>
              <button
                onClick={() => setShowStorePicker(false)}
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
      )}
    </div>
  );
}
