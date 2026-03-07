import { randomBytes } from "crypto";

/**
 * Generate a URL-safe tracking token.
 * 16 bytes = 22 base64url characters — short enough for SMS links.
 */
export function generateTrackingToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Get the full tracking URL for an order.
 */
export function getTrackingUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://internal-catering-ops.vercel.app";
  return `${baseUrl}/track/${token}`;
}

/**
 * Milestone display configuration for the 6-step tracker.
 */
export const MILESTONE_CONFIG = [
  {
    value: "confirmed" as const,
    label: "Order Confirmed",
    emoji: "✓",
    description: "Your order has been confirmed",
  },
  {
    value: "preparing" as const,
    label: "Being Prepared",
    emoji: "🔥",
    description: "Our chefs are preparing your order",
  },
  {
    value: "packed" as const,
    label: "Packed & Ready",
    emoji: "📦",
    description: "Your order is packed and ready for transport",
  },
  {
    value: "en_route" as const,
    label: "On the Way",
    emoji: "🚐",
    description: "Your order is on its way to you",
  },
  {
    value: "arriving" as const,
    label: "Almost There",
    emoji: "📍",
    description: "Your driver is almost at the delivery location",
  },
  {
    value: "delivered" as const,
    label: "Delivered",
    emoji: "🎉",
    description: "Your order has been delivered. Enjoy!",
  },
] as const;
