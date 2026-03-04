"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Store as StoreIcon,
  MapPin,
  Phone,
  ArrowLeft,
} from "lucide-react";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTransition } from "@/components/ui/PageTransition";

interface Store {
  id: number;
  name: string;
  address?: string;
  phone?: string;
}

export default function StoresPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchStores = async () => {
    try {
      const res = await fetch("/api/stores");
      const data = await res.json();
      setStores(data);
    } catch (error) {
      console.error("Failed to fetch stores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    fetchStores();
  }, [user, router]);

  const resetForm = () => {
    setFormName("");
    setFormAddress("");
    setFormPhone("");
    setShowAddForm(false);
    setEditingStore(null);
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          address: formAddress,
          phone: formPhone,
        }),
      });

      if (res.ok) {
        resetForm();
        fetchStores();
      }
    } catch (error) {
      console.error("Failed to add store");
    } finally {
      setSaving(false);
    }
  };

  const handleEditStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore || !formName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/stores/${editingStore.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          address: formAddress,
          phone: formPhone,
        }),
      });

      if (res.ok) {
        resetForm();
        fetchStores();
      }
    } catch (error) {
      console.error("Failed to update store");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStore = async (storeId: number) => {
    try {
      const res = await fetch(`/api/stores/${storeId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDeleteConfirm(null);
        fetchStores();
      }
    } catch (error) {
      console.error("Failed to delete store");
    }
  };

  const startEdit = (store: Store) => {
    setEditingStore(store);
    setFormName(store.name);
    setFormAddress(store.address || "");
    setFormPhone(store.phone || "");
    setShowAddForm(false);
  };

  const startAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  return (
    <div className="min-h-screen bg-dark-900">
      <header className="bg-dark-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </button>
            <StoreIcon className="text-chicken-primary" size={24} />
            <h1 className="text-xl font-bold text-white">Stores</h1>
          </div>
          {user?.role === "admin" && (
            <button
              onClick={startAdd}
              className="bg-chicken-primary text-dark-900 px-3 py-1.5 rounded-lg text-sm font-semibold"
            >
              + Add Store
            </button>
          )}
        </div>
      </header>

      <main className="px-4 py-6">
        {(showAddForm || editingStore) && (
          <form
            onSubmit={editingStore ? handleEditStore : handleAddStore}
            className="bg-dark-700 rounded-xl p-4 mb-4"
          >
            <h3 className="text-white font-semibold mb-3">
              {editingStore ? "Edit Store" : "Add New Store"}
            </h3>
            <input
              type="text"
              placeholder="Store name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
              required
            />
            <input
              type="text"
              placeholder="Address (optional)"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
            />
            <input
              type="text"
              placeholder="Phone (optional)"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-chicken-primary text-dark-900 py-2 rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 bg-dark-600 text-white py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <OrderListSkeleton count={3} />
        ) : stores.length === 0 ? (
          <EmptyState
            type="stores"
            title="No stores yet"
            message="Add your first store location"
          />
        ) : (
          <PageTransition>
            <div className="space-y-3">
              {stores.map((store, index) => (
                <motion.div
                  key={store.id}
                  className="card-premium p-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {deleteConfirm === store.id ? (
                    <div>
                      <p className="text-white mb-3">
                        Delete &quot;{store.name}&quot;?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteStore(store.id)}
                          className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-semibold"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="flex-1 bg-dark-600 text-white py-2 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-white font-semibold">
                          {store.name}
                        </h3>
                        {store.address && (
                          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                            <MapPin size={12} /> {store.address}
                          </p>
                        )}
                        {store.phone && (
                          <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                            <Phone size={12} /> {store.phone}
                          </p>
                        )}
                      </div>
                      {user?.role === "admin" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(store)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(store.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </PageTransition>
        )}
      </main>
    </div>
  );
}
