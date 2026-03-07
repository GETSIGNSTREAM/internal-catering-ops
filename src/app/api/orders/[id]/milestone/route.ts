import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { TRACKING_MILESTONES, type TrackingMilestone } from "@/lib/schema";

/**
 * POST /api/orders/[id]/milestone
 * Advance an order to a new tracking milestone.
 * Creates a tracking history entry and updates the order's trackingMilestone.
 * Accessible by admin and driver roles.
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

  const body = await request.json();
  const { milestone, notes } = body;

  if (!milestone || !TRACKING_MILESTONES.includes(milestone as TrackingMilestone)) {
    return NextResponse.json(
      { error: "Invalid milestone", validMilestones: TRACKING_MILESTONES },
      { status: 400 }
    );
  }

  try {
    const order = await storage.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Drivers can only update orders assigned to them
    if (auth.session.user.role === "driver") {
      if (order.assignedDriverId !== parseInt(auth.session.user.id, 10)) {
        return NextResponse.json({ error: "Not assigned to this order" }, { status: 403 });
      }
    }

    // Update the order's tracking milestone
    const updateData: Record<string, any> = {
      trackingMilestone: milestone,
    };

    // Also update order status to match milestone
    if (milestone === "delivered") {
      updateData.status = "delivered";
      updateData.prepStatus = "delivered";
      updateData.completedAt = new Date();
    } else if (milestone === "en_route" || milestone === "arriving") {
      updateData.status = "ready";
      updateData.prepStatus = "ready";
    } else if (milestone === "preparing" || milestone === "packed") {
      updateData.status = "prep";
      updateData.prepStatus = milestone === "packed" ? "ready" : "cooking";
    }

    await storage.updateOrder(orderId, updateData);

    // Create tracking history entry
    const historyEntry = await storage.createTrackingHistory({
      orderId,
      milestone,
      triggeredBy: parseInt(auth.session.user.id, 10),
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      milestone,
      history: historyEntry,
    });
  } catch (error: any) {
    console.error("Milestone update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/orders/[id]/milestone
 * Get tracking history for an order.
 */
export async function GET(
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
    const history = await storage.getTrackingHistory(orderId);
    return NextResponse.json(history);
  } catch (error: any) {
    console.error("Get tracking history error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
