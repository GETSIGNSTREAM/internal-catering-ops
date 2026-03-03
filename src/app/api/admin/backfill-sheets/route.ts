import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    // Get all orders and filter by date range
    const result = await storage.getOrders({ limit: 10000, offset: 0 });
    const allOrders = result.orders;

    const filteredOrders = allOrders.filter((order) => {
      const fulfillmentDate = order.deliveryTime || order.pickupTime;
      if (!fulfillmentDate) return false;
      const fd = new Date(fulfillmentDate);
      return fd >= start && fd <= end;
    });

    let success = 0;
    let failed = 0;

    for (const order of filteredOrders) {
      try {
        // Console.log placeholder for Google Sheets append
        // Will be replaced with actual Google Sheets integration
        console.log(
          `[Backfill] Google Sheets append: Order #${order.orderNumber || order.id} - ${order.customerName} - $${order.totalAmount || 0}`
        );
        success++;
      } catch (err) {
        console.error(`[Backfill] Failed for order #${order.id}:`, err);
        failed++;
      }
    }

    return NextResponse.json({
      total: filteredOrders.length,
      success,
      failed,
    });
  } catch (error) {
    console.error("Error during backfill:", error);
    return NextResponse.json(
      { error: "Failed to backfill sheets" },
      { status: 500 }
    );
  }
}
