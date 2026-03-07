import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import {
  TRACKING_MILESTONES,
  UNIFIED_STAGES,
  STAGE_TO_MILESTONE,
  STAGE_TO_PREP,
  STAGE_TO_STATUS,
  type TrackingMilestone,
  type UnifiedStage,
} from "@/lib/schema";

/**
 * POST /api/orders/[id]/milestone
 * Advance an order to a new stage (unified) or tracking milestone (legacy).
 * Creates a tracking history entry and updates prepStatus, status, and trackingMilestone.
 * Accessible by admin and driver roles.
 *
 * Body options:
 *   { stage: "cooking", notes?: string }   — unified stage (preferred)
 *   { milestone: "preparing", notes?: string } — legacy tracking milestone
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
  const { stage, milestone, notes } = body;

  // Determine which path to use: unified stage (preferred) or legacy milestone
  let unifiedStage: string | null = null;

  if (stage) {
    // New unified stage path
    if (!UNIFIED_STAGES.includes(stage as UnifiedStage)) {
      return NextResponse.json(
        { error: "Invalid stage", validStages: UNIFIED_STAGES },
        { status: 400 }
      );
    }
    unifiedStage = stage;
  } else if (milestone) {
    // Legacy milestone path — keep backward compatibility
    if (!TRACKING_MILESTONES.includes(milestone as TrackingMilestone)) {
      return NextResponse.json(
        { error: "Invalid milestone", validMilestones: TRACKING_MILESTONES },
        { status: 400 }
      );
    }
    unifiedStage = null; // handled via legacy path below
  } else {
    return NextResponse.json(
      { error: "Either 'stage' or 'milestone' is required" },
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
      if (order.assignedDriverId !== auth.session.user.id) {
        return NextResponse.json({ error: "Not assigned to this order" }, { status: 403 });
      }
    }

    const updateData: Record<string, any> = {};
    let historyMilestone: string;

    if (unifiedStage) {
      // ── Unified stage path ──
      updateData.prepStatus = STAGE_TO_PREP[unifiedStage];
      updateData.status = STAGE_TO_STATUS[unifiedStage];

      // Update customer-facing tracking milestone for delivery orders
      const mappedMilestone = STAGE_TO_MILESTONE[unifiedStage];
      if (order.deliveryMode === "delivery" && mappedMilestone) {
        updateData.trackingMilestone = mappedMilestone;
      }

      if (unifiedStage === "delivered") {
        updateData.completedAt = new Date();
      }

      historyMilestone = unifiedStage;
    } else {
      // ── Legacy milestone path (backward compatibility) ──
      updateData.trackingMilestone = milestone;

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

      historyMilestone = milestone;
    }

    await storage.updateOrder(orderId, updateData);

    // Always create tracking history entry (audit trail)
    const historyEntry = await storage.createTrackingHistory({
      orderId,
      milestone: historyMilestone,
      triggeredBy: auth.session.user.id,
      notes: notes || null,
    });

    return NextResponse.json({
      success: true,
      stage: unifiedStage || undefined,
      milestone: updateData.trackingMilestone || milestone,
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
