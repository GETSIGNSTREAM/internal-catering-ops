"use client";

import { useSession } from "next-auth/react";

export default function OrdersPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-dark-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Orders</h1>
      <p className="text-gray-400">
        Welcome, {session?.user?.name || "User"}. Orders page coming soon.
      </p>
    </div>
  );
}
