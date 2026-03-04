"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Trophy, ArrowLeft, DollarSign, Package, Clock } from "lucide-react";

interface StorePerformance {
  storeId: number;
  storeName: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  completedCount: number;
  onTimePercent: number;
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function StorePerformancePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;

  const [stores, setStores] = useState<StorePerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/reports/store-performance");
        if (!res.ok) throw new Error("Failed to fetch store performance");
        const data = await res.json();
        // Sort by revenue descending
        const sorted = (data as StorePerformance[]).sort((a, b) => b.revenue - a.revenue);
        setStores(sorted);
      } catch (err) {
        console.error("Error fetching store performance:", err);
        setError("Unable to load store performance data");
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, []);

  const totalRevenue = stores.reduce((sum, s) => sum + s.revenue, 0);
  const totalOrders = stores.reduce((sum, s) => sum + s.orderCount, 0);
  const avgOnTime =
    stores.length > 0
      ? Math.round(stores.reduce((sum, s) => sum + s.onTimePercent, 0) / stores.length)
      : 0;
  const maxRevenue = Math.max(...stores.map((s) => s.revenue), 1);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <Trophy size={48} className="text-chicken-primary mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">Loading store performance...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
        <div className="text-center">
          <Trophy size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-red-400 text-lg font-medium mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-dark-700 text-white rounded-xl hover:bg-dark-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 pb-24">
      {/* Header */}
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="text-white p-1">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Trophy size={24} className="text-chicken-primary" />
            <h1 className="text-xl font-bold text-white">Store Performance</h1>
          </div>
          <span className="text-sm text-gray-400">{user?.name}</span>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600 text-center">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-2">
              <DollarSign size={18} className="text-green-400" />
            </div>
            <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
              <Package size={18} className="text-blue-400" />
            </div>
            <p className="text-xs text-gray-400 mb-1">Total Orders</p>
            <p className="text-lg font-bold text-white">{totalOrders}</p>
          </div>
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600 text-center">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
              <Clock size={18} className="text-purple-400" />
            </div>
            <p className="text-xs text-gray-400 mb-1">Avg On-Time</p>
            <p className="text-lg font-bold text-white">{avgOnTime}%</p>
          </div>
        </div>

        {/* Section Title */}
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-white">Last 30 Days Performance</h2>
        </div>

        {/* Store Rows */}
        {stores.length === 0 ? (
          <div className="bg-dark-700 rounded-xl p-8 text-center">
            <p className="text-gray-400">No store performance data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {stores.map((store, index) => (
              <div
                key={store.storeId}
                className="bg-dark-700 rounded-xl p-4 border border-dark-600"
              >
                {/* Rank & Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0
                        ? "bg-chicken-primary text-dark-900"
                        : index === 1
                        ? "bg-gray-300 text-dark-900"
                        : index === 2
                        ? "bg-amber-700 text-white"
                        : "bg-dark-600 text-gray-400"
                    }`}
                  >
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">{store.storeName}</h3>
                  </div>
                  <span className="text-chicken-primary font-bold text-lg">
                    {formatCurrency(store.revenue)}
                  </span>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Orders</p>
                    <p className="text-sm font-semibold text-white">{store.orderCount}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Avg Order</p>
                    <p className="text-sm font-semibold text-white">
                      {formatCurrency(store.avgOrderValue)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">On-Time</p>
                    <p
                      className={`text-sm font-semibold ${
                        store.onTimePercent >= 90
                          ? "text-green-400"
                          : store.onTimePercent >= 70
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {store.onTimePercent}%
                    </p>
                  </div>
                </div>

                {/* Revenue Bar */}
                <div className="w-full bg-dark-600 rounded-full h-2">
                  <div
                    className="bg-chicken-primary rounded-full h-2 transition-all duration-500"
                    style={{ width: `${(store.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
