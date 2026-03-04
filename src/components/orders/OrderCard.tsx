"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { MapPin, Truck, Store, ClipboardList } from "lucide-react";
import { formatTimePST, formatDatePST } from "@/utils/timezone";

interface OrderItem {
  name: string;
  quantity: number;
}

interface Order {
  id: number;
  orderNumber?: string;
  customerName: string;
  organization?: string;
  items: OrderItem[];
  pickupTime?: string;
  deliveryTime?: string;
  status: string;
  prepStatus?: string;
  deliveryMode?: string;
  orderSource?: string;
  totalAmount?: number;
  createdAt?: string;
  store?: { id: number; name: string };
  assignedDriver?: string;
}

interface OrderCardProps {
  order: Order;
  index?: number;
}

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  confirmed: "bg-indigo-500",
  prep: "bg-yellow-500",
  ready: "bg-green-500",
  delivered: "bg-gray-500",
  cancelled: "bg-red-500",
};

const prepStatusColors: Record<string, string> = {
  new: "text-blue-400",
  confirmed: "text-indigo-400",
  cooking: "text-orange-400",
  ready: "text-green-400",
};

export default function OrderCard({ order, index = 0 }: OrderCardProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const statusLabels: Record<string, string> = {
    new: t("orders.status.new"),
    confirmed: t("orders.status.confirmed"),
    prep: t("orders.status.prep"),
    ready: t("orders.status.ready"),
    delivered: t("orders.status.delivered"),
    cancelled: t("orders.status.cancelled"),
  };

  const prepStatusLabels: Record<string, string> = {
    new: t("orders.prepStatus.new"),
    confirmed: t("orders.prepStatus.confirmed"),
    cooking: t("orders.prepStatus.cooking"),
    ready: t("orders.prepStatus.ready"),
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return null;
    return formatTimePST(dateStr);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const pstNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const pstDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    const today = new Date(pstNow.getFullYear(), pstNow.getMonth(), pstNow.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const orderDay = new Date(pstDate.getFullYear(), pstDate.getMonth(), pstDate.getDate());

    if (orderDay.getTime() === today.getTime()) {
      return t("orders.today");
    } else if (orderDay.getTime() === tomorrow.getTime()) {
      return t("orders.tomorrow");
    }
    return formatDatePST(dateStr);
  };

  const displayTime =
    order.deliveryMode === "delivery" ? formatTime(order.deliveryTime) : formatTime(order.pickupTime);

  const displayDate = formatDate(order.deliveryMode === "delivery" ? order.deliveryTime : order.pickupTime);

  const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const itemsPending = !order.items || order.items.length === 0;

  return (
    <motion.div
      onClick={() => router.push(`/orders/${order.id}`)}
      className="card-premium p-4 active:bg-dark-600 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-base font-semibold text-white truncate">{order.customerName}</h3>
            {order.orderNumber && (
              <span className="px-1.5 py-0.5 rounded bg-dark-500 text-xs text-gray-400 shrink-0">
                #{order.orderNumber}
              </span>
            )}
            {order.store?.name && (
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-xs text-teal-300 font-medium shrink-0 flex items-center gap-1">
                <MapPin size={10} /> {order.store.name}
              </span>
            )}
            {order.orderSource && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-xs text-purple-300 shrink-0">
                {order.orderSource}
              </span>
            )}
            {order.assignedDriver && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-xs text-orange-300 font-medium shrink-0 flex items-center gap-1">
                <Truck size={10} /> {order.assignedDriver}
              </span>
            )}
            {itemsPending && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-xs text-amber-400 font-medium shrink-0 flex items-center gap-1">
                <ClipboardList size={10} /> {t("orders.menuTbd")}
              </span>
            )}
          </div>
          {order.organization && <p className="text-sm text-gray-400 truncate">{order.organization}</p>}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <motion.span
            className={`px-2.5 py-1 rounded-full text-xs font-medium text-white ${statusColors[order.status] || "bg-gray-500"}`}
            animate={order.status === "new" ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {statusLabels[order.status] || order.status}
          </motion.span>
          {order.prepStatus && (
            <span className={`text-xs ${prepStatusColors[order.prepStatus] || "text-gray-400"}`}>
              {prepStatusLabels[order.prepStatus] || order.prepStatus}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">
              {order.deliveryMode === "delivery" ? <Truck size={18} /> : <Store size={18} />}
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">
                {order.deliveryMode === "delivery" ? t("orders.delivery") : t("orders.pickup")}
              </span>
              {displayTime && <span className="text-sm text-chicken-primary font-semibold">{displayTime}</span>}
            </div>
          </div>

          {displayDate && (
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">{t("orders.date")}</span>
              <span className="text-sm text-white">{displayDate}</span>
            </div>
          )}

          <div className="flex flex-col">
            <span className="text-xs text-gray-400">{t("orders.items")}</span>
            <span className={`text-sm ${itemsPending ? "text-amber-400" : "text-white"}`}>
              {itemsPending ? t("orders.menuTbd") : totalItems}
            </span>
          </div>
        </div>

        {order.totalAmount ? (
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-400">{t("orders.total")}</span>
            <span className="text-sm text-green-400 font-semibold">${(order.totalAmount / 100).toFixed(2)}</span>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
