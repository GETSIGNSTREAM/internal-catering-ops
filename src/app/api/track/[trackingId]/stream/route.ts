import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * GET /api/track/[trackingId]/stream
 * SSE endpoint for live tracking updates — no auth required.
 * Phase 3: Will stream GPS coordinates + milestone changes in real-time.
 * Currently polls database every 5 seconds.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  const order = await storage.getOrderByTrackingToken(trackingId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial state
      send({
        type: "milestone",
        milestone: order.trackingMilestone || "confirmed",
        timestamp: new Date().toISOString(),
      });

      // Poll every 5 seconds for updates
      let lastMilestone = order.trackingMilestone;
      const interval = setInterval(async () => {
        try {
          const updated = await storage.getOrder(order.id);
          if (!updated) {
            clearInterval(interval);
            controller.close();
            return;
          }

          // Send milestone update if changed
          if (updated.trackingMilestone !== lastMilestone) {
            lastMilestone = updated.trackingMilestone;
            send({
              type: "milestone",
              milestone: updated.trackingMilestone,
              timestamp: new Date().toISOString(),
            });
          }

          // Send driver location if en_route/arriving
          if (updated.assignedDriverId && (updated.trackingMilestone === "en_route" || updated.trackingMilestone === "arriving")) {
            const loc = await storage.getLatestDriverLocation(updated.assignedDriverId);
            if (loc) {
              send({
                type: "location",
                latitude: loc.latitude,
                longitude: loc.longitude,
                heading: loc.heading,
                speed: loc.speed,
                recordedAt: loc.recordedAt,
              });
            }
          }

          // Close stream if delivered
          if (updated.trackingMilestone === "delivered") {
            send({ type: "complete" });
            clearInterval(interval);
            controller.close();
          }
        } catch {
          // Ignore polling errors
        }
      }, 5000);

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
