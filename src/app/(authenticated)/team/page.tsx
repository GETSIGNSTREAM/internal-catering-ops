"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/supabase-auth-provider";
import { motion } from "framer-motion";
import { Users, MapPin, ArrowLeft } from "lucide-react";
import { OrderListSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageTransition } from "@/components/ui/PageTransition";

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  storeId?: number | null;
  storeName?: string | null;
}

interface Store {
  id: number;
  name: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("gm");
  const [formStoreId, setFormStoreId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setTeam(data);
    } catch (error) {
      console.error("Failed to fetch team");
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await fetch("/api/stores");
      const data = await res.json();
      setStores(data);
    } catch (error) {
      console.error("Failed to fetch stores");
    }
  };

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    fetchTeam();
    fetchStores();
  }, [user, router]);

  const resetForm = () => {
    setFormName("");
    setFormUsername("");
    setFormPassword("");
    setFormRole("gm");
    setFormStoreId(null);
    setShowAddForm(false);
    setEditingUser(null);
    setError("");
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formUsername.trim() || !formPassword.trim()) {
      setError("Name, username, and password are required");
      return;
    }

    if (formRole !== "admin" && !formStoreId) {
      setError("Please select a store for this team member");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          username: formUsername,
          password: formPassword,
          role: formRole,
          storeId: formRole === "admin" ? null : formStoreId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        resetForm();
        fetchTeam();
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (error) {
      setError("Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !formName.trim() || !formUsername.trim()) {
      setError("Name and username are required");
      return;
    }

    if (formRole !== "admin" && !formStoreId) {
      setError("Please select a store for this team member");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload: any = {
        name: formName,
        username: formUsername,
        role: formRole,
        storeId: formRole === "admin" ? null : formStoreId,
      };

      if (formPassword.trim()) {
        payload.password = formPassword;
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        resetForm();
        fetchTeam();
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (error) {
      setError("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setDeleteConfirm(null);
        fetchTeam();
      } else {
        alert(data.error || "Failed to delete user");
      }
    } catch (error) {
      alert("Failed to delete user");
    }
  };

  const startEdit = (member: User) => {
    setEditingUser(member);
    setFormName(member.name);
    setFormUsername(member.username);
    setFormPassword("");
    setFormRole(member.role);
    setFormStoreId(member.storeId || null);
    setShowAddForm(false);
    setError("");
  };

  const startAdd = () => {
    resetForm();
    setShowAddForm(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500";
      case "gm":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
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
            <Users className="text-chicken-primary" size={24} />
            <h1 className="text-xl font-bold text-white">Team</h1>
          </div>
          {user?.role === "admin" && (
            <button
              onClick={startAdd}
              className="bg-chicken-primary text-dark-900 px-3 py-1.5 rounded-lg text-sm font-semibold"
            >
              + Add Member
            </button>
          )}
        </div>
      </header>

      <main className="px-4 py-6">
        {(showAddForm || editingUser) && (
          <form
            onSubmit={editingUser ? handleEditUser : handleAddUser}
            className="bg-dark-700 rounded-xl p-4 mb-4"
          >
            <h3 className="text-white font-semibold mb-3">
              {editingUser ? "Edit Team Member" : "Add Team Member"}
            </h3>

            {error && (
              <div className="bg-red-500/20 text-red-400 p-2 rounded-lg mb-3 text-sm">
                {error}
              </div>
            )}

            <input
              type="text"
              placeholder="Full name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
              required
            />
            <input
              type="text"
              placeholder="Username"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
              required
            />
            <input
              type="password"
              placeholder={
                editingUser
                  ? "New password (leave blank to keep current)"
                  : "Password"
              }
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
              required={!editingUser}
            />
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value)}
              className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
            >
              <option value="gm">General Manager</option>
              <option value="admin">Admin</option>
              <option value="driver">Driver</option>
            </select>

            {formRole !== "admin" && formRole !== "driver" && (
              <select
                value={formStoreId || ""}
                onChange={(e) =>
                  setFormStoreId(
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                className="w-full bg-dark-600 text-white rounded-lg px-3 py-2 mb-3"
                required
              >
                <option value="">Select store...</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            )}

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
        ) : team.length === 0 ? (
          <EmptyState
            type="team"
            title="No team members yet"
            message="Add team members to get started"
          />
        ) : (
          <PageTransition>
            <div className="space-y-3">
              {team.map((member, index) => (
                <motion.div
                  key={member.id}
                  className="card-premium p-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  {deleteConfirm === member.id ? (
                    <div>
                      <p className="text-white mb-3">
                        Delete &quot;{member.name}&quot;?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteUser(member.id)}
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
                          {member.name}
                        </h3>
                        <p className="text-sm text-gray-400">
                          @{member.username}
                        </p>
                        {member.storeName && (
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin size={12} /> {member.storeName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`${getRoleBadgeColor(member.role)} text-white text-xs px-2 py-1 rounded-full capitalize`}
                        >
                          {member.role === "gm" ? "GM" : member.role}
                        </span>
                        {user?.role === "admin" &&
                          String(member.id) !== user.id && (
                            <div className="flex gap-2 ml-2">
                              <button
                                onClick={() => startEdit(member)}
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(member.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                      </div>
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
