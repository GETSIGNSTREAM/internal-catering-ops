import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { generateTrackingToken, getTrackingUrl } from "@/lib/tracking";

/**
 * POST /api/orders/[id]/tracking-token
 * Generate a tracking token for an order (if it doesn't have one).
 * Also creates the initial "confirmed" milestone in tracking history.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  try {
    const order = await storage.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // If already has token, just return it
    if (order.trackingToken) {
      return NextResponse.json({
        trackingToken: order.trackingToken,
        trackingUrl: getTrackingUrl(order.trackingToken),
      });
    }

    // Generate new token
    const token = generateTrackingToken();
    await storage.updateOrder(orderId, {
      trackingToken: token,
      trackingMilestone: "confirmed",
    } as any);

    // Create initial tracking history entry
    await storage.createTrackingHistory({
      orderId,
      milestone: "confirmed",
      triggeredBy: parseInt(auth.session.user.id, 10),
    });

    return NextResponse.json({
      trackingToken: token,
      trackingUrl: getTrackingUrl(token),
    });
  } catch (error: any) {
    console.error("Generate tracking token error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
