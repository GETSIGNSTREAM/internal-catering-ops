"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { BarChart3, DollarSign, Package, ArrowLeft } from "lucide-react";

interface SalesReport {
  period: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
}

interface ReportsData {
  daily: SalesReport[];
  weekly: SalesReport[];
  monthly: SalesReport[];
}

type ViewType = "daily" | "weekly" | "monthly";

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ReportsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const { t } = useTranslation();

  const [reports, setReports] = useState<ReportsData | null>(null);
  const [viewType, setViewType] = useState<ViewType>("daily");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/reports/sales");
        if (!res.ok) throw new Error("Failed to fetch reports");
        const data = await res.json();
        setReports(data);
      } catch (err) {
        console.error("Error fetching reports:", err);
        setError(t("reports.unableToLoad"));
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [t]);

  const currentData: SalesReport[] = reports ? reports[viewType] : [];

  const totalRevenue = currentData.reduce((sum, r) => sum + r.revenue, 0);
  const totalOrders = currentData.reduce((sum, r) => sum + r.orderCount, 0);
  const maxRevenue = Math.max(...currentData.map((r) => r.revenue), 1);

  const viewLabels: { key: ViewType; label: string; subtitle: string }[] = [
    { key: "daily", label: t("reports.daily"), subtitle: t("reports.last7Days") },
    { key: "weekly", label: t("reports.weekly"), subtitle: t("reports.last4Weeks") },
    { key: "monthly", label: t("reports.monthly"), subtitle: t("reports.last3Months") },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 size={48} className="text-chicken-primary mx-auto mb-4 animate-pulse" />
          <p className="text-gray-400">{t("reports.loadingReports")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center px-4">
        <div className="text-center">
          <BarChart3 size={48} className="text-red-400 mx-auto mb-4" />
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
            <BarChart3 size={24} className="text-chicken-primary" />
            <h1 className="text-xl font-bold text-white">{t("reports.title")}</h1>
          </div>
          <span className="text-sm text-gray-400">{user?.name}</span>
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {/* View Toggle */}
        <div className="flex gap-2">
          {viewLabels.map((v) => (
            <button
              key={v.key}
              onClick={() => setViewType(v.key)}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-all ${
                viewType === v.key
                  ? "bg-chicken-primary text-dark-900"
                  : "bg-dark-700 text-gray-300 hover:bg-dark-600"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Subtitle */}
        <p className="text-center text-sm text-gray-500">
          {viewLabels.find((v) => v.key === viewType)?.subtitle}
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <DollarSign size={18} className="text-green-400" />
              </div>
              <span className="text-sm text-gray-400">{t("reports.totalRevenue")}</span>
            </div>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Package size={18} className="text-blue-400" />
              </div>
              <span className="text-sm text-gray-400">{t("reports.totalOrders")}</span>
            </div>
            <p className="text-2xl font-bold text-white">{totalOrders}</p>
          </div>
        </div>

        {/* Period Data Table */}
        {currentData.length === 0 ? (
          <div className="bg-dark-700 rounded-xl p-8 text-center">
            <p className="text-gray-400">{t("reports.noData")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentData.map((report, index) => (
              <div
                key={index}
                className="bg-dark-700 rounded-xl p-4 border border-dark-600"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-white font-medium">{report.period}</span>
                  <span className="text-chicken-primary font-bold">
                    {formatCurrency(report.revenue)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm text-gray-400 mb-3">
                  <span>
                    {report.orderCount} {t("reports.ordersCount")}
                  </span>
                  <span>
                    {t("reports.avg")}: {formatCurrency(report.avgOrderValue)}
                  </span>
                </div>
                {/* Revenue Bar */}
                <div className="w-full bg-dark-600 rounded-full h-2">
                  <div
                    className="bg-chicken-primary rounded-full h-2 transition-all duration-500"
                    style={{ width: `${(report.revenue / maxRevenue) * 100}%` }}
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
