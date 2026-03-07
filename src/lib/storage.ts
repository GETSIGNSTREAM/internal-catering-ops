import {
  stores, orders, orderChecklists, pushSubscriptions, appSettings,
  trackingHistory, driverLocations,
  type Store, type InsertStore,
  type Order, type InsertOrder, type OrderChecklist, type InsertOrderChecklist,
  type PushSubscription, type InsertPushSubscription,
  type TrackingHistory, type InsertTrackingHistory,
  type DriverLocation, type InsertDriverLocation,
} from "./schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, lt, sql, count, or, asc } from "drizzle-orm";

export interface IStorage {
  getStore(id: number): Promise<Store | undefined>;
  getStores(): Promise<Store[]>;
  createStore(store: InsertStore): Promise<Store>;
  updateStore(id: number, data: Partial<InsertStore>): Promise<Store | undefined>;
  deleteStore(id: number): Promise<boolean>;

  getOrder(id: number): Promise<Order | undefined>;
  getOrders(filters?: OrderFilters): Promise<PaginatedOrders>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, data: Partial<InsertOrder>): Promise<Order | undefined>;
  deleteOrder(id: number): Promise<boolean>;

  getOrderChecklists(orderId: number): Promise<OrderChecklist[]>;
  createOrderChecklist(checklist: InsertOrderChecklist): Promise<OrderChecklist>;
  updateOrderChecklist(id: number, data: Partial<InsertOrderChecklist>): Promise<OrderChecklist | undefined>;

  getOrderStats(storeId?: number): Promise<OrderStats>;

  getPushSubscriptions(): Promise<PushSubscription[]>;
  getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]>;
  createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription>;
  deletePushSubscription(endpoint: string): Promise<void>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Tracking methods
  getOrderByTrackingToken(token: string): Promise<Order | undefined>;
  getTrackingHistory(orderId: number): Promise<TrackingHistory[]>;
  createTrackingHistory(entry: InsertTrackingHistory): Promise<TrackingHistory>;
  getDriverOrders(driverId: string): Promise<Order[]>;
  createDriverLocation(location: InsertDriverLocation): Promise<DriverLocation>;
  getLatestDriverLocation(driverId: string): Promise<DriverLocation | undefined>;
}

export interface OrderFilters {
  status?: string;
  storeId?: number;
  driverId?: string;
  deliveryMode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  fulfillmentDateFrom?: Date;
  fulfillmentDateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderStats {
  todayCount: number;
  weekCount: number;
  onTimePercent: number;
  avgPrepTime: number;
}

export interface SalesReport {
  period: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
}

export interface OrderAggregates {
  totalSales: number;
  nativeSales: number;
}

export interface StorePerformance {
  storeId: number;
  storeName: string;
  orderCount: number;
  revenue: number;
  avgOrderValue: number;
  completedCount: number;
  onTimePercent: number;
}

export class DatabaseStorage implements IStorage {
  async getStore(id: number): Promise<Store | undefined> {
    const [store] = await db.select().from(stores).where(eq(stores.id, id));
    return store || undefined;
  }

  async getStores(): Promise<Store[]> {
    return db.select().from(stores);
  }

  async createStore(insertStore: InsertStore): Promise<Store> {
    const [store] = await db.insert(stores).values(insertStore).returning();
    return store;
  }

  async updateStore(id: number, data: Partial<InsertStore>): Promise<Store | undefined> {
    const [store] = await db.update(stores).set(data).where(eq(stores.id, id)).returning();
    return store || undefined;
  }

  async deleteStore(id: number): Promise<boolean> {
    const result = await db.delete(stores).where(eq(stores.id, id)).returning();
    return result.length > 0;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order || undefined;
  }

  private buildOrderConditions(filters?: OrderFilters): any[] {
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(orders.status, filters.status));
    }
    if (filters?.storeId) {
      conditions.push(eq(orders.assignedStoreId, filters.storeId));
    }
    if (filters?.driverId) {
      conditions.push(eq(orders.assignedDriverId, filters.driverId));
    }
    if (filters?.deliveryMode) {
      conditions.push(eq(orders.deliveryMode, filters.deliveryMode));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(orders.createdAt, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(orders.createdAt, filters.dateTo));
    }
    if (filters?.fulfillmentDateFrom && filters?.fulfillmentDateTo) {
      // Use OR on both date columns to match orders with either delivery or pickup in range
      // (Avoids COALESCE + Date param issue with postgres.js prepare:false)
      conditions.push(
        or(
          and(gte(orders.deliveryTime, filters.fulfillmentDateFrom), lt(orders.deliveryTime, filters.fulfillmentDateTo)),
          and(gte(orders.pickupTime, filters.fulfillmentDateFrom), lt(orders.pickupTime, filters.fulfillmentDateTo)),
        )
      );
    } else if (filters?.fulfillmentDateFrom) {
      conditions.push(
        or(
          gte(orders.deliveryTime, filters.fulfillmentDateFrom),
          gte(orders.pickupTime, filters.fulfillmentDateFrom),
        )
      );
    } else if (filters?.fulfillmentDateTo) {
      conditions.push(
        or(
          lt(orders.deliveryTime, filters.fulfillmentDateTo),
          lt(orders.pickupTime, filters.fulfillmentDateTo),
        )
      );
    }
    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${orders.customerName} ILIKE ${searchTerm}`,
          sql`${orders.orderNumber} ILIKE ${searchTerm}`,
          sql`${orders.organization} ILIKE ${searchTerm}`
        )
      );
    }

    return conditions;
  }

  async getOrders(filters?: OrderFilters): Promise<PaginatedOrders> {
    const conditions = this.buildOrderConditions(filters);
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    const orderDateTime = sql`COALESCE(${orders.deliveryTime}, ${orders.pickupTime})`;
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total: totalCount }] = await db
      .select({ total: count() })
      .from(orders)
      .where(whereClause);

    let query = db.select().from(orders);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    const results = await (query as any).orderBy(desc(orderDateTime)).limit(limit).offset(offset);

    return {
      orders: results,
      total: totalCount,
      limit,
      offset,
    };
  }

  async getOrderAggregates(filters?: OrderFilters): Promise<OrderAggregates> {
    const conditions = this.buildOrderConditions(filters);
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [result] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${orders.totalAmount}), 0)`,
        nativeSales: sql<number>`COALESCE(SUM(CASE WHEN ${orders.orderSource} = 'eatwildbird.com' THEN ${orders.totalAmount} ELSE 0 END), 0)`,
      })
      .from(orders)
      .where(whereClause);

    return {
      totalSales: Number(result.totalSales),
      nativeSales: Number(result.nativeSales),
    };
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async updateOrder(id: number, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [order] = await db.update(orders).set(data).where(eq(orders.id, id)).returning();
    return order || undefined;
  }

  async deleteOrder(id: number): Promise<boolean> {
    await db.delete(orderChecklists).where(eq(orderChecklists.orderId, id));
    const result = await db.delete(orders).where(eq(orders.id, id)).returning();
    return result.length > 0;
  }

  async getOrderChecklists(orderId: number): Promise<OrderChecklist[]> {
    return db.select().from(orderChecklists).where(eq(orderChecklists.orderId, orderId));
  }

  async createOrderChecklist(insertChecklist: InsertOrderChecklist): Promise<OrderChecklist> {
    const [checklist] = await db.insert(orderChecklists).values(insertChecklist).returning();
    return checklist;
  }

  async updateOrderChecklist(id: number, data: Partial<InsertOrderChecklist>): Promise<OrderChecklist | undefined> {
    const [checklist] = await db.update(orderChecklists).set(data).where(eq(orderChecklists.id, id)).returning();
    return checklist || undefined;
  }

  async getOrderStats(storeId?: number): Promise<OrderStats> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const fulfillmentToday = or(
      and(gte(orders.deliveryTime, todayStart), lt(orders.deliveryTime, todayEnd)),
      and(gte(orders.pickupTime, todayStart), lt(orders.pickupTime, todayEnd))
    );

    const fulfillmentWeek = or(
      and(gte(orders.deliveryTime, weekStart), lt(orders.deliveryTime, weekEnd)),
      and(gte(orders.pickupTime, weekStart), lt(orders.pickupTime, weekEnd))
    );

    const todayConditions: any[] = [fulfillmentToday];
    const weekConditions: any[] = [fulfillmentWeek];

    if (storeId) {
      todayConditions.push(eq(orders.assignedStoreId, storeId));
      weekConditions.push(eq(orders.assignedStoreId, storeId));
    }

    const todayOrders = await db.select().from(orders).where(and(...todayConditions));
    const weekOrders = await db.select().from(orders).where(and(...weekConditions));

    const completedOrders = weekOrders.filter(o => o.status === 'delivered' || o.status === 'ready');
    const totalCompleted = completedOrders.length;

    let onTimeCount = 0;
    let totalPrepTime = 0;

    for (const order of completedOrders) {
      const targetTime = order.deliveryTime || order.pickupTime;
      if (order.completedAt && targetTime) {
        const completedMs = new Date(order.completedAt).getTime();
        const targetMs = new Date(targetTime).getTime();
        if (completedMs <= targetMs) {
          onTimeCount++;
        }
      }
      if (order.completedAt && order.createdAt) {
        const prepTime = (new Date(order.completedAt).getTime() - new Date(order.createdAt).getTime()) / (1000 * 60);
        totalPrepTime += prepTime;
      }
    }

    return {
      todayCount: todayOrders.length,
      weekCount: weekOrders.length,
      onTimePercent: totalCompleted > 0 ? Math.round((onTimeCount / totalCompleted) * 100) : 100,
      avgPrepTime: totalCompleted > 0 ? Math.round(totalPrepTime / totalCompleted) : 0
    };
  }

  async getSalesReports(storeId?: number): Promise<{ daily: SalesReport[], weekly: SalesReport[], monthly: SalesReport[] }> {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const fulfillmentCondition = or(
      gte(orders.deliveryTime, threeMonthsAgo),
      gte(orders.pickupTime, threeMonthsAgo)
    );
    const conditions: any[] = [fulfillmentCondition];
    if (storeId) {
      conditions.push(eq(orders.assignedStoreId, storeId));
    }

    const recentOrders = await db.select().from(orders).where(and(...conditions));

    const getFulfillmentDate = (o: any): Date | null => {
      const d = o.deliveryTime || o.pickupTime;
      return d ? new Date(d) : null;
    };

    const dailyReports: SalesReport[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = recentOrders.filter(o => {
        const ft = getFulfillmentDate(o);
        return ft && ft >= date && ft < nextDate;
      });

      const revenue = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      dailyReports.push({
        period: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        orderCount: dayOrders.length,
        revenue,
        avgOrderValue: dayOrders.length > 0 ? Math.round(revenue / dayOrders.length) : 0
      });
    }

    const weeklyReports: SalesReport[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekOrders = recentOrders.filter(o => {
        const ft = getFulfillmentDate(o);
        return ft && ft >= weekStart && ft < weekEnd;
      });

      const revenue = weekOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      weeklyReports.push({
        period: `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        orderCount: weekOrders.length,
        revenue,
        avgOrderValue: weekOrders.length > 0 ? Math.round(revenue / weekOrders.length) : 0
      });
    }

    const monthlyReports: SalesReport[] = [];
    for (let i = 2; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const monthOrders = recentOrders.filter(o => {
        const ft = getFulfillmentDate(o);
        return ft && ft >= monthStart && ft < monthEnd;
      });

      const revenue = monthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      monthlyReports.push({
        period: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        orderCount: monthOrders.length,
        revenue,
        avgOrderValue: monthOrders.length > 0 ? Math.round(revenue / monthOrders.length) : 0
      });
    }

    return { daily: dailyReports, weekly: weeklyReports, monthly: monthlyReports };
  }

  async getPushSubscriptions(): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions);
  }

  async getPushSubscriptionsByUserId(userId: string): Promise<PushSubscription[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async createPushSubscription(subscription: InsertPushSubscription): Promise<PushSubscription> {
    const existing = await db.select().from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
    if (existing.length > 0) {
      const [updated] = await db.update(pushSubscriptions)
        .set(subscription)
        .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
        .returning();
      return updated;
    }
    const [created] = await db.insert(pushSubscriptions).values(subscription).returning();
    return created;
  }

  async deletePushSubscription(endpoint: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  }

  async getStorePerformance(): Promise<StorePerformance[]> {
    const allStores = await db.select().from(stores);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await db.select().from(orders).where(
      or(
        gte(orders.deliveryTime, thirtyDaysAgo),
        gte(orders.pickupTime, thirtyDaysAgo)
      )
    );

    const performance: StorePerformance[] = [];

    for (const store of allStores) {
      const storeOrders = recentOrders.filter(o => o.assignedStoreId === store.id);

      const revenue = storeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const completedOrders = storeOrders.filter(o => o.status === 'completed' || o.status === 'delivered');

      let onTimeCount = 0;
      for (const order of completedOrders) {
        if (order.completedAt) {
          const targetTime = order.deliveryTime || order.pickupTime;
          if (targetTime && new Date(order.completedAt).getTime() <= new Date(targetTime).getTime()) {
            onTimeCount++;
          }
        }
      }

      performance.push({
        storeId: store.id,
        storeName: store.name,
        orderCount: storeOrders.length,
        revenue,
        avgOrderValue: storeOrders.length > 0 ? Math.round(revenue / storeOrders.length) : 0,
        completedCount: completedOrders.length,
        onTimePercent: completedOrders.length > 0 ? Math.round((onTimeCount / completedOrders.length) * 100) : 100
      });
    }

    return performance.sort((a, b) => b.revenue - a.revenue);
  }

  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return setting?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (existing) {
      await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
    } else {
      await db.insert(appSettings).values({ key, value });
    }
  }

  // ── Tracking Methods ──────────────────────────────────────────────

  async getOrderByTrackingToken(token: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.trackingToken, token));
    return order || undefined;
  }

  async getTrackingHistory(orderId: number): Promise<TrackingHistory[]> {
    return db.select().from(trackingHistory)
      .where(eq(trackingHistory.orderId, orderId))
      .orderBy(asc(trackingHistory.triggeredAt));
  }

  async createTrackingHistory(entry: InsertTrackingHistory): Promise<TrackingHistory> {
    const [record] = await db.insert(trackingHistory).values(entry).returning();
    return record;
  }

  async getDriverOrders(driverId: string): Promise<Order[]> {
    return db.select().from(orders)
      .where(
        and(
          eq(orders.assignedDriverId, driverId),
          or(
            eq(orders.status, "prep"),
            eq(orders.status, "ready"),
            eq(orders.status, "new"),
          )
        )
      )
      .orderBy(asc(sql`COALESCE(${orders.deliveryTime}, ${orders.pickupTime})`));
  }

  async createDriverLocation(location: InsertDriverLocation): Promise<DriverLocation> {
    const [record] = await db.insert(driverLocations).values(location).returning();
    return record;
  }

  async getLatestDriverLocation(driverId: string): Promise<DriverLocation | undefined> {
    const [loc] = await db.select().from(driverLocations)
      .where(eq(driverLocations.driverId, driverId))
      .orderBy(desc(driverLocations.recordedAt))
      .limit(1);
    return loc || undefined;
  }
}

export const storage = new DatabaseStorage();
