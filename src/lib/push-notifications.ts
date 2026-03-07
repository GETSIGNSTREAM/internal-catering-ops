import webpush from "web-push";
import { storage } from "./storage";

let vapidConfigured = false;

function initializeVapid() {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.log("VAPID keys not configured. Push notifications will be disabled.");
    return false;
  }

  try {
    webpush.setVapidDetails(
      "mailto:support@wildbird.com",
      publicKey,
      privateKey
    );
    vapidConfigured = true;
    console.log("Web Push configured successfully");
    return true;
  } catch (error) {
    console.error("Failed to configure VAPID:", error);
    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function sendPushNotification(
  title: string,
  body: string,
  url?: string,
  userId?: string
): Promise<void> {
  if (!initializeVapid()) {
    return;
  }

  try {
    let subscriptions;
    if (userId) {
      subscriptions = await storage.getPushSubscriptionsByUserId(userId);
    } else {
      subscriptions = await storage.getPushSubscriptions();
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || "/orders"
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        );
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          await storage.deletePushSubscription(sub.endpoint);
          console.log("Removed expired subscription");
        } else {
          console.error("Push notification error:", error);
        }
      }
    });

    await Promise.all(sendPromises);
  } catch (error) {
    console.error("Failed to send push notifications:", error);
  }
}

export async function notifyNewOrderPush(orderData: {
  orderNumber: string;
  customerName: string;
  storeName?: string;
}): Promise<void> {
  const title = "New Catering Order";
  const body = `Order ${orderData.orderNumber} from ${orderData.customerName}${orderData.storeName ? ` at ${orderData.storeName}` : ""}`;
  await sendPushNotification(title, body, "/orders");
}

export async function notifyOrderStatusChangePush(
  orderNumber: string,
  customerName: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  const title = "Order Status Updated";
  const body = `Order ${orderNumber} (${customerName}): ${oldStatus} → ${newStatus}`;
  await sendPushNotification(title, body, "/orders");
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}
