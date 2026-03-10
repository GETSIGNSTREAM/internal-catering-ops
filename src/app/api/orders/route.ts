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

    // Role-based filtering using effectiveRole (respects viewAs)
    const effectiveRole = auth.session.user.effectiveRole;

    if (effectiveRole === "driver") {
      // Drivers see only orders assigned to them
      filters.driverId = auth.session.user.id;
    } else if (effectiveRole !== "admin") {
      // GMs see only orders assigned to their store
      // storeId already reflects viewAsStoreId for admins in GM mode
      if (auth.session.user.storeId) {
        filters.storeId = auth.session.user.storeId;
      } else {
        return NextResponse.json({
          orders: [], total: 0, limit: filters.limit, offset: filters.offset,
          stats: { totalSales: 0, nativeSales: 0 },
        });
      }
    } else {
      // Admin: respect the storeId query param from the location filter
      const storeIdParam = searchParams.get("storeId");
      if (storeIdParam) {
        filters.storeId = parseInt(storeIdParam, 10);
      }
    }

    const [result, aggregates] = await Promise.all([
      storage.getOrders(filters),
      storage.getOrderAggregates(filters),
    ]);

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
      stats: {
        totalSales: aggregates.totalSales,
        nativeSales: aggregates.nativeSales,
      },
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
      const fieldErrors = parsed.error.flatten().fieldErrors;
      console.error("Order validation failed:", JSON.stringify(fieldErrors));
      return NextResponse.json(
        { error: "Validation failed", details: fieldErrors },
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

    // Create tracking history + checklist tasks in parallel (single batch insert for checklists)
    await Promise.all([
      storage.createTrackingHistory({
        orderId: order.id,
        milestone: "confirmed",
        triggeredBy: auth.session.user.id,
      }),
      storage.createOrderChecklists(
        ALL_CHECKLIST_TASKS.map((task) => ({
          orderId: order.id,
          taskName: task.taskName,
          taskType: task.taskType,
          forRole: task.forRole,
          completed: false,
        }))
      ),
    ]);

    return NextResponse.json(order, { status: 201 });
  } catch (error: any) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: `Failed to create order: ${error?.message || "Unknown error"}` },
      { status: 500 }
    );
  }
}
