"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle, Flame, Package, Truck, MapPin, PartyPopper,
  Phone, Clock, Users, ChefHat, MapPinned
} from "lucide-react";
import LiveDriverMap from "@/components/ui/LiveDriverMap";

interface TrackingData {
  orderNumber: string | null;
  customerName: string;
  organization: string | null;
  deliveryAddress: string | null;
  deliveryMode: string | null;
  deliveryTime: string | null;
  pickupTime: string | null;
  estimatedArrival: string | null;
  currentMilestone: string;
  items: { name: string; quantity: number; notes?: string }[];
  numberOfGuests: number | null;
  driver: { name: string; phone: string | null } | null;
  driverLocation: {
    latitude: number;
    longitude: number;
    heading: number | null;
    speed: number | null;
    recordedAt: string | null;
  } | null;
  history: { milestone: string; triggeredAt: string }[];
}

const MILESTONES = [
  { value: "confirmed", label: "Confirmed", icon: CheckCircle, color: "text-green-400" },
  { value: "preparing", label: "Preparing", icon: Flame, color: "text-orange-400" },
  { value: "packed", label: "Packed", icon: Package, color: "text-blue-400" },
  { value: "en_route", label: "On the Way", icon: Truck, color: "text-yellow-400" },
  { value: "arriving", label: "Almost There", icon: MapPin, color: "text-purple-400" },
  { value: "delivered", label: "Delivered", icon: PartyPopper, color: "text-green-400" },
];

export default function TrackingPage() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${trackingId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Order not found");
        } else {
          setError("Failed to load tracking data");
        }
        return;
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError("Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  }, [trackingId]);

  // Initial load + poll every 15 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🍗</div>
          <h1 className="text-xl font-bold text-white mb-2">Order Not Found</h1>
          <p className="text-gray-400 text-sm">This tracking link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const currentIndex = MILESTONES.findIndex((m) => m.value === data.currentMilestone);
  const fulfillmentTime = data.deliveryTime || data.pickupTime;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      <header className="bg-[#222] border-b border-[#333] px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-400 rounded-xl flex items-center justify-center text-lg font-bold text-[#1a1a1a]">
            W
          </div>
          <div className="flex-1">
            <h1 className="text-white font-bold text-sm">WILDBIRD Catering</h1>
            <p className="text-gray-400 text-xs">Order Tracking</p>
          </div>
          {data.orderNumber && (
            <span className="text-orange-400 font-mono text-sm">#{data.orderNumber}</span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Current Status Hero */}
        <motion.section
          className="bg-[#222] rounded-2xl p-6 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {currentIndex >= 0 && (
            <>
              <motion.div
                key={data.currentMilestone}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="text-5xl mb-3"
              >
                {data.currentMilestone === "confirmed" && "✅"}
                {data.currentMilestone === "preparing" && "🔥"}
                {data.currentMilestone === "packed" && "📦"}
                {data.currentMilestone === "en_route" && (
                  <img src="/icons/wildbird-van.png" alt="WILDBIRD delivery van" className="h-12 w-auto" />
                )}
                {data.currentMilestone === "arriving" && "📍"}
                {data.currentMilestone === "delivered" && "🎉"}
              </motion.div>
              <h2 className="text-xl font-bold text-white mb-1">
                {MILESTONES[currentIndex].label}
              </h2>
              <p className="text-gray-400 text-sm">
                {data.currentMilestone === "confirmed" && "Your order has been confirmed"}
                {data.currentMilestone === "preparing" && "Our chefs are preparing your order"}
                {data.currentMilestone === "packed" && "Your order is packed and ready"}
                {data.currentMilestone === "en_route" && "Your order is on its way!"}
                {data.currentMilestone === "arriving" && "Your driver is almost there"}
                {data.currentMilestone === "delivered" && "Your order has been delivered. Enjoy!"}
              </p>
            </>
          )}
        </motion.section>

        {/* Progress Bar */}
        <section className="bg-[#222] rounded-2xl p-5">
          <div className="flex items-center justify-between relative">
            {/* Background line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-[#333]" />
            {/* Progress line */}
            <motion.div
              className="absolute top-4 left-4 h-0.5 bg-orange-400"
              initial={{ width: 0 }}
              animate={{
                width: currentIndex >= 0
                  ? `calc(${(currentIndex / (MILESTONES.length - 1)) * 100}% - 32px)`
                  : 0,
              }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            />

            {MILESTONES.map((milestone, index) => {
              const isActive = index <= currentIndex;
              const isCurrent = index === currentIndex;
              const Icon = milestone.icon;

              return (
                <div key={milestone.value} className="relative z-10 flex flex-col items-center" style={{ width: "48px" }}>
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isCurrent
                        ? "bg-orange-400 text-[#1a1a1a] ring-4 ring-orange-400/30"
                        : isActive
                        ? "bg-orange-400 text-[#1a1a1a]"
                        : "bg-[#333] text-gray-500"
                    }`}
                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Icon size={16} strokeWidth={2.5} />
                  </motion.div>
                  <span
                    className={`text-[10px] mt-1.5 text-center font-medium ${
                      isActive ? "text-orange-400" : "text-gray-500"
                    }`}
                  >
                    {milestone.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ETA / Delivery Info */}
        {fulfillmentTime && (
          <section className="bg-[#222] rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-400/20 rounded-xl flex items-center justify-center">
                <Clock size={20} className="text-orange-400" />
              </div>
              <div>
                <p className="text-gray-400 text-xs">
                  {data.deliveryMode === "delivery" ? "Estimated Delivery" : "Pickup Time"}
                </p>
                <p className="text-white font-bold">
                  {new Date(fulfillmentTime).toLocaleString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "America/Los_Angeles",
                  })}
                  {" PST"}
                </p>
              </div>
            </div>

            {data.deliveryAddress && data.deliveryMode === "delivery" && (
              <div className="flex items-start gap-3 mt-4 pt-4 border-t border-[#333]">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPinned size={20} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Delivery Address</p>
                  <p className="text-white text-sm">{data.deliveryAddress}</p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Driver Info */}
        {data.driver && (data.currentMilestone === "en_route" || data.currentMilestone === "arriving") && (
          <motion.section
            className="bg-[#222] rounded-2xl p-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-400 rounded-full flex items-center justify-center text-[#1a1a1a] font-bold text-lg">
                {data.driver.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">{data.driver.name}</p>
                <p className="text-gray-400 text-xs">Your Driver</p>
              </div>
              {data.driver.phone && (
                <a
                  href={`tel:${data.driver.phone}`}
                  className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center"
                >
                  <Phone size={20} className="text-green-400" />
                </a>
              )}
            </div>
          </motion.section>
        )}

        {/* Live Driver Map */}
        {data.driverLocation && data.deliveryMode === "delivery" && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <LiveDriverMap
              driverLocation={data.driverLocation}
              deliveryAddress={data.deliveryAddress}
              showDestination={true}
              height="240px"
              className="rounded-2xl overflow-hidden border border-[#333]"
            />
          </motion.section>
        )}

        {/* Order Summary */}
        <section className="bg-[#222] rounded-2xl p-5">
          <h3 className="text-gray-400 text-xs font-semibold mb-3 flex items-center gap-2">
            <ChefHat size={14} /> ORDER SUMMARY
          </h3>
          <div className="space-y-2">
            {data.customerName && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Customer</span>
                <span className="text-white">{data.customerName}</span>
              </div>
            )}
            {data.organization && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Organization</span>
                <span className="text-white">{data.organization}</span>
              </div>
            )}
            {data.numberOfGuests && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Guests</span>
                <span className="text-white flex items-center gap-1">
                  <Users size={14} /> {data.numberOfGuests}
                </span>
              </div>
            )}
          </div>

          {data.items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#333] space-y-2">
              {data.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-white">{item.name}</span>
                  <span className="text-orange-400 font-medium">x{item.quantity}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Activity Timeline */}
        {data.history.length > 0 && (
          <section className="bg-[#222] rounded-2xl p-5">
            <h3 className="text-gray-400 text-xs font-semibold mb-4">ACTIVITY</h3>
            <div className="space-y-3">
              {data.history.map((entry, i) => {
                const milestone = MILESTONES.find((m) => m.value === entry.milestone);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
                    <span className="text-white text-sm flex-1">
                      {milestone?.label || entry.milestone}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {new Date(entry.triggeredAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/Los_Angeles",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-gray-500 text-xs">
            Powered by <span className="text-orange-400 font-medium">WILDBIRD</span>
          </p>
        </footer>
      </main>
    </div>
  );
}
