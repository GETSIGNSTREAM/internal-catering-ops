"use client";

import { useTranslation } from "react-i18next";

interface StatusPillProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  prep: "bg-yellow-500",
  cooking: "bg-orange-500",
  packaging: "bg-purple-500",
  ready: "bg-green-500",
  delivered: "bg-gray-500",
  cancelled: "bg-red-500",
  pending: "bg-gray-600",
};

export default function StatusPill({ status, size = "md" }: StatusPillProps) {
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    new: t("orders.status.new"),
    prep: t("orders.status.prep"),
    cooking: t("orders.prepStatus.cooking"),
    packaging: t("orders.status.packaging"),
    ready: t("orders.status.ready"),
    delivered: t("orders.status.delivered"),
    cancelled: t("orders.status.cancelled"),
    pending: t("orders.status.pending"),
  };

  const color = statusColors[status] || "bg-gray-500";
  const label = statusLabels[status] || status;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <span className={`${color} ${sizeClasses[size]} rounded-full font-medium text-white inline-block`}>
      {label}
    </span>
  );
}
