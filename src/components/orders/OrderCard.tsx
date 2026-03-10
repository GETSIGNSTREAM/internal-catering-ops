"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  MapPin, Truck, Store, ClipboardList, Phone, Clock,
  Users, StickyNote, FileText, Tag,
} from "lucide-react";
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
  readyTime?: string;
  status: string;
  prepStatus?: string;
  deliveryMode?: string;
  orderSource?: string;
  totalAmount?: number;
  createdAt?: string;
  storeName?: string;
  assignedDriver?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  numberOfGuests?: number;
  notes?: string;
  trackingMilestone?: string;
  pdfUrl?: string;
  labelsUrl?: string;
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

// Progress milestones for mini progress dots
const KITCHEN_MILESTONES = ["confirmed", "preparing", "packed"];
const DELIVERY_MILESTONES = ["en_route", "arriving", "delivered"];

const MILESTONE_ORDER = [...KITCHEN_MILESTONES, ...DELIVERY_MILESTONES];

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

  const isDelivery = order.deliveryMode === "delivery";
  const displayTime = isDelivery ? formatTime(order.deliveryTime) : formatTime(order.pickupTime);
  const displayDate = formatDate(isDelivery ? order.deliveryTime : order.pickupTime);
  const readyTime = isDelivery ? formatTime(order.readyTime) : null;
  const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const itemsPending = !order.items || order.items.length === 0;

  // Determine progress for mini dots
  const milestones = isDelivery
    ? MILESTONE_ORDER
    : KITCHEN_MILESTONES;
  const currentMilestoneIdx = order.trackingMilestone
    ? milestones.indexOf(order.trackingMilestone)
    : -1;
  const showProgress = isDelivery && order.trackingMilestone && currentMilestoneIdx >= 0;

  return (
    <motion.div
      onClick={() => router.push(`/orders/${order.id}`)}
      className="card-premium p-4 active:bg-dark-600 cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* ── Section 1: Header — Identity + Price + Status ── */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: Customer name */}
          <h3 className="text-base font-semibold text-white truncate">{order.customerName}</h3>
          {/* Row 2: Organization + order number */}
          {(order.organization || order.orderNumber) && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {order.organization && (
                <span className="text-sm text-gray-400 truncate">{order.organization}</span>
              )}
              {order.organization && order.orderNumber && (
                <span className="text-gray-600">•</span>
              )}
              {order.orderNumber && (
                <span className="text-xs text-gray-500">#{order.orderNumber}</span>
              )}
            </div>
          )}
        </div>

        {/* Price + status column */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {order.totalAmount ? (
            <span className="text-base font-bold text-green-400">
              ${(order.totalAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          ) : null}
          <motion.span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${statusColors[order.status] || "bg-gray-500"}`}
            animate={order.status === "new" ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {statusLabels[order.status] || order.status}
          </motion.span>
          {order.prepStatus && (
            <span className={`text-[10px] ${prepStatusColors[order.prepStatus] || "text-gray-400"}`}>
              {prepStatusLabels[order.prepStatus] || order.prepStatus}
            </span>
          )}
        </div>
      </div>

      {/* Row 3: Tag badges */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {order.orderSource && (
          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-[11px] text-purple-300 font-medium">
            {order.orderSource}
          </span>
        )}
        {order.storeName && (
          <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-[11px] text-teal-300 font-medium flex items-center gap-1">
            <MapPin size={9} /> {order.storeName}
          </span>
        )}
        {order.assignedDriver && (
          <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-[11px] text-orange-300 font-medium flex items-center gap-1">
            <Truck size={9} /> {order.assignedDriver}
          </span>
        )}
        {itemsPending && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[11px] text-amber-400 font-medium flex items-center gap-1">
            <ClipboardList size={9} /> {t("orders.menuTbd")}
          </span>
        )}
        {order.pdfUrl && (
          <span className="px-1.5 py-0.5 rounded bg-dark-500 text-[11px] text-gray-400 flex items-center gap-1">
            <FileText size={9} /> PDF
          </span>
        )}
        {order.labelsUrl && (
          <span className="px-1.5 py-0.5 rounded bg-dark-500 text-[11px] text-gray-400 flex items-center gap-1">
            <Tag size={9} /> Labels
          </span>
        )}
      </div>

      {/* ── Section 2: Fulfillment Details Grid ── */}
      <div className="mt-3 pt-3 border-t border-dark-600">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {/* Left col: Fulfillment time + date */}
          <div className="flex items-start gap-2">
            <span className="text-gray-500 mt-0.5">
              {isDelivery ? <Truck size={14} /> : <Store size={14} />}
            </span>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-medium">
                {isDelivery ? t("orders.delivery") : t("orders.pickup")}
                {!isDelivery && order.storeName && (
                  <span className="text-teal-400 ml-1">@ {order.storeName}</span>
                )}
              </span>
              <div className="flex items-baseline gap-1.5">
                {displayTime && <span className="text-sm text-chicken-primary font-semibold">{displayTime}</span>}
                {displayDate && <span className="text-xs text-gray-400">{displayDate}</span>}
              </div>
            </div>
          </div>

          {/* Right col: Delivery address */}
          {isDelivery && order.deliveryAddress ? (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 mt-0.5"><MapPin size={14} /></span>
              <div className="min-w-0">
                <span className="text-[10px] text-gray-500 uppercase font-medium">{t("orders.address")}</span>
                <p className="text-xs text-gray-300 truncate">{order.deliveryAddress}</p>
              </div>
            </div>
          ) : (
            /* Empty cell if no address — keep grid aligned */
            <div />
          )}

          {/* Left col: Ready time (delivery only) */}
          {isDelivery && readyTime ? (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 mt-0.5"><Clock size={14} /></span>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">{t("orders.readyTime")}</span>
                <p className="text-sm text-yellow-400 font-medium">{readyTime}</p>
              </div>
            </div>
          ) : isDelivery ? (
            <div />
          ) : null}

          {/* Right col: Phone */}
          {isDelivery && order.customerPhone ? (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 mt-0.5"><Phone size={14} /></span>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">{t("orders.phone")}</span>
                <a
                  href={`tel:${order.customerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block text-xs text-chicken-primary hover:underline"
                >
                  {order.customerPhone}
                </a>
              </div>
            </div>
          ) : isDelivery ? (
            <div />
          ) : null}

          {/* Left col: Items + Guests */}
          <div className="flex items-start gap-2">
            <span className="text-gray-500 mt-0.5"><Users size={14} /></span>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-medium">{t("orders.items")}</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-sm font-medium ${itemsPending ? "text-amber-400" : "text-white"}`}>
                  {itemsPending ? t("orders.menuTbd") : `${totalItems} items`}
                </span>
                {order.numberOfGuests && order.numberOfGuests > 0 && (
                  <span className="text-xs text-gray-400">• {order.numberOfGuests} guests</span>
                )}
              </div>
            </div>
          </div>

          {/* Right col: Phone (for pickup orders — show if no address row) */}
          {!isDelivery && order.customerPhone ? (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 mt-0.5"><Phone size={14} /></span>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">{t("orders.phone")}</span>
                <a
                  href={`tel:${order.customerPhone}`}
                  onClick={(e) => e.stopPropagation()}
                  className="block text-xs text-chicken-primary hover:underline"
                >
                  {order.customerPhone}
                </a>
              </div>
            </div>
          ) : !isDelivery ? (
            <div />
          ) : null}
        </div>

        {/* Notes preview */}
        {order.notes && (
          <div className="flex items-start gap-2 mt-2">
            <span className="text-gray-500 mt-0.5"><StickyNote size={14} /></span>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-gray-500 uppercase font-medium">{t("orders.notes")}</span>
              <p className="text-xs text-gray-400 truncate">{order.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Mini Progress Dots (delivery orders with tracking) ── */}
      {showProgress && (
        <div className="mt-3 pt-3 border-t border-dark-600">
          <div className="flex items-center justify-between gap-1">
            {milestones.map((milestone, i) => {
              const isCompleted = i <= currentMilestoneIdx;
              const isCurrent = i === currentMilestoneIdx;
              return (
                <div key={milestone} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <motion.div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isCurrent
                          ? "bg-chicken-primary ring-2 ring-chicken-primary/40"
                          : isCompleted
                          ? "bg-chicken-primary"
                          : "bg-dark-500"
                      }`}
                      animate={isCurrent ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                    />
                    <span className={`text-[8px] mt-0.5 capitalize ${
                      isCompleted ? "text-chicken-primary" : "text-gray-600"
                    }`}>
                      {milestone.replace("_", " ")}
                    </span>
                  </div>
                  {i < milestones.length - 1 && (
                    <div className={`h-px flex-1 mx-0.5 ${
                      i < currentMilestoneIdx ? "bg-chicken-primary" : "bg-dark-500"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
