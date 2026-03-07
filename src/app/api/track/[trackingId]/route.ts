import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

/**
 * GET /api/track/[trackingId]
 * Public endpoint — no auth required.
 * Returns order tracking data by tracking token.
 * Only exposes customer-safe fields (no internal notes, no pricing details).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  if (!trackingId || trackingId.length < 10) {
    return NextResponse.json({ error: "Invalid tracking ID" }, { status: 400 });
  }

  try {
    const order = await storage.getOrderByTrackingToken(trackingId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Get tracking history
    const history = await storage.getTrackingHistory(order.id);

    // Get driver info if assigned
    let driverName: string | null = null;
    let driverPhone: string | null = null;
    if (order.assignedDriverId) {
      const driver = await storage.getUser(order.assignedDriverId);
      if (driver) {
        driverName = driver.name;
        // driver phone would come from their profile — for now use assignedDriver text
        driverPhone = null;
      }
    }

    // Get latest driver location if en_route or arriving
    let driverLocation = null;
    if (order.assignedDriverId && (order.trackingMilestone === "en_route" || order.trackingMilestone === "arriving")) {
      const loc = await storage.getLatestDriverLocation(order.assignedDriverId);
      if (loc) {
        driverLocation = {
          latitude: loc.latitude,
          longitude: loc.longitude,
          heading: loc.heading,
          speed: loc.speed,
          recordedAt: loc.recordedAt,
        };
      }
    }

    // Return customer-safe tracking data
    return NextResponse.json({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      organization: order.organization,
      deliveryAddress: order.deliveryAddress,
      deliveryMode: order.deliveryMode,
      deliveryTime: order.deliveryTime,
      pickupTime: order.pickupTime,
      estimatedArrival: order.estimatedArrival,
      currentMilestone: order.trackingMilestone || "confirmed",
      items: order.items,
      numberOfGuests: order.numberOfGuests,
      driver: driverName ? { name: driverName, phone: driverPhone } : null,
      driverLocation,
      history: history.map((h) => ({
        milestone: h.milestone,
        triggeredAt: h.triggeredAt,
      })),
    });
  } catch (error: any) {
    console.error("Tracking lookup error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
