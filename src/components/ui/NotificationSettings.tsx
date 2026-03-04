"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

export function NotificationSettings() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) {
    return (
      <div className="bg-dark-600 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <h3 className="font-medium text-white">Push Notifications</h3>
            <p className="text-sm text-gray-400">Push notifications are not supported in this browser.</p>
          </div>
        </div>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="bg-dark-600 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔕</span>
          <div>
            <h3 className="font-medium text-white">Push Notifications</h3>
            <p className="text-sm text-gray-400">Notifications are blocked. Please enable them in your browser settings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dark-600 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{isSubscribed ? "🔔" : "🔕"}</span>
          <div>
            <h3 className="font-medium text-white">Push Notifications</h3>
            <p className="text-sm text-gray-400">
              {isSubscribed ? "Receiving notifications for new orders" : "Enable to get notified of new orders"}
            </p>
          </div>
        </div>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isSubscribed ? "bg-dark-500 text-gray-300 hover:bg-dark-400" : "bg-blue-600 text-white hover:bg-blue-700"
          } ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {isLoading ? "..." : isSubscribed ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}
