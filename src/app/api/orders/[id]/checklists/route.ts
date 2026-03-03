import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const orderId = parseInt(params.id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    // Check store access for non-admin
    const order = await storage.getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (auth.session.user.role !== "admin") {
      if (order.assignedStoreId !== auth.session.user.storeId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const checklists = await storage.getOrderChecklists(orderId);

    // Filter by role: admin sees admin tasks, gm sees gm tasks
    const userRole = auth.session.user.role;
    const filteredChecklists = checklists.filter((c) => {
      if (userRole === "admin") return true; // Admin sees all tasks
      return c.forRole === userRole;
    });

    return NextResponse.json(filteredChecklists);
  } catch (error) {
    console.error("Error fetching checklists:", error);
    return NextResponse.json({ error: "Failed to fetch checklists" }, { status: 500 });
  }
}
