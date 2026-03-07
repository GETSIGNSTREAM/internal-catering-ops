import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { UpdateOrderSchema } from "@/lib/validations";
import { sendPushNotification } from "@/lib/push-notifications";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const order = await storage.getOrder(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check access using effectiveRole (respects viewAs)
    const effectiveRole = auth.session.user.effectiveRole;
    if (effectiveRole === "driver") {
      // Drivers can only see orders assigned to them
      if (order.assignedDriverId !== auth.session.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else if (effectiveRole !== "admin") {
      // GMs can only see orders for their store
      if (order.assignedStoreId !== auth.session.user.storeId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Join store name
    let storeName: string | null = null;
    if (order.assignedStoreId) {
      const store = await storage.getStore(order.assignedStoreId);
      storeName = store?.name ?? null;
    }

    return NextResponse.json({ ...order, storeName });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const existingOrder = await storage.getOrder(id);
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check access using effectiveRole (respects viewAs)
    const effectiveRole = auth.session.user.effectiveRole;
    if (effectiveRole === "driver") {
      if (existingOrder.assignedDriverId !== auth.session.user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    } else if (effectiveRole !== "admin") {
      if (existingOrder.assignedStoreId !== auth.session.user.storeId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    const body = await request.json();
    const parsed = UpdateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, any> = { ...data };

    // Convert date strings to Date objects
    if (data.pickupTime !== undefined) {
      updateData.pickupTime = data.pickupTime ? new Date(data.pickupTime) : null;
    }
    if (data.deliveryTime !== undefined) {
      updateData.deliveryTime = data.deliveryTime ? new Date(data.deliveryTime) : null;
    }
    if (data.readyTime !== undefined) {
      updateData.readyTime = data.readyTime ? new Date(data.readyTime) : null;
    }

    // Normalize totalAmount
    if (data.totalAmount !== undefined) {
      updateData.totalAmount = data.totalAmount ?? null;
    }

    // Check photo requirement for delivery status
    if (data.status === "delivered" && !existingOrder.photoProofUrl && !body.photoProofUrl) {
      // Allow status change but log a warning
      console.log(`[Warning] Order #${id} marked as delivered without photo proof`);
    }

    // Track status change for notifications
    const statusChanged = data.status && data.status !== existingOrder.status;

    // Set completedAt if transitioning to a completed status
    if (statusChanged && (data.status === "delivered" || data.status === "completed" || data.status === "ready")) {
      if (!existingOrder.completedAt) {
        updateData.completedAt = new Date();
      }
    }

    const updated = await storage.updateOrder(id, updateData as any);
    if (!updated) {
      return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
    }

    // Fire notifications on status change
    if (statusChanged) {
      console.log(`[Integration] Status changed: Order #${updated.orderNumber || updated.id} -> ${data.status}`);
    }

    // Notify driver when assigned to an order
    if (data.assignedDriverId && data.assignedDriverId !== existingOrder.assignedDriverId) {
      const customerLabel = existingOrder.customerName || `#${existingOrder.orderNumber || existingOrder.id}`;
      sendPushNotification(
        "New Delivery Assigned",
        `Order for ${customerLabel}`,
        "/driver",
        data.assignedDriverId
      ).catch((err) => console.error("Push notify error:", err));
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
    }

    const deleted = await storage.deleteOrder(id);
    if (!deleted) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting order:", error);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
