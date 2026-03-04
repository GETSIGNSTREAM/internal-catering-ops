"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Store, Truck } from "lucide-react";
import { toDatetimeLocalPST, fromDatetimeLocalToPST, getPSTTimezoneLabel } from "@/utils/timezone";

interface CreateOrderModalProps {
  onClose: () => void;
  onCreated: () => void;
  isAdmin?: boolean;
}

interface OrderItem {
  name: string;
  quantity: number;
}

interface ParsedOrderData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  organization?: string;
  guestCount?: number;
  pickupTime?: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  deliveryMode: "pickup" | "delivery";
  items: Array<{ name: string; quantity: number; notes?: string }>;
  notes?: string;
  totalAmount?: number;
  orderNumber?: string;
  orderSource?: string;
  utensilsRequested?: boolean;
  pdfUrl?: string;
}

export default function CreateOrderModal({ onClose, onCreated, isAdmin = false }: CreateOrderModalProps) {
  const [orderNumber, setOrderNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [organization, setOrganization] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryMode, setDeliveryMode] = useState("pickup");
  const [pickupTime, setPickupTime] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [assignedDriver, setAssignedDriver] = useState("");
  const [items, setItems] = useState<OrderItem[]>([{ name: "", quantity: 1 }]);
  const [itemsPending, setItemsPending] = useState(false);

  const driverOptions = ["Oscar", "Jamie", "DeliverThat"];
  const [notes, setNotes] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [orderSource, setOrderSource] = useState("");
  const [utensilsRequested, setUtensilsRequested] = useState(false);
  const [numberOfGuests, setNumberOfGuests] = useState("");

  const orderSources = ["eatwildbird.com", "ezcater", "foodja", "catercow", "sharebite", "zerocater", "relish"];
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pdfParsed, setPdfParsed] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addItem = () => setItems([...items, { name: "", quantity: 1 }]);

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== index));
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Please upload a PDF file");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/orders/parse-pdf", { method: "POST", body: formData });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to parse PDF");
      }
      const data: ParsedOrderData = await res.json();
      setCustomerName(data.customerName || "");
      setCustomerEmail(data.customerEmail || "");
      setCustomerPhone(data.customerPhone || "");
      setOrganization(data.organization || "");
      setDeliveryMode(data.deliveryMode || "pickup");
      if (data.orderNumber) setOrderNumber(data.orderNumber);
      if (data.orderSource) setOrderSource(data.orderSource);
      if (data.totalAmount) setTotalAmount((data.totalAmount / 100).toFixed(2));
      if (data.deliveryAddress) setDeliveryAddress(data.deliveryAddress);
      if (data.guestCount) setNumberOfGuests(String(data.guestCount));
      if (data.utensilsRequested) setUtensilsRequested(true);
      if (data.pickupTime || data.deliveryTime) {
        const timeStr = data.deliveryTime || data.pickupTime;
        setPickupTime(toDatetimeLocalPST(new Date(timeStr!)));
      }
      if (data.items && data.items.length > 0) {
        setItems(data.items.map((item) => ({ name: item.notes ? `${item.name} - ${item.notes}` : item.name, quantity: item.quantity })));
      }
      if (data.notes) setNotes(data.notes);
      setPdfParsed(true);
      if (data.pdfUrl) setPdfUrl(data.pdfUrl);
    } catch (error: any) {
      setUploadError(error.message || "Failed to parse PDF");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploadError("");
    if (deliveryMode === "delivery" && !deliveryAddress.trim()) {
      setUploadError("Delivery address is required for delivery orders");
      setLoading(false);
      return;
    }
    const validItems = itemsPending ? [] : items.filter((item) => item.name.trim());
    try {
      const pickupDate = pickupTime ? fromDatetimeLocalToPST(pickupTime) : null;
      const readyDate = deliveryMode === "delivery" && pickupDate ? new Date(pickupDate.getTime() - 30 * 60 * 1000) : null;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: orderNumber || null,
          customerName,
          customerEmail: customerEmail || null,
          organization: organization || null,
          customerPhone: customerPhone || null,
          deliveryMode,
          pickupTime: deliveryMode === "pickup" && pickupDate ? pickupDate.toISOString() : null,
          deliveryTime: deliveryMode === "delivery" && pickupDate ? pickupDate.toISOString() : null,
          readyTime: readyDate ? readyDate.toISOString() : null,
          deliveryAddress: deliveryMode === "delivery" ? deliveryAddress : null,
          assignedDriver: deliveryMode === "delivery" && assignedDriver ? assignedDriver : null,
          items: validItems,
          notes: notes || null,
          totalAmount: totalAmount ? Math.round(parseFloat(totalAmount) * 100) : null,
          orderSource: orderSource || null,
          utensilsRequested,
          numberOfGuests: numberOfGuests ? parseInt(numberOfGuests) : null,
          pdfUrl: pdfUrl || null,
          status: "new",
        }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Failed to create order" }));
        throw new Error(errorData.error || "Failed to create order");
      }
      onCreated();
    } catch (error: any) {
      setUploadError(error.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="bg-dark-800 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
      >
        <div className="sticky top-0 bg-dark-800 px-4 py-4 border-b border-dark-600 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">New Order</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {isAdmin && (
            <div className="bg-dark-700 rounded-xl p-4">
              <label className="block text-sm text-gray-400 mb-2">Import from PDF</label>
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handlePdfUpload} className="hidden" id="pdf-upload" />
              <label htmlFor="pdf-upload" className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium cursor-pointer transition-colors ${uploading ? "bg-dark-600 text-gray-400" : "bg-chicken-primary/20 text-chicken-primary hover:bg-chicken-primary/30"}`}>
                {uploading ? <><span className="animate-spin">&#9203;</span> Parsing PDF...</> : <span className="flex items-center gap-2"><FileText size={18} /> Upload Catering Order PDF</span>}
              </label>
              {uploadError && <p className="text-red-500 text-sm mt-2">{uploadError}</p>}
              {pdfParsed && !uploadError && <p className="text-green-500 text-sm mt-2">PDF imported successfully! Review and edit the details below.</p>}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Order #</label>
            <input type="text" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="e.g. 12345" className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Customer Name *</label>
            <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" required />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Organization</label>
            <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Order Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDeliveryMode("pickup")} className={`py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${deliveryMode === "pickup" ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>
                <Store size={18} /> Pickup
              </button>
              <button type="button" onClick={() => setDeliveryMode("delivery")} className={`py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${deliveryMode === "delivery" ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>
                <Truck size={18} /> Delivery
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {deliveryMode === "delivery" ? "Delivery Time" : "Pickup Time"} <span className="text-xs text-gray-500">({getPSTTimezoneLabel()})</span>
            </label>
            <input type="datetime-local" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
          </div>

          {deliveryMode === "delivery" && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Delivery Address</label>
                <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Assign Driver</label>
                  <select value={assignedDriver} onChange={(e) => setAssignedDriver(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary">
                    <option value="">Select driver...</option>
                    {driverOptions.map((driver) => (<option key={driver} value={driver}>{driver}</option>))}
                  </select>
                </div>
              )}
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-gray-400">Order Items</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={itemsPending} onChange={(e) => setItemsPending(e.target.checked)} className="w-4 h-4 rounded bg-dark-700 border-dark-500 text-chicken-primary focus:ring-chicken-primary" />
                <span className="text-sm text-amber-400">Menu TBD</span>
              </label>
            </div>
            {itemsPending ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <span className="text-amber-400 text-sm">Menu details will be confirmed later</span>
              </div>
            ) : (
              <>
                {items.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input type="text" placeholder="Item name" value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} className="flex-1 bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
                    <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)} className="w-20 bg-dark-700 text-white px-3 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary text-center" />
                    <button type="button" onClick={() => removeItem(index)} className="text-red-500 px-2">&times;</button>
                  </div>
                ))}
                <button type="button" onClick={addItem} className="text-chicken-primary text-sm font-medium">+ Add Item</button>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1"># of Guests</label>
              <input type="number" min="0" value={numberOfGuests} onChange={(e) => setNumberOfGuests(e.target.value)} placeholder="0" className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Utensils Requested</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setUtensilsRequested(true)} className={`py-3 rounded-xl font-medium transition-colors ${utensilsRequested ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>Yes</button>
                <button type="button" onClick={() => setUtensilsRequested(false)} className={`py-3 rounded-xl font-medium transition-colors ${!utensilsRequested ? "bg-chicken-primary text-dark-900" : "bg-dark-700 text-gray-300"}`}>No</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Order Total ($)</label>
              <input type="number" step="0.01" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="0.00" className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Order Source</label>
              <select value={orderSource} onChange={(e) => setOrderSource(e.target.value)} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary">
                <option value="">Select source...</option>
                {orderSources.map((source) => (<option key={source} value={source}>{source}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-dark-700 text-white px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-chicken-primary resize-none" />
          </div>

          <motion.button type="submit" disabled={loading || !customerName.trim() || (deliveryMode === "delivery" && !deliveryAddress.trim())} className="w-full bg-chicken-primary text-dark-900 font-semibold py-3 rounded-xl hover:bg-chicken-secondary transition-colors disabled:opacity-50" whileTap={{ scale: 0.98 }}>
            {loading ? "Creating..." : "Create Order"}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
