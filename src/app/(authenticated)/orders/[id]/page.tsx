"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, FileText, Tag, Star, Truck, Store, Clock, Phone, MapPin,
  DollarSign, ChefHat, ClipboardList, CheckCircle, Flame, Package,
  Camera, StickyNote, FolderOpen, Check, Trash2, Upload, ImageIcon, X,
  Share2, Copy, ExternalLink, Navigation, PartyPopper
} from "lucide-react";
import StatusPill from "@/components/ui/StatusPill";
import EditOrderModal from "@/components/orders/EditOrderModal";
import LiveDriverMap from "@/components/ui/LiveDriverMap";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { formatDateTimePST, getPSTTimezoneLabel } from "@/utils/timezone";

interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
}

interface Order {
  id: number;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  organization?: string;
  items: OrderItem[];
  pickupTime?: string;
  deliveryTime?: string;
  readyTime?: string;
  deliveryAddress?: string;
  deliveryMode?: string;
  status: string;
  prepStatus?: string;
  notes?: string;
  totalAmount?: number;
  orderSource?: string;
  pdfUrl?: string;
  labelsUrl?: string;
  assignedDriver?: string;
  assignedDriverId?: string;
  photoProofUrl?: string;
  completedAt?: string;
  trackingToken?: string;
  trackingMilestone?: string;
}

interface Checklist {
  id: number;
  taskName: string;
  taskType: string;
  forRole?: string;
  completed: boolean;
  completedAt?: string;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [order, setOrder] = useState<Order | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState(false);
  const [photoBlobUrl, setPhotoBlobUrl] = useState<string | null>(null);
  const [requirePhotoForDelivery, setRequirePhotoForDelivery] = useState(false);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [advancingMilestone, setAdvancingMilestone] = useState(false);
  const isDriver = user?.role === "driver";
  const isAdmin = user?.role === "admin";

  // Live driver location for map
  const driverLocation = useDriverLocation({
    driverId: order?.assignedDriverId ?? null,
    enabled: order?.deliveryMode === "delivery" &&
      ["en_route", "arriving"].includes(order?.trackingMilestone ?? ""),
    pollInterval: 10000,
  });

  // Unified stages — kitchen prep + delivery in one flow
  const kitchenStages = [
    { value: "new", label: t("orders.prepStatus.new"), icon: ClipboardList },
    { value: "confirmed", label: t("orders.prepStatus.confirmed"), icon: CheckCircle },
    { value: "cooking", label: t("orders.prepStatus.cooking"), icon: Flame },
    { value: "ready", label: t("orders.prepStatus.ready"), icon: Package },
  ];
  const deliveryOnlyStages = [
    { value: "en_route", label: "En Route", icon: Truck },
    { value: "arriving", label: "Arriving", icon: MapPin },
    { value: "delivered", label: "Delivered", icon: PartyPopper },
  ];
  const allStages = order?.deliveryMode === "delivery"
    ? [...kitchenStages, ...deliveryOnlyStages]
    : kitchenStages;

  // Derive current unified stage from DB fields
  const MILESTONE_TO_STAGE: Record<string, string> = {
    confirmed: "confirmed", preparing: "cooking", packed: "ready",
    en_route: "en_route", arriving: "arriving", delivered: "delivered",
  };
  const STAGE_TO_MILESTONE: Record<string, string | null> = {
    new: null, confirmed: "confirmed", cooking: "preparing",
    ready: "packed", en_route: "en_route", arriving: "arriving", delivered: "delivered",
  };
  const STAGE_TO_PREP: Record<string, string> = {
    new: "new", confirmed: "confirmed", cooking: "cooking",
    ready: "ready", en_route: "ready", arriving: "ready", delivered: "delivered",
  };
  const STAGE_TO_STATUS: Record<string, string> = {
    new: "new", confirmed: "new", cooking: "prep",
    ready: "ready", en_route: "ready", arriving: "ready", delivered: "delivered",
  };

  const getCurrentStage = (o: Order): string => {
    if (o.deliveryMode === "delivery" && o.trackingMilestone) {
      const mapped = MILESTONE_TO_STAGE[o.trackingMilestone];
      if (mapped) return mapped;
    }
    return o.prepStatus || "new";
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/orders/${id}`).then((r) => r.json()),
      fetch(`/api/orders/${id}/checklists`).then((r) => r.json()),
      fetch("/api/settings/requirePhotoForDelivery").then((r) => r.json()).catch(() => ({ value: null })),
    ]).then(([orderData, checklistData, settingData]) => {
      setOrder(orderData);
      setChecklists(checklistData);
      setRequirePhotoForDelivery(settingData.value === "true");
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (order?.photoProofUrl) {
      fetch(order.photoProofUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch photo");
          return res.blob();
        })
        .then((blob) => {
          if (blob.type.startsWith("image/")) {
            const url = URL.createObjectURL(blob);
            setPhotoBlobUrl(url);
          } else {
            console.error("Response is not an image:", blob.type);
          }
        })
        .catch((err) => console.error("Failed to load photo:", err));
    }
    return () => {
      if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
    };
  }, [order?.photoProofUrl]);

  const handleStageClick = async (stageValue: string) => {
    if (!order || advancingMilestone) return;

    // Photo gate for "delivered"
    if (stageValue === "delivered" && requirePhotoForDelivery && !order.photoProofUrl) {
      alert(t("photo.photoRequired"));
      return;
    }

    setAdvancingMilestone(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/milestone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stageValue }),
      });
      if (res.ok) {
        const newPrepStatus = STAGE_TO_PREP[stageValue];
        const newStatus = STAGE_TO_STATUS[stageValue];
        const newMilestone = order.deliveryMode === "delivery"
          ? (STAGE_TO_MILESTONE[stageValue] || order.trackingMilestone)
          : order.trackingMilestone;

        setOrder((prev) => prev ? {
          ...prev,
          prepStatus: newPrepStatus,
          status: newStatus,
          trackingMilestone: newMilestone || prev.trackingMilestone,
          completedAt: stageValue === "delivered" ? new Date().toISOString() : prev.completedAt,
        } : null);
      }
    } catch (error) {
      console.error("Stage update error:", error);
    } finally {
      setAdvancingMilestone(false);
    }
  };

  const toggleChecklist = async (checklist: Checklist) => {
    const newCompleted = !checklist.completed;
    await fetch(`/api/checklists/${checklist.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completed: newCompleted,
        completedAt: newCompleted ? new Date().toISOString() : null,
      }),
    });
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklist.id ? { ...c, completed: newCompleted } : c))
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch(`/api/orders/${order.id}/photo`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                photoProofUrl: data.photoUrl,
                completedAt: data.completedAt,
              }
            : null
        );
        setChecklists((prev) =>
          prev.map((c) => (c.taskType === "photo" ? { ...c, completed: true } : c))
        );
        const localUrl = URL.createObjectURL(file);
        setPhotoBlobUrl(localUrl);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to upload photo");
      }
    } catch (error) {
      console.error("Photo upload error:", error);
      alert("Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!order) return;
    setDeletingPhoto(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/photo`, {
        method: "DELETE",
      });
      if (response.ok) {
        setOrder((prev) => (prev ? { ...prev, photoProofUrl: undefined, completedAt: undefined } : null));
        setChecklists((prev) => prev.map((c) => (c.taskType === "photo" ? { ...c, completed: false } : c)));
        if (photoBlobUrl) URL.revokeObjectURL(photoBlobUrl);
        setPhotoBlobUrl(null);
        setShowDeletePhotoConfirm(false);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete photo");
      }
    } catch (error) {
      console.error("Photo delete error:", error);
      alert("Failed to delete photo");
    } finally {
      setDeletingPhoto(false);
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return t("common.notSet");
    return formatDateTimePST(dateStr) + ` ${getPSTTimezoneLabel()}`;
  };

  const handleViewPdf = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch PDF");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = blobUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (error) {
      console.error("PDF view error:", error);
      alert("Failed to open PDF");
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/orders");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete order");
      }
    } catch (error) {
      console.error("Delete order error:", error);
      alert("Failed to delete order");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleGenerateTrackingLink = async () => {
    if (!order) return;
    setGeneratingToken(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/tracking-token`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setOrder((prev) => prev ? { ...prev, trackingToken: data.trackingToken } : null);
        setTrackingUrl(data.trackingUrl);
      }
    } catch (error) {
      console.error("Generate tracking token error:", error);
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyTrackingLink = async () => {
    const url = trackingUrl || (order?.trackingToken ? `${window.location.origin}/track/${order.trackingToken}` : null);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback for mobile
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-chicken-primary">{t("common.loading")}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400">{t("orders.orderNotFound")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-900 pb-24">
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/orders")} className="text-white p-1">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{order.customerName}</h1>
            {order.organization && (
              <p className="text-sm text-gray-400">{order.organization}</p>
            )}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEditModal(true)}
                className="bg-dark-600 text-chicken-primary px-3 py-2 rounded-lg text-sm font-medium hover:bg-dark-500 transition-colors"
              >
                {t("common.edit")}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-dark-600 text-red-400 p-2 rounded-lg hover:bg-dark-500 transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
          <StatusPill status={order.status} />
        </div>
      </header>

      <main className="px-4 py-4 space-y-6">
        {(order.pdfUrl || order.labelsUrl) && (
          <section className="bg-dark-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <FolderOpen size={16} /> {t("orders.documents")}
            </h2>
            <div className="flex flex-wrap gap-3">
              {order.pdfUrl && (
                <button
                  onClick={() => handleViewPdf(order.pdfUrl!, "order.pdf")}
                  className="flex items-center gap-2 bg-chicken-primary text-dark-900 px-4 py-3 rounded-xl font-medium hover:bg-chicken-secondary transition-colors"
                >
                  <FileText size={20} />
                  <span>{t("orders.viewOrderPdf")}</span>
                </button>
              )}
              {order.labelsUrl && (
                <button
                  onClick={() => handleViewPdf(order.labelsUrl!, "labels.pdf")}
                  className="flex items-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
                >
                  <Tag size={20} />
                  <span>{t("orders.viewLabels")}</span>
                </button>
              )}
            </div>
          </section>
        )}

        <section className="bg-dark-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Star size={16} /> {t("orders.orderDetails")}
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">{t("orders.type")}</span>
              <span className="text-white flex items-center gap-1.5">
                {order.deliveryMode === "delivery" ? <Truck size={16} /> : <Store size={16} />}
                {order.deliveryMode === "delivery" ? t("orders.delivery") : t("orders.pickup")}
              </span>
            </div>
            {order.deliveryMode === "delivery" ? (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t("orders.readyTime")}</span>
                  <span className="text-yellow-400 font-medium">
                    {formatDateTime(order.readyTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t("orders.deliveryTime")}</span>
                  <span className="text-chicken-primary font-medium">
                    {formatDateTime(order.deliveryTime)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-gray-400">{t("orders.pickupTime")}</span>
                <span className="text-chicken-primary font-medium">
                  {formatDateTime(order.pickupTime)}
                </span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex justify-between">
                <span className="text-gray-400">{t("orders.phone")}</span>
                <a href={`tel:${order.customerPhone}`} className="text-chicken-primary">{order.customerPhone}</a>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="flex justify-between">
                <span className="text-gray-400">{t("orders.address")}</span>
                <span className="text-white text-right text-sm max-w-[200px]">{order.deliveryAddress}</span>
              </div>
            )}
            {order.assignedDriver && (
              <div className="flex justify-between items-center">
                <span className="text-gray-400">{t("orders.assignedDriver")}</span>
                <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-300 font-medium text-sm flex items-center gap-1.5">
                  <Truck size={14} /> {order.assignedDriver}
                </span>
              </div>
            )}
            {order.totalAmount !== null && order.totalAmount !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-400">{t("orders.orderTotalLabel")}</span>
                <span className="text-chicken-primary font-bold">${(order.totalAmount / 100).toFixed(2)}</span>
              </div>
            )}
            {order.orderSource && (
              <div className="flex justify-between">
                <span className="text-gray-400">{t("orders.source")}</span>
                <span className="text-white">{order.orderSource}</span>
              </div>
            )}
          </div>
        </section>

        <section className="bg-dark-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <ChefHat size={16} /> {t("orders.items")}
          </h2>
          <div className="space-y-2">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-dark-600 last:border-0">
                <span className="text-white">{item.name}</span>
                <span className="text-chicken-primary font-medium">x{item.quantity}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Unified Order Progress ── */}
        <section className="bg-dark-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-400 flex items-center gap-2">
              <Navigation size={16} /> Order Progress
            </h2>
            {/* Tracking link tools — delivery orders only */}
            {order.deliveryMode === "delivery" && (
              <>
                {order.trackingToken ? (
                  <button
                    onClick={handleCopyTrackingLink}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      copiedLink
                        ? "bg-green-500/20 text-green-400"
                        : "bg-chicken-primary/20 text-chicken-primary hover:bg-chicken-primary/30"
                    }`}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    {copiedLink ? "Copied!" : "Copy Link"}
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateTrackingLink}
                    disabled={generatingToken}
                    className="flex items-center gap-1.5 bg-chicken-primary text-dark-900 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-chicken-secondary transition-colors disabled:opacity-50"
                  >
                    <Share2 size={14} />
                    {generatingToken ? "Generating..." : "Enable Tracking"}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Row 1: Kitchen stages */}
          {(() => {
            const currentStage = getCurrentStage(order);
            const currentGlobalIdx = allStages.findIndex((s) => s.value === currentStage);

            const renderProgressRow = (stages: typeof kitchenStages, globalOffset: number, label: string) => {
              return (
                <div className="mb-1">
                  <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-2 block">{label}</span>
                  <div className="flex items-center justify-between relative">
                    {/* Background track */}
                    <div className="absolute top-4 left-4 right-4 h-0.5 bg-dark-500" />
                    {/* Animated progress fill */}
                    {(() => {
                      const localCurrentIdx = Math.min(
                        Math.max(currentGlobalIdx - globalOffset, -1),
                        stages.length - 1
                      );
                      return (
                        <motion.div
                          className="absolute top-4 left-4 h-0.5 bg-chicken-primary"
                          initial={false}
                          animate={{
                            width: localCurrentIdx >= 0
                              ? `calc(${(localCurrentIdx / Math.max(stages.length - 1, 1)) * 100}% - 32px)`
                              : "0px",
                          }}
                          transition={{ duration: 0.6, ease: "easeInOut" }}
                        />
                      );
                    })()}

                    {stages.map((stage, localIndex) => {
                      const globalIndex = globalOffset + localIndex;
                      const isActive = globalIndex <= currentGlobalIdx;
                      const isCurrent = globalIndex === currentGlobalIdx;
                      const isNext = globalIndex === currentGlobalIdx + 1;
                      const canClick = isAdmin || isDriver;
                      const Icon = stage.icon;

                      return (
                        <motion.button
                          key={stage.value}
                          onClick={() => canClick && handleStageClick(stage.value)}
                          disabled={advancingMilestone || !canClick}
                          className="relative z-10 flex flex-col items-center flex-1"
                          whileTap={canClick ? { scale: 0.9 } : {}}
                        >
                          <motion.div
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              isCurrent
                                ? "bg-chicken-primary text-dark-900 ring-4 ring-chicken-primary/30"
                                : isActive
                                ? "bg-chicken-primary text-dark-900"
                                : isNext
                                ? "bg-dark-500 text-gray-300 ring-2 ring-dashed ring-gray-500"
                                : "bg-dark-500 text-gray-500"
                            }`}
                            animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                            transition={{ repeat: Infinity, duration: 2 }}
                          >
                            <Icon size={14} strokeWidth={2.5} />
                          </motion.div>
                          <span
                            className={`text-[9px] mt-1 text-center font-medium leading-tight ${
                              isActive ? "text-chicken-primary" : "text-gray-500"
                            }`}
                          >
                            {stage.label}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            };

            return (
              <>
                {renderProgressRow(kitchenStages, 0, "Kitchen")}
                {order.deliveryMode === "delivery" && (
                  <>
                    {/* Visual bridge between kitchen → delivery */}
                    <div className="flex justify-center my-1">
                      <div className={`w-0.5 h-4 ${currentGlobalIdx >= kitchenStages.length ? "bg-chicken-primary" : "bg-dark-500"}`} />
                    </div>
                    {renderProgressRow(deliveryOnlyStages, kitchenStages.length, "Delivery")}
                  </>
                )}
              </>
            );
          })()}

          {/* Tracking share toolbar — delivery orders with token */}
          {order.deliveryMode === "delivery" && order.trackingToken && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-dark-600">
              <button
                onClick={() => window.open(`/track/${order.trackingToken}`, "_blank")}
                className="flex-1 flex items-center justify-center gap-2 bg-dark-600 text-gray-300 py-2 rounded-xl text-xs font-medium hover:bg-dark-500 transition-colors"
              >
                <ExternalLink size={14} />
                Preview
              </button>
              {order.customerPhone && (
                <a
                  href={`sms:${order.customerPhone}?body=Track your WILDBIRD catering order: ${window.location.origin}/track/${order.trackingToken}`}
                  className="flex items-center justify-center gap-2 bg-green-600/20 text-green-400 px-4 py-2 rounded-xl text-xs font-medium hover:bg-green-600/30 transition-colors"
                >
                  <Phone size={14} />
                  SMS
                </a>
              )}
            </div>
          )}
        </section>

        {/* Live Driver Map */}
        {driverLocation && order.deliveryMode === "delivery" && order.assignedDriverId && (
          <section className="bg-dark-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <MapPin size={16} /> Driver Location
            </h2>
            <LiveDriverMap
              driverLocation={driverLocation}
              deliveryAddress={order.deliveryAddress}
              showDestination={true}
              height="200px"
              className="rounded-xl overflow-hidden"
            />
          </section>
        )}

        <section className="bg-dark-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <CheckCircle size={16} /> {t("checklist.title")}
          </h2>
          <div className="space-y-2">
            {checklists.map((item) =>
              item.taskType === "photo" ? (
                <div
                  key={item.id}
                  className={`w-full p-3 rounded-xl transition-all ${
                    item.completed ? "bg-green-900/30" : "bg-dark-600"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        item.completed ? "bg-green-500 border-green-500" : "border-gray-500"
                      }`}
                    >
                      {item.completed && <span className="text-white text-sm">&#10003;</span>}
                    </span>
                    <span className={`text-sm flex-1 ${item.completed ? "text-gray-400 line-through" : "text-white"}`}>
                      {item.taskName}
                    </span>
                    {requirePhotoForDelivery && !item.completed && (
                      <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded-full">{t("photo.required")}</span>
                    )}
                  </div>

                  {order.photoProofUrl || photoBlobUrl ? (
                    <div className="mt-3">
                      <div className="relative">
                        {photoBlobUrl ? (
                          <img
                            src={photoBlobUrl}
                            alt="Order completion proof"
                            className="w-full rounded-lg max-h-64 object-cover"
                          />
                        ) : (
                          <div className="w-full h-32 bg-dark-600 rounded-lg flex items-center justify-center">
                            <span className="text-gray-400 text-sm">{t("photo.loading")}</span>
                          </div>
                        )}
                        <button
                          onClick={() => setShowDeletePhotoConfirm(true)}
                          className="absolute top-2 right-2 bg-dark-900/80 text-red-400 p-1.5 rounded-full hover:bg-red-900/60 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {order.completedAt && (
                        <p className="text-xs text-green-400 mt-2 text-center">
                          {t("photo.verified")}: {formatDateTime(order.completedAt)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                        <span
                          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium cursor-pointer text-sm ${
                            uploadingPhoto
                              ? "bg-gray-600 text-gray-400"
                              : "bg-chicken-primary text-dark-900 hover:bg-chicken-secondary"
                          }`}
                        >
                          <Camera size={18} />
                          {uploadingPhoto ? t("photo.uploading") : t("photo.takePhoto")}
                        </span>
                      </label>
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                          className="hidden"
                        />
                        <span
                          className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium cursor-pointer text-sm ${
                            uploadingPhoto
                              ? "bg-gray-600 text-gray-400"
                              : "bg-dark-500 text-white hover:bg-dark-400 border border-dark-400"
                          }`}
                        >
                          <Upload size={18} />
                          {t("photo.uploadImage")}
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              ) : (
                <motion.button
                  key={item.id}
                  onClick={() => toggleChecklist(item)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                    item.completed ? "bg-green-900/30" : "bg-dark-600"
                  }`}
                  whileTap={{ scale: 0.98 }}
                  layout
                >
                  <motion.span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      item.completed ? "bg-green-500 border-green-500" : "border-gray-500"
                    }`}
                    animate={item.completed ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.3 }}
                  >
                    <AnimatePresence>
                      {item.completed && (
                        <motion.span
                          className="text-white text-sm"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          &#10003;
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.span>
                  <span className={`text-sm ${item.completed ? "text-gray-400 line-through" : "text-white"}`}>
                    {item.taskName}
                  </span>
                </motion.button>
              )
            )}
          </div>
        </section>

        {order.notes && (
          <section className="bg-dark-700 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <StickyNote size={16} /> {t("orders.notes")}
            </h2>
            <p className="text-white text-sm whitespace-pre-wrap">{order.notes}</p>
          </section>
        )}
      </main>

      <AnimatePresence>
        {showDeletePhotoConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeletePhotoConfirm(false)}
          >
            <motion.div
              className="bg-dark-700 rounded-t-2xl w-full max-w-md p-6"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">{t("photo.deletePhotoTitle")}</h3>
              <p className="text-gray-400 mb-6">{t("photo.deletePhotoMessage")}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeletePhotoConfirm(false)}
                  className="flex-1 bg-dark-600 text-white py-3 rounded-xl font-medium"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDeletePhoto}
                  disabled={deletingPhoto}
                  className="flex-1 bg-red-500 text-white py-3 rounded-xl font-medium"
                >
                  {deletingPhoto ? t("photo.deleting") : t("common.delete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showDeleteConfirm && (
          <motion.div
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              className="bg-dark-700 rounded-t-2xl w-full max-w-md p-6"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-2">{t("orders.deleteOrder")}</h3>
              <p className="text-gray-400 mb-6">{t("orders.deleteOrderMessage")}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-dark-600 text-white py-3 rounded-xl font-medium"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleDeleteOrder}
                  disabled={deleting}
                  className="flex-1 bg-red-500 text-white py-3 rounded-xl font-medium"
                >
                  {deleting ? t("orders.deleting") : t("common.delete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showEditModal && order && (
          <EditOrderModal
            order={order}
            onClose={() => setShowEditModal(false)}
            onUpdated={(updated) => {
              setOrder(updated);
              setShowEditModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
