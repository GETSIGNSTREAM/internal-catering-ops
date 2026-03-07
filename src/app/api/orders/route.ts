import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { storage } from "@/lib/storage";
import { CreateOrderSchema } from "@/lib/validations";
import { ALL_CHECKLIST_TASKS } from "@/lib/constants";
import { generateTrackingToken } from "@/lib/tracking";
import type { OrderFilters } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);

    const filters: OrderFilters = {};

    const status = searchParams.get("status");
    if (status) filters.status = status;

    const search = searchParams.get("search");
    if (search) filters.search = search;

    const deliveryMode = searchParams.get("deliveryMode");
    if (deliveryMode) filters.deliveryMode = deliveryMode;

    const dateFrom = searchParams.get("dateFrom");
    if (dateFrom) filters.dateFrom = new Date(dateFrom);

    const dateTo = searchParams.get("dateTo");
    if (dateTo) filters.dateTo = new Date(dateTo);

    const fulfillmentDateFrom = searchParams.get("fulfillmentDateFrom");
    if (fulfillmentDateFrom) filters.fulfillmentDateFrom = new Date(fulfillmentDateFrom);

    const fulfillmentDateTo = searchParams.get("fulfillmentDateTo");
    if (fulfillmentDateTo) filters.fulfillmentDateTo = new Date(fulfillmentDateTo);

    const limitParam = searchParams.get("limit");
    filters.limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 200) : 50;

    const offsetParam = searchParams.get("offset");
    filters.offset = offsetParam ? parseInt(offsetParam, 10) || 0 : 0;

    // Non-admin users: filter by role
    if (auth.session.user.role === "driver") {
      // Drivers see only orders assigned to them
      filters.driverId = parseInt(auth.session.user.id, 10);
    } else if (auth.session.user.role !== "admin") {
      // GMs see only orders assigned to their store
      if (auth.session.user.storeId) {
        filters.storeId = auth.session.user.storeId;
      } else {
        return NextResponse.json({ orders: [], total: 0, limit: filters.limit, offset: filters.offset });
      }
    }

    const result = await storage.getOrders(filters);

    // Join store names
    const allStores = await storage.getStores();
    const storeMap = new Map(allStores.map((s) => [s.id, s.name]));

    const ordersWithStores = result.orders.map((order) => ({
      ...order,
      storeName: order.assignedStoreId ? storeMap.get(order.assignedStoreId) ?? null : null,
    }));

    return NextResponse.json({
      orders: ordersWithStores,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Convert date strings to Date objects
    const orderData: Record<string, any> = {
      ...data,
      pickupTime: data.pickupTime ? new Date(data.pickupTime) : null,
      deliveryTime: data.deliveryTime ? new Date(data.deliveryTime) : null,
      readyTime: data.readyTime ? new Date(data.readyTime) : null,
    };

    // Auto-generate tracking token for all orders
    orderData.trackingToken = generateTrackingToken();
    orderData.trackingMilestone = "confirmed";

    const order = await storage.createOrder(orderData as any);

    // Create initial tracking history entry
    await storage.createTrackingHistory({
      orderId: order.id,
      milestone: "confirmed",
      triggeredBy: parseInt(auth.session.user.id, 10),
    });

    // Create checklist tasks for this order
    for (const task of ALL_CHECKLIST_TASKS) {
      await storage.createOrderChecklist({
        orderId: order.id,
        taskName: task.taskName,
        taskType: task.taskType,
        forRole: task.forRole,
        completed: false,
      });
    }

    // Fire-and-forget integration calls (console.log placeholders for now)
    console.log(`[Integration] Slack notify: New order #${order.orderNumber || order.id} created`);
    console.log(`[Integration] Google Sheets append: Order #${order.orderNumber || order.id}`);
    console.log(`[Integration] Email confirmation: ${order.customerEmail || "no email"}`);
    console.log(`[Integration] Push notification: New order #${order.orderNumber || order.id}`);

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
