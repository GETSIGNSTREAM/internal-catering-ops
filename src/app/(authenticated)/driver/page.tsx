"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { motion, AnimatePresence } from "framer-motion";
import {
  Truck, Phone, MapPin, Clock, Navigation, Share2, Copy,
  CheckCircle, Package, Flame, ChefHat, PartyPopper, ArrowRight,
} from "lucide-react";
import { formatDateTimePST } from "@/utils/timezone";
import { PageTransition } from "@/components/ui/PageTransition";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import LiveDriverMap from "@/components/ui/LiveDriverMap";

interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
}

interface DriverOrder {
  id: number;
  orderNumber?: string;
  customerName: string;
  customerPhone?: string;
  organization?: string;
  deliveryAddress?: string;
  deliveryMode?: string;
  deliveryTime?: string;
  pickupTime?: string;
  items: OrderItem[];
  numberOfGuests?: number;
  status: string;
  prepStatus?: string;
  trackingMilestone?: string;
  trackingToken?: string;
  notes?: string;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  confirmed: "Confirmed",
  cooking: "Cooking",
  ready: "Ready",
  en_route: "En Route",
  arriving: "Arriving",
  delivered: "Delivered",
};

const STAGE_ICONS: Record<string, any> = {
  new: ClipboardList,
  confirmed: CheckCircle,
  cooking: Flame,
  ready: Package,
  en_route: Truck,
  arriving: Navigation,
  delivered: PartyPopper,
};

// Import ClipboardList for the icon map
import { ClipboardList } from "lucide-react";

// Maps trackingMilestone → unified stage
const MILESTONE_TO_STAGE: Record<string, string> = {
  confirmed: "confirmed",
  preparing: "cooking",
  packed: "ready",
  en_route: "en_route",
  arriving: "arriving",
  delivered: "delivered",
};

function getCurrentStage(order: DriverOrder): string {
  if (order.trackingMilestone && MILESTONE_TO_STAGE[order.trackingMilestone]) {
    return MILESTONE_TO_STAGE[order.trackingMilestone];
  }
  return order.prepStatus || "new";
}

function getNextDriverAction(stage: string): { nextStage: string; label: string; color: string } | null {
  switch (stage) {
    case "ready":
      return { nextStage: "en_route", label: "Start Delivery", color: "bg-blue-500" };
    case "en_route":
      return { nextStage: "arriving", label: "Arriving Soon", color: "bg-amber-500" };
    case "arriving":
      return { nextStage: "delivered", label: "Mark Delivered", color: "bg-green-500" };
    default:
      return null;
  }
}

export default function DriverPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [driverMapLocation, setDriverMapLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      // Fetch today's orders for this driver
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const res = await fetch(
        `/api/orders?fulfillmentDateFrom=${today.toISOString()}&fulfillmentDateTo=${tomorrow.toISOString()}&limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      // Sort by delivery time
      const sorted = (data.orders || []).sort((a: DriverOrder, b: DriverOrder) => {
        const aTime = a.deliveryTime || a.pickupTime || "";
        const bTime = b.deliveryTime || b.pickupTime || "";
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });
      setOrders(sorted);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Refresh every 30s
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Clean up location watching on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
      }
    };
  }, []);

  const handleAdvanceStage = async (orderId: number, nextStage: string) => {
    setAdvancing(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/milestone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: nextStage }),
      });
      if (res.ok) {
        await fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update");
      }
    } catch (err) {
      alert("Failed to update order");
    } finally {
      setAdvancing(null);
    }
  };

  const toggleLocationSharing = () => {
    if (sharingLocation) {
      // Stop sharing
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
      lastLocationRef.current = null;
      setDriverMapLocation(null);
      setSharingLocation(false);
      setLocationError("");
      return;
    }

    // Start sharing
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }

    setSharingLocation(true);
    setLocationError("");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        lastLocationRef.current = loc;
        setDriverMapLocation(loc);
      },
      (err) => {
        setLocationError("Location access denied");
        setSharingLocation(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    // Post location every 10 seconds
    const sendLocation = async () => {
      if (!lastLocationRef.current) return;
      try {
        await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: lastLocationRef.current.lat,
            longitude: lastLocationRef.current.lng,
          }),
        });
      } catch {
        // Silently fail — will retry
      }
    };

    // Send immediately, then every 10s
    sendLocation();
    locationIntervalRef.current = setInterval(sendLocation, 10000);
  };

  const openMaps = (address: string) => {
    const encoded = encodeURIComponent(address);
    // Try Apple Maps first (iOS), falls back to Google Maps
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${encoded}`
      : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    window.open(url, "_blank");
  };

  const copyTrackingLink = (order: DriverOrder) => {
    if (!order.trackingToken) return;
    const link = `${window.location.origin}/track/${order.trackingToken}`;
    navigator.clipboard.writeText(link);
    setCopied(order.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const callCustomer = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Truck className="text-chicken-primary" size={24} />
              Deliveries
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{todayStr}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* GPS Toggle */}
            <button
              onClick={toggleLocationSharing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                sharingLocation
                  ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/50"
                  : "bg-dark-700 text-gray-400"
              }`}
            >
              <Navigation
                size={14}
                className={sharingLocation ? "animate-pulse" : ""}
              />
              {sharingLocation ? "Live" : "GPS"}
            </button>
          </div>
        </div>
        {locationError && (
          <p className="text-red-400 text-xs mt-1">{locationError}</p>
        )}
      </header>

      {/* Driver Map — shows when GPS is active and there's an active delivery */}
      {(() => {
        const activeDelivery = orders.find(
          (o) => getCurrentStage(o) === "en_route" || getCurrentStage(o) === "arriving"
        );
        if (sharingLocation && driverMapLocation && activeDelivery?.deliveryAddress) {
          return (
            <div className="px-4 pt-4">
              <LiveDriverMap
                driverLocation={{
                  latitude: driverMapLocation.lat,
                  longitude: driverMapLocation.lng,
                  heading: null,
                  speed: null,
                  recordedAt: new Date().toISOString(),
                }}
                deliveryAddress={activeDelivery.deliveryAddress}
                showDestination={true}
                height="200px"
                className="rounded-xl overflow-hidden border border-dark-600"
              />
            </div>
          );
        }
        return null;
      })()}

      {/* Content */}
      <main className="px-4 py-4 space-y-3">
        {loading ? (
          <OrderListSkeleton count={3} />
        ) : orders.length === 0 ? (
          <EmptyState
            type="orders"
            title="No deliveries today"
            message="Check back later for new assignments"
          />
        ) : (
          <PageTransition>
            <div className="space-y-3">
              {orders.map((order, index) => {
                const currentStage = getCurrentStage(order);
                const action = getNextDriverAction(currentStage);
                const isDelivered = currentStage === "delivered";
                const StageIcon = STAGE_ICONS[currentStage] || Truck;

                return (
                  <motion.div
                    key={order.id}
                    className={`rounded-xl overflow-hidden ${
                      isDelivered
                        ? "bg-dark-800/50 border border-dark-600/50"
                        : "bg-dark-800 border border-dark-600"
                    }`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {/* Order Header */}
                    <div className="px-4 pt-4 pb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {order.orderNumber && (
                              <span className="text-xs text-chicken-primary font-semibold">
                                #{order.orderNumber}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                isDelivered
                                  ? "bg-green-500/20 text-green-400"
                                  : currentStage === "en_route"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : currentStage === "arriving"
                                  ? "bg-amber-500/20 text-amber-400"
                                  : "bg-gray-500/20 text-gray-400"
                              }`}
                            >
                              <StageIcon size={10} />
                              {STAGE_LABELS[currentStage] || currentStage}
                            </span>
                          </div>
                          <h3
                            className={`font-semibold ${
                              isDelivered ? "text-gray-400" : "text-white"
                            }`}
                          >
                            {order.customerName}
                          </h3>
                          {order.organization && (
                            <p className="text-sm text-gray-400">
                              {order.organization}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-gray-400">
                            <Clock size={12} />
                            <span className="text-sm">
                              {order.deliveryTime
                                ? formatDateTimePST(order.deliveryTime)
                                : order.pickupTime
                                ? formatDateTimePST(order.pickupTime)
                                : "TBD"}
                            </span>
                          </div>
                          {order.numberOfGuests && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              {order.numberOfGuests} guests
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address */}
                    {order.deliveryAddress && (
                      <button
                        onClick={() => openMaps(order.deliveryAddress!)}
                        className="w-full px-4 py-2 flex items-center gap-2 text-left hover:bg-dark-700/50 transition-colors"
                      >
                        <MapPin size={14} className="text-chicken-primary shrink-0" />
                        <span className="text-sm text-gray-300 truncate">
                          {order.deliveryAddress}
                        </span>
                        <Navigation size={12} className="text-gray-500 shrink-0 ml-auto" />
                      </button>
                    )}

                    {/* Items summary */}
                    <div className="px-4 py-2 border-t border-dark-700">
                      <p className="text-xs text-gray-500">
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}: {" "}
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ").slice(0, 80)}
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ").length > 80 ? "..." : ""}
                      </p>
                      {order.notes && (
                        <p className="text-xs text-amber-400/80 mt-1">
                          Note: {order.notes.slice(0, 100)}{order.notes.length > 100 ? "..." : ""}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 bg-dark-900/30 flex items-center gap-2">
                      {/* Quick actions */}
                      <div className="flex gap-2">
                        {order.customerPhone && (
                          <button
                            onClick={() => callCustomer(order.customerPhone!)}
                            className="p-2 rounded-lg bg-dark-700 text-gray-400 hover:text-white transition-colors"
                            title="Call customer"
                          >
                            <Phone size={16} />
                          </button>
                        )}
                        {order.trackingToken && (
                          <button
                            onClick={() => copyTrackingLink(order)}
                            className={`p-2 rounded-lg transition-colors ${
                              copied === order.id
                                ? "bg-green-500/20 text-green-400"
                                : "bg-dark-700 text-gray-400 hover:text-white"
                            }`}
                            title="Copy tracking link"
                          >
                            {copied === order.id ? <CheckCircle size={16} /> : <Copy size={16} />}
                          </button>
                        )}
                      </div>

                      {/* Main action button */}
                      {action && !isDelivered && (
                        <motion.button
                          onClick={() => handleAdvanceStage(order.id, action.nextStage)}
                          disabled={advancing === order.id}
                          className={`flex-1 ml-2 ${action.color} text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50`}
                          whileTap={{ scale: 0.97 }}
                        >
                          {advancing === order.id ? (
                            "Updating..."
                          ) : (
                            <>
                              {action.label}
                              <ArrowRight size={16} />
                            </>
                          )}
                        </motion.button>
                      )}

                      {isDelivered && (
                        <span className="flex-1 ml-2 text-center text-green-400 text-sm font-medium flex items-center justify-center gap-1">
                          <CheckCircle size={14} /> Delivered
                        </span>
                      )}

                      {!action && !isDelivered && (
                        <span className="flex-1 ml-2 text-center text-gray-500 text-sm">
                          Waiting for kitchen...
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </PageTransition>
        )}
      </main>
    </div>
  );
}
