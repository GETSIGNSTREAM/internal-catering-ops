"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Tag } from "lucide-react";
import { toDatetimeLocalPST, fromDatetimeLocalToPST, getPSTTimezoneLabel } from "@/utils/timezone";

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  onUpdated: (updatedOrder: Order) => void;
}

interface OrderItem {
  name: string;
  quantity: number;
  notes?: string;
}

interface Order {
  id: number;
  orderNumber?: string;
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
  utensilsRequested?: boolean;
  numberOfGuests?: number;
  pdfUrl?: string;
  labelsUrl?: string;
  assignedStoreId?: number;
  assignedDriver?: string;
  assignedDriverId?: string;
  photoProofUrl?: string;
  completedAt?: string;
}

interface StoreItem {
  id: number;
  name: string;
}

export default function EditOrderModal({ order, onClose, onUpdated }: EditOrderModalProps) {
  const [orderNumber, setOrderNumber] = useState(order.orderNumber || "");
  const [customerName, setCustomerName] = useState(order.customerName || "");
  const [organization, setOrganization] = useState(order.organization || "");
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone || "");
  const [customerEmail, setCustomerEmail] = useState(order.customerEmail || "");
  const [deliveryMode, setDeliveryMode] = useState(order.deliveryMode || "pickup");
  const [orderTime, setOrderTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress || "");
  const [items, setItems] = useState<OrderItem[]>(order.items || [{ name: "", quantity: 1 }]);
  const [notes, setNotes] = useState(order.notes || "");
  const [status, setStatus] = useState(order.status || "new");
  const [prepStatus, setPrepStatus] = useState(order.prepStatus || "pending");
  const [totalAmount, setTotalAmount] = useState(order.totalAmount ? (order.totalAmount / 100).toFixed(2) : "");
  const [orderSource, setOrderSource] = useState(order.orderSource || "");
  const [utensilsRequested, setUtensilsRequested] = useState(order.utensilsRequested || false);
  const [numberOfGuests, setNumberOfGuests] = useState(order.numberOfGuests ? String(order.numberOfGuests) : "");
  const [pdfUrl, setPdfUrl] = useState(order.pdfUrl || "");
  const [labelsUrl, setLabelsUrl] = useState(order.labelsUrl || "");
  const [assignedStoreId, setAssignedStoreId] = useState<number | null>(order.assignedStoreId || null);
  const [assignedDriver, setAssignedDriver] = useState(order.assignedDriver || "");
  const [assignedDriverId, setAssignedDriverId] = useState<string | null>(order.assignedDriverId || null);
  const [driverUsers, setDriverUsers] = useState<{ id: string; name: string }[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingLabels, setUploadingLabels] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const labelsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/stores").then((res) => res.json()).then((data) => setStores(data)).catch(() => {});
    fetch("/api/drivers").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setDriverUsers(data); }).catch(() => {});
  }, []);

  const orderSources = ["eatwildbird.com", "ezcater", "foodja", "catercow", "sharebite", "zerocater", "relish", "forkable"];

  useEffect(() => {
    const timeStr = order.deliveryMode === "delivery" ? order.deliveryTime : order.pickupTime;
    if (timeStr) setOrderTime(toDatetimeLocalPST(new Date(timeStr)));
  }, [order]);

  const addItem = () => setItems([...items, { name: "", quantity: 1 }]);
  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };
  const removeItem = (index: number) => { if (items.length > 1) setItems(items.filter((_, i) => i !== index)); };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please upload a PDF file"); return; }
    setUploading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/orders/upload-pdf", { method: "POST", body: formData });
      if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.error || "Failed to upload PDF"); }
      const data = await res.json();
      if (data.pdfUrl) setPdfUrl(data.pdfUrl);
    } catch (err: any) { setError(err.message || "Failed to upload PDF"); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleLabelsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Please upload a PDF file"); return; }
    setUploadingLabels(true); setError("");
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/orders/upload-labels", { method: "POST", body: formData });
      if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.error || "Failed to upload labels"); }
      const data = await res.json();
      if (data.labelsUrl) setLabelsUrl(data.labelsUrl);
    } catch (err: any) { setError(err.message || "Failed to upload labels"); }
    finally { setUploadingLabels(false); if (labelsInputRef.current) labelsInputRef.current.value = ""; }
  };

  const handleViewPdf = (url: string) => {
    const viewUrl = url.startsWith("/objects/") ? `/api${url}` : url;
    window.open(viewUrl, "_blank");
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true); setError("");
    const validItems = items.filter((item) => item.name.trim());
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber || null, customerName, customerEmail: customerEmail || null,
          organization: organization || null, customerPhone: customerPhone || null, deliveryMode,
          pickupTime: deliveryMode === "pickup" && orderTime ? fromDatetimeLocalToPST(orderTime).toISOString() : null,
          deliveryTime: deliveryMode === "delivery" && orderTime ? fromDatetimeLocalToPST(orderTime).toISOString() : null,
          readyTime: deliveryMode === "delivery" && orderTime ? new Date(fromDatetimeLocalToPST(orderTime).getTime() - 30 * 60 * 1000).toISOString() : null,
          deliveryAddress: deliveryMode === "delivery" ? deliveryAddress : null,
          items: validItems, notes: notes || null,
          totalAmount: totalAmount ? Math.round(parseFloat(totalAmount) * 100) : null,
          orderSource: orderSource || null, utensilsRequested,
          numberOfGuests: numberOfGuests ? parseInt(numberOfGuests) : null,
          pdfUrl: pdfUrl || null, labelsUrl: labelsUrl || null,
          assignedStoreId: assignedStoreId || null,
          assignedDriver: assignedDriver || null,
          assignedDriverId: assignedDriverId || null,
          status, prepStatus,
        }),
      });
      if (res.ok) { const updatedOrder = await res.json(); onUpdated(updatedOrder); }
      else { const errorData = await res.json().catch(() => ({})); setError(errorData.error || "Failed to save changes."); }
    } catch (err) { setError("Failed to save changes."); }
    finally { setLoading(false); }
  };

  const statusOptions = [
    { value: "new", label: "New" }, { value: "confirmed", label: "Confirmed" },
    { value: "prep", label: "In Prep" }, { value: "ready", label: "Ready" },
    { value: "delivered", label: "Delivered" }, { value: "cancelled", label: "Cancelled" },
  ];
  const prepStatusOptions = [
    { value: "new", label: "New Order Prep" }, { value: "confirmed", label: "Confirmed" },
    { value: "cooking", label: "Cooking" }, { value: "ready", label: "Ready" },
  ];

  return (
    <motion.div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="bg-dark-800 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}>
        <div className="sticky top-0 bg-dark-800 px-4 py-4 border-b border-dark-600 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">Edit Order</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Assigned Location</label>
            <select value={assignedStoreId || ""} onChange={(e) => setAssignedStoreId(e.target.value ? parseInt(e.target.value) : null)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary">
              <option value="">Select a location...</option>
              {stores.map((store) => (<option key={store.id} value={store.id}>{store.name}</option>))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Order Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary">
                {statusOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Prep Status</label>
              <select value={prepStatus} onChange={(e) => setPrepStatus(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary">
                {prepStatusOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select>
            </div>
          </div>

          <div><label className="block text-sm text-gray-400 mb-1">Order #</label><input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. 12345" className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Customer Name *</label><input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" required /></div>
          <div><label className="block text-sm text-gray-400 mb-1">Organization</label><input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm text-gray-400 mb-1">Phone</label><input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>
            <div><label className="block text-sm text-gray-400 mb-1">Email</label><input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Order Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeliveryMode("pickup")} className={`py-3 rounded-xl font-medium transition-colors ${deliveryMode === "pickup" ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>Pickup</button>
              <button type="button" onClick={() => setDeliveryMode("delivery")} className={`py-3 rounded-xl font-medium transition-colors ${deliveryMode === "delivery" ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>Delivery</button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">{deliveryMode === "delivery" ? "Delivery Time" : "Pickup Time"} <span className="text-xs text-gray-500">({getPSTTimezoneLabel()})</span></label>
            <input type="datetime-local" value={orderTime} onChange={(e) => setOrderTime(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
          </div>

          {deliveryMode === "delivery" && (
            <>
              <div><label className="block text-sm text-gray-400 mb-1">Delivery Address</label><input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Assign Driver</label>
                <select
                  value={assignedDriverId || ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setAssignedDriverId(id);
                    const driver = driverUsers.find((d) => d.id === id);
                    setAssignedDriver(driver?.name || "");
                  }}
                  className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary"
                >
                  <option value="">Select driver...</option>
                  {driverUsers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-2">Order Items</label>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input type="text" placeholder="Item name" value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} className="flex-1 bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
                <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)} className="w-20 bg-dark-700 text-white px-3 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary text-center" />
                <button type="button" onClick={() => removeItem(index)} className="text-red-500 px-2">x</button>
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-chicken-primary text-sm font-medium">+ Add Item</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm text-gray-400 mb-1"># of Guests</label><input type="number" min="0" value={numberOfGuests} onChange={(e) => setNumberOfGuests(e.target.value)} placeholder="0" className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Utensils Requested</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setUtensilsRequested(true)} className={`py-3 rounded-xl font-medium transition-colors ${utensilsRequested ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>Yes</button>
                <button type="button" onClick={() => setUtensilsRequested(false)} className={`py-3 rounded-xl font-medium transition-colors ${!utensilsRequested ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>No</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm text-gray-400 mb-1">Order Total ($)</label><input type="number" step="0.01" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" /></div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Order Source</label>
              <select value={orderSource} onChange={(e) => setOrderSource(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary">
                <option value="">Select source...</option>
                {orderSources.map((source) => (<option key={source} value={source}>{source}</option>))}
              </select>
            </div>
          </div>

          <div><label className="block text-sm text-gray-400 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary resize-none" /></div>

          <div className="bg-dark-700 rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Order PDF</label>
            {pdfUrl ? (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => handleViewPdf(pdfUrl)} className="flex items-center gap-2 text-chicken-primary hover:underline"><FileText size={16} /><span className="text-sm">View Current PDF</span></button>
                <label htmlFor="pdf-replace" className="text-xs text-gray-400 hover:text-white cursor-pointer">Replace</label>
              </div>
            ) : null}
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" id="pdf-replace" />
            {!pdfUrl && (
              <label htmlFor="pdf-replace" className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium cursor-pointer transition-colors ${uploading ? "bg-dark-600 text-gray-400" : "bg-chicken-primary/20 text-chicken-primary hover:bg-chicken-primary/30"}`}>
                {uploading ? <><span className="animate-spin">&#9203;</span> Uploading...</> : <span className="flex items-center gap-2"><FileText size={18} /> Upload Order PDF</span>}
              </label>
            )}
          </div>

          <div className="bg-dark-700 rounded-xl p-4">
            <label className="block text-sm text-gray-400 mb-2">Labels PDF</label>
            {labelsUrl ? (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => handleViewPdf(labelsUrl)} className="flex items-center gap-2 text-chicken-primary hover:underline"><Tag size={16} /><span className="text-sm">View Labels PDF</span></button>
                <label htmlFor="labels-replace" className="text-xs text-gray-400 hover:text-white cursor-pointer">Replace</label>
              </div>
            ) : null}
            <input ref={labelsInputRef} type="file" accept="application/pdf" onChange={handleLabelsUpload} className="hidden" id="labels-replace" />
            {!labelsUrl && (
              <label htmlFor="labels-replace" className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium cursor-pointer transition-colors ${uploadingLabels ? "bg-dark-600 text-gray-400" : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"}`}>
                {uploadingLabels ? <><span className="animate-spin">&#9203;</span> Uploading...</> : <span className="flex items-center gap-2"><Tag size={18} /> Upload Labels PDF</span>}
              </label>
            )}
          </div>

          <motion.button type="button" onClick={handleSubmit} disabled={loading || !customerName.trim()} className="w-full bg-chicken-primary text-dark-900 font-semibold py-3 rounded-xl hover:bg-chicken-secondary transition-colors disabled:opacity-50" whileTap={{ scale: 0.98 }}>
            {loading ? "Saving..." : "Save Changes"}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
