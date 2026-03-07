"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Plus, Calendar, ListFilter, MapPin, ChevronDown } from "lucide-react";
import OrderCard from "@/components/orders/OrderCard";
import CreateOrderModal from "@/components/orders/CreateOrderModal";
import FilterSelect from "@/components/ui/FilterSelect";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTransition } from "@/components/ui/PageTransition";

interface Order {
  id: number;
  orderNumber?: string;
  customerName: string;
  organization?: string;
  items: { name: string; quantity: number }[];
  pickupTime?: string;
  deliveryTime?: string;
  status: string;
  prepStatus?: string;
  deliveryMode?: string;
  orderSource?: string;
  totalAmount?: number;
  createdAt?: string;
  store?: { id: number; name: string };
}

interface Store {
  id: number;
  name: string;
}

function getLAMidnightUTC(year: number, month: number, day: number) {
  // Calculate the actual UTC offset for LA on a specific date (handles DST)
  const targetDate = new Date(year, month - 1, day, 12, 0, 0);
  const laStr = targetDate.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const utcStr = targetDate.toLocaleString("en-US", { timeZone: "UTC" });
  const offsetHours = Math.round((new Date(utcStr).getTime() - new Date(laStr).getTime()) / 3600000);
  return new Date(Date.UTC(year, month - 1, day, offsetHours, 0, 0));
}

function getLADateRange(dayOffset: number, days: number = 1) {
  const now = new Date();
  const laDateStr = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const [year, month, day] = laDateStr.split("-").map(Number);
  // Each boundary is calculated independently so DST transitions are handled correctly
  const from = getLAMidnightUTC(year, month, day + dayOffset);
  const to = getLAMidnightUTC(year, month, day + dayOffset + days);
  return { from, to };
}

const PAGE_SIZE = 50;

export default function OrdersPage() {
  const { user, effectiveRole, signOut } = useAuth();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [stores, setStores] = useState<Store[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [serverStats, setServerStats] = useState<{ totalSales: number; nativeSales: number } | null>(null);

  const isAdmin = effectiveRole === "admin";

  // Load stores for the location filter (admin only)
  useEffect(() => {
    if (isAdmin) {
      fetch("/api/stores").then((res) => res.json()).then((data) => setStores(data)).catch(() => {});
    }
  }, [isAdmin]);

  // Reset location filter when switching away from admin view
  useEffect(() => {
    if (!isAdmin) {
      setLocationFilter("all");
    }
  }, [isAdmin]);

  const buildParams = useCallback(
    (offset: number = 0) => {
      const params = new URLSearchParams();
      params.append("limit", String(PAGE_SIZE));
      params.append("offset", String(offset));
      if (effectiveRole === "driver") {
        params.append("deliveryMode", "delivery");
      } else {
        if (dateFilter === "today") {
          const { from, to } = getLADateRange(0);
          params.append("fulfillmentDateFrom", from.toISOString());
          params.append("fulfillmentDateTo", to.toISOString());
        } else if (dateFilter === "tomorrow") {
          const { from, to } = getLADateRange(1);
          params.append("fulfillmentDateFrom", from.toISOString());
          params.append("fulfillmentDateTo", to.toISOString());
        } else if (dateFilter === "week") {
          const { from, to } = getLADateRange(0, 7);
          params.append("fulfillmentDateFrom", from.toISOString());
          params.append("fulfillmentDateTo", to.toISOString());
        }
        if (statusFilter !== "all") params.append("status", statusFilter);
      }
      if (isAdmin && locationFilter !== "all") params.append("storeId", locationFilter);
      return params;
    },
    [effectiveRole, dateFilter, statusFilter, isAdmin, locationFilter]
  );

  // Sync from Neon (Replit) in the background — runs once per page load
  const syncFromNeon = async () => {
    try {
      await fetch("/api/sync/neon");
    } catch {
      // Silent fail — sync is best-effort
    }
  };

  const fetchOrders = async (shouldSync = false) => {
    try {
      setLoading(true);
      if (shouldSync) await syncFromNeon();
      const params = buildParams(0);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
        setTotalOrders(data.length);
        setServerStats(null);
      } else {
        setOrders(data.orders || []);
        setTotalOrders(data.total || 0);
        setServerStats(data.stats || null);
      }
    } catch {
      console.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const params = buildParams(orders.length);
      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      const newOrders = Array.isArray(data) ? data : data.orders || [];
      setOrders((prev) => [...prev, ...newOrders]);
    } catch {
      console.error("Failed to load more orders");
    } finally {
      setLoadingMore(false);
    }
  };

  // Use server-side aggregates for accurate stats across ALL matching orders
  const totalSales = serverStats?.totalSales ?? orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const nativeSales = serverStats?.nativeSales ?? orders.filter((o) => o.orderSource === "eatwildbird.com").reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const stats = {
    count: totalOrders,
    totalSales,
    nativeSales,
    avgTicket: totalOrders > 0 ? totalSales / totalOrders : 0,
  };

  // Sync from Neon on initial load, then just fetch on filter changes
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!hasSynced) {
      setHasSynced(true);
      fetchOrders(true); // sync + fetch on first load
    } else {
      fetchOrders(false); // just fetch on filter changes
    }
  }, [dateFilter, statusFilter, locationFilter, effectiveRole]);

  const dateFilters = [
    { value: "today", label: t("orders.today") },
    { value: "tomorrow", label: t("orders.tomorrow") },
    { value: "week", label: "This Week" },
    { value: "all", label: t("orders.allDates") },
  ];

  const statusFilters = [
    { value: "all", label: t("orders.allStatuses") },
    { value: "new", label: t("orders.status.new") },
    { value: "prep", label: t("orders.status.prep") },
    { value: "ready", label: t("orders.status.ready") },
    { value: "delivered", label: t("orders.status.delivered") },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{t("orders.cateringOrders")}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button onClick={() => signOut()} className="text-gray-400 hover:text-white text-sm">{t("common.logout")}</button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <FilterSelect value={dateFilter} options={dateFilters} onChange={setDateFilter} icon={<Calendar size={14} className="text-gray-400" />} />
          <FilterSelect value={statusFilter} options={statusFilters} onChange={setStatusFilter} icon={<ListFilter size={14} className="text-gray-400" />} />
          {isAdmin && stores.length > 0 && (
            <FilterSelect
              value={locationFilter}
              options={[{ value: "all", label: t("orders.allLocations") }, ...stores.map((s) => ({ value: String(s.id), label: s.name }))]}
              onChange={setLocationFilter}
              icon={<MapPin size={14} className="text-gray-400" />}
            />
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-1">
          <div className="bg-dark-700/50 p-2 rounded-lg border border-dark-600">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t("orders.title")}</p>
            <p className="text-sm font-bold text-white">{stats.count}</p>
          </div>
          <div className="bg-dark-700/50 p-2 rounded-lg border border-dark-600">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t("orders.total")}</p>
            <p className="text-sm font-bold text-chicken-primary">${(stats.totalSales / 100).toLocaleString()}</p>
          </div>
          <div className="bg-dark-700/50 p-2 rounded-lg border border-dark-600">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t("orders.native")}</p>
            <p className="text-sm font-bold text-blue-400">${(stats.nativeSales / 100).toLocaleString()}</p>
          </div>
          <div className="bg-dark-700/50 p-2 rounded-lg border border-dark-600">
            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{t("orders.avg")}</p>
            <p className="text-sm font-bold text-white">${(stats.avgTicket / 100).toLocaleString()}</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        <PageTransition>
          {loading ? (
            <OrderListSkeleton count={4} />
          ) : orders.length === 0 ? (
            <EmptyState
              type="orders"
              title={dateFilter === "today" && statusFilter === "all" ? t("orders.noOrdersToday") : t("orders.noOrders")}
              message={dateFilter === "today" && statusFilter === "all" ? t("orders.noOrdersTodayMessage") : t("orders.noOrdersFilterMessage")}
              action={{ label: t("orders.createOrder"), onClick: () => setShowCreateModal(true) }}
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order, index) => (
                <OrderCard key={order.id} order={order} index={index} />
              ))}
              {orders.length < totalOrders && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-3 mt-2 rounded-xl bg-dark-700 text-gray-300 hover:bg-dark-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  {loadingMore ? <span>Loading...</span> : <><ChevronDown size={16} /><span>Load More ({totalOrders - orders.length} remaining)</span></>}
                </button>
              )}
              {orders.length > 0 && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  Showing {orders.length} of {totalOrders} {t("orders.orders_count")}
                </p>
              )}
            </div>
          )}
        </PageTransition>
      </main>

      <motion.button
        onClick={() => setShowCreateModal(true)}
        className="fixed right-4 bottom-24 w-14 h-14 bg-chicken-primary rounded-full flex items-center justify-center shadow-glow z-30"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <Plus size={28} className="text-dark-900" strokeWidth={2.5} />
      </motion.button>

      <AnimatePresence>
        {showCreateModal && (
          <CreateOrderModal
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); fetchOrders(); }}
            isAdmin={effectiveRole === "admin"}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
